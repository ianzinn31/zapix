import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  downloadMediaMessage,
  proto,
  generateWAMessageFromContent
} from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { storage, DATA_DIR, UPLOADS_DIR, AUDIO_CACHE_DIR, MEDIA_CACHE_DIR } from './storage.js';
import { antiBan } from './antiBan.js';
import { nvidiaNim } from './nvidiaNim.js';
import { fishAudio } from './fishAudio.js';
import { audioTranscriber } from './audioTranscriber.js';
import { visionService } from './visionService.js';

const AUTH_DIR = path.join(DATA_DIR, 'auth_info_baileys');

function normalizeStr(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function resolveDeliverable(requestedTag) {
  const deliverables = storage.getDeliverables();
  if (!deliverables || deliverables.length === 0) return null;

  const product = storage.getSettings().product;
  const rawTag = (requestedTag || '').trim();
  const normTag = normalizeStr(rawTag);

  // 1. Exact match on tag or name
  let found = deliverables.find(d => normalizeStr(d.tag) === normTag || normalizeStr(d.name) === normTag);
  if (found) return found;

  // 2. Partial match on tag or name
  found = deliverables.find(d => 
    (normTag.length >= 3 && normalizeStr(d.tag).includes(normTag)) ||
    (normTag.length >= 3 && normalizeStr(d.name).includes(normTag)) ||
    (normTag.length >= 3 && normTag.includes(normalizeStr(d.tag))) ||
    (normTag.length >= 3 && normTag.includes(normalizeStr(d.name)))
  );
  if (found) return found;

  // 3. Keyword tokens overlap
  const words = rawTag.toLowerCase().split(/[\s_\-]+/).filter(w => w.length >= 3);
  if (words.length > 0) {
    found = deliverables.find(d => {
      const dTokens = `${d.tag} ${d.name} ${d.description || ''} ${d.filename || ''}`.toLowerCase();
      return words.some(w => dTokens.includes(w));
    });
    if (found) return found;
  }

  // 4. Product name match (e.g. if the customer or AI asked for the product by name)
  if (product && product.name && (normTag.includes(normalizeStr(product.name)) || normalizeStr(product.name).includes(normTag))) {
    return deliverables.find(d => d.type === 'pdf') || deliverables[0];
  }

  // 5. If only 1 deliverable is uploaded in the entire system, any deliverable dispatch request refers to it!
  if (deliverables.length === 1) {
    return deliverables[0];
  }

  return deliverables[0] || null;
}

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.io = null; // Socket.io instance
    this.qrCodeDataUrl = null;
    this.status = 'disconnected'; // disconnected | connecting | qr_ready | connected
    this.connectedNumber = null;
    this.reconnectAttempts = 0;
    this.isInitializing = false;
    this.activeLeadControllers = new Map(); // phone -> AbortController
    this.incomingDebounceMap = new Map(); // phone -> { timer, messages: [], jid }
    this.pendingDeliveryClosingTimers = new Map(); // phone -> { timer, jid, scheduledAt }
    this.activeDeliveryClosingAbortControllers = new Map(); // phone -> AbortController
  }

  setSocketIo(io) {
    this.io = io;
  }

  emit(event, data) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  getStatus() {
    return {
      status: this.status,
      qrCode: this.qrCodeDataUrl,
      connectedNumber: this.connectedNumber
    };
  }

  // Force clean reconnect
  async reconnect() {
    try {
      if (this.sock) {
        this.sock.end(undefined);
        this.sock = null;
      }
    } catch (e) {}
    this.status = 'disconnected';
    this.isInitializing = false;
    this.reconnectAttempts = 0;
    return this.initialize();
  }

  // Safe presence update that never throws or crashes on closed/dead sockets
  async safePresence(jid, type) {
    try {
      if (this.sock && this.status === 'connected') {
        await this.sock.sendPresenceUpdate(type, jid);
      }
    } catch (err) {
      console.warn(`[WhatsApp] Presença (${type}) ignorada:`, err.message);
    }
  }

  // Initialize and connect WhatsApp socket
  async initialize() {
    if (this.isInitializing || this.status === 'connected') return;
    this.isInitializing = true;

    try {
      this.status = 'connecting';
      this.emit('whatsapp:status', { status: this.status });
      storage.addLog('INFO', 'Iniciando conexão com WhatsApp Web...');

      if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

      this.sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['Zapix AI', 'Chrome', '124.0.0']
      });

      // Credential updates
      this.sock.ev.on('creds.update', saveCreds);

      // Connection updates (QR, open, close)
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr);
            this.status = 'qr_ready';
            this.emit('whatsapp:qr', { qrCode: this.qrCodeDataUrl });
            this.emit('whatsapp:status', { status: this.status, qrCode: this.qrCodeDataUrl });
            storage.addLog('INFO', 'Novo QR Code gerado para leitura no dashboard.');
          } catch (qrErr) {
            console.error('Error generating QR Data URL:', qrErr);
          }
        }

        if (connection === 'open') {
          this.status = 'connected';
          this.qrCodeDataUrl = null;
          this.reconnectAttempts = 0;
          this.connectedNumber = this.sock.user?.id ? this.sock.user.id.split(':')[0] : 'Conectado';
          this.emit('whatsapp:status', {
            status: 'connected',
            connectedNumber: this.connectedNumber
          });
          storage.addLog('SUCCESS', `WhatsApp conectado com sucesso no número: ${this.connectedNumber}`);
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const isConnectionReplaced = statusCode === DisconnectReason.connectionReplaced || statusCode === 440;
          const shouldReconnect = !isLoggedOut && !isConnectionReplaced;

          this.connectedNumber = null;
          this.status = 'disconnected';
          this.emit('whatsapp:status', { status: 'disconnected' });

          if (isConnectionReplaced) {
            this.isInitializing = false;
            this.reconnectAttempts = 0;
            storage.addLog(
              'WARNING',
              'Conexão substituída por outra instância ou processo (code 440). Reconexão em repouso para evitar conflito. Verifique se há múltiplos processos no PM2.'
            );
            return;
          }

          if (shouldReconnect) {
            this.reconnectAttempts++;
            const delay = Math.min(this.reconnectAttempts * 3000, 20000);
            storage.addLog('WARNING', `Conexão WhatsApp encerrada (code ${statusCode}). Reconectando em ${delay / 1000}s...`);
            setTimeout(() => {
              this.isInitializing = false;
              this.initialize();
            }, delay);
          } else {
            storage.addLog('WARNING', 'Sessão do WhatsApp desvinculada (Logout). Limpando credenciais.');
            this.cleanupAuth();
          }
        }
      });

      // Handle Incoming Messages
      this.sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
          // Ignore status broadcasts and groups
          const jid = msg.key?.remoteJid || '';
          if (!jid || jid.includes('@broadcast') || jid.includes('@g.us')) {
            continue;
          }

          const fromMe = Boolean(msg.key?.fromMe);
          const phone = jid.split('@')[0];
          const pushName = (msg.pushName || msg.verifiedBizName || '').trim();

          // Extract text content
          let messageContent =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            '';

          // Extract audio or media indicator
          const isAudio = Boolean(msg.message?.audioMessage);
          const isImage = Boolean(msg.message?.imageMessage);
          const isDocument = Boolean(msg.message?.documentMessage);

          let messageType = 'text';
          let mediaUrl = null;
          let audioDuration = null;

          if (isAudio) {
            messageType = 'audio';
            if (!fromMe) {
              try {
                const buffer = await downloadMediaMessage(
                  msg,
                  'buffer',
                  {},
                  {
                    reuploadRequest: this.sock?.updateMediaMessage
                  }
                );

                if (buffer && buffer.length > 0) {
                  const audioFilename = `incoming_${Date.now()}_${phone}.ogg`;
                  const audioDiskPath = path.join(AUDIO_CACHE_DIR, audioFilename);
                  fs.writeFileSync(audioDiskPath, buffer);
                  mediaUrl = `/audio/${audioFilename}`;
                  audioDuration = msg.message?.audioMessage?.seconds || null;

                  // Transcribe incoming audio using Groq Whisper (whisper-large-v3)
                  const transcription = await audioTranscriber.transcribeBuffer(buffer, audioFilename);
                  if (transcription?.text) {
                    messageContent = transcription.text;
                  }
                }
              } catch (audioErr) {
                console.error('[WhatsApp Audio] Erro ao baixar ou transcrever áudio recebido:', audioErr);
                storage.addLog('WARNING', `Falha ao processar áudio recebido de ${phone}: ${audioErr.message}`);
              }
            }
          } else if (isImage || isDocument) {
            messageType = isImage ? 'image' : 'document';
            if (!fromMe) {
              try {
                const buffer = await downloadMediaMessage(
                  msg,
                  'buffer',
                  {},
                  {
                    reuploadRequest: this.sock?.updateMediaMessage
                  }
                );

                if (buffer && buffer.length > 0) {
                  const rawExt = isImage
                    ? 'jpg'
                    : (msg.message?.documentMessage?.fileName?.split('.').pop() || 'pdf');
                  const filename = `incoming_${Date.now()}_${phone}.${rawExt}`;
                  const mediaDiskPath = path.join(MEDIA_CACHE_DIR, filename);
                  fs.writeFileSync(mediaDiskPath, buffer);
                  mediaUrl = `/media/${filename}`;

                  const mimetype = isImage
                    ? (msg.message?.imageMessage?.mimetype || 'image/jpeg')
                    : (msg.message?.documentMessage?.mimetype || 'application/pdf');

                  // Vision & OCR Analysis for receipts / PIX
                  const analysis = await visionService.analyzeMedia(buffer, mimetype, { phone, pushName });

                  if (analysis) {
                    const isApproved = analysis.status === 'APROVADO';
                    const currentSettings = storage.getSettings();
                    const deliveryStrategy = currentSettings.product?.deliveryStrategy || 'require_payment';
                    const isDeliverFirst = deliveryStrategy === 'deliver_first';

                    // Update lead with receipt analysis
                    storage.upsertLead(phone, {
                      lastReceiptStatus: analysis.status,
                      lastReceiptAmount: analysis.amount,
                      lastReceiptBank: analysis.bank,
                      lastReceiptDate: Date.now(),
                      lastReceiptSummary: analysis.reason,
                      lastReceiptExplanation: analysis.customerExplanation,
                      ...(isApproved ? { stage: 'APROVADO' } : {})
                    });

                    if (isApproved) {
                      storage.addSale({
                        phone,
                        customerName: pushName || phone,
                        amount: analysis.amount || currentSettings.product?.price || 15,
                        platform: 'PIX Direto'
                      });
                      this.emit('lead:updated', storage.getLead(phone));
                    }

                    if (analysis.isBankReceipt) {
                      messageContent = `[COMPROVANTE DE PAGAMENTO ANALISADO]:
- Status: ${analysis.status}
- Banco: ${analysis.bank || 'Não identificado'}
- Valor identificado: ${analysis.amount ? `R$ ${analysis.amount}` : 'Não identificado'}
- Efetivado?: ${analysis.shouldReleaseProduct ? 'SIM' : 'NÃO'}
- Detalhes: ${analysis.reason}
- Instrução para sua resposta: ${
                        analysis.status === 'AGENDADO'
                          ? (isDeliverFirst
                              ? 'Explique com muito carinho e gentileza que você viu o comprovante, mas que no aplicativo do banco ele ficou como um AGENDAMENTO futuro (o dinheiro ainda não foi debitado nem recebido). Oriente com simpatia a cancelar o agendamento no app do banco e fazer a transferência imediata na hora para concluir a contribuição simbólica de R$ 15.'
                              : 'Explique com simpatia que você viu o comprovante, mas ele é um AGENDAMENTO (o dinheiro ainda não caiu). Oriente o cliente a cancelar o agendamento no aplicativo do banco e fazer a transferência imediata na hora para que o sistema possa liberar o produto imediatamente.')
                          : analysis.status === 'APROVADO'
                          ? (isDeliverFirst
                              ? 'O pagamento/contribuição foi confirmado com sucesso! ATENÇÃO MÁXIMA DE OFERTA INVERTIDA: O cliente JÁ RECEBEU todas as apostilas e atividades em PDF no início da conversa! NUNCA diga que vai liberar material, que vai mandar arquivos ou que ele deve aguardar o acesso! Agradeça de coração pelo carinho e pela contribuição que mantém o projeto vivo, e diga para ele aproveitar ao máximo as atividades que já estão com ele!'
                              : 'Agradeça pelo pagamento confirmado e envie o produto com a tag do entregável.')
                          : 'Explique a divergência com respeito e passe a chave PIX oficial novamente.'
                      }`;
                    } else if (analysis.reason) {
                      messageContent = `[IMAGEM RECEBIDA DO CLIENTE]: ${analysis.reason}`;
                    }
                  }
                }
              } catch (mediaErr) {
                console.error('[WhatsApp Media] Erro ao baixar ou analisar imagem/documento:', mediaErr);
                storage.addLog('WARNING', `Falha ao processar mídia recebida de ${phone}: ${mediaErr.message}`);
              }
            }
          }

          // Build message text for display in chat & logs
          let displayText = messageContent;
          if (isAudio) {
            displayText = messageContent ? `🎵 [Áudio]: "${messageContent}"` : '🎵 [Áudio do Cliente]';
          } else if (isImage) {
            if (messageContent && messageContent.startsWith('[COMPROVANTE')) {
              displayText = `📷 ${messageContent}`;
            } else {
              displayText = messageContent ? `📷 [Imagem]: ${messageContent}` : '📷 [Imagem do Cliente]';
            }
          } else if (isDocument) {
            if (messageContent && messageContent.startsWith('[COMPROVANTE')) {
              displayText = `📎 ${messageContent}`;
            } else {
              displayText = messageContent ? `📎 [Documento]: ${messageContent}` : '📎 [Documento do Cliente]';
            }
          }

          // Record incoming message in database
          const savedMsg = storage.addMessage({
            phone,
            fromMe,
            text: displayText || (isAudio ? '🎵 [Áudio do Cliente]' : isImage ? '📷 [Imagem]' : '📎 [Arquivo]'),
            type: messageType,
            mediaUrl,
            audioDuration,
            timestamp: (Number(msg.messageTimestamp) * 1000) || Date.now()
          });

          // Ensure lead exists with their actual WhatsApp pushName and exact routing JID
          if (!fromMe) {
            storage.upsertLead(phone, {
              jid,
              ...(pushName ? { name: pushName, pushName } : {})
            });
          }

          // Notify frontend dashboard in real-time
          this.emit('chat:message', savedMsg);
          this.emit('lead:updated', storage.getLead(phone));

          // If message is from me, don't trigger AI response
          if (fromMe) continue;

          // Check if AI is active for this contact
          const lead = storage.getLead(phone);
          if (lead && lead.aiActive === false) {
            console.log(`[Zapix AI] Atendimento automático pausado para lead: ${phone}`);
            continue;
          }

          // Determine prompt input for the AI
          const aiInput = isAudio && !messageContent
            ? '(O lead enviou uma mensagem de áudio, porém a transcrição não pôde ser gerada ou o áudio estava vazio/inaudível. Responda com simpatia no WhatsApp dizendo que não conseguiu ouvir bem agora e pedindo para ele digitar ou mandar de novo).'
            : messageContent;

          if (aiInput) {
            // Cancel any pending post-delivery timer or bubble loop if lead spoke again
            this.cancelPostDeliveryClosing(phone);
            if (this.activeLeadControllers.has(phone)) {
              const activeCtrl = this.activeLeadControllers.get(phone);
              if (activeCtrl && !activeCtrl.signal.aborted) {
                activeCtrl.abort();
                console.log(`[Zapix Human Pacing] Lead ${phone} enviou nova mensagem. Cancelando bolhas pendentes da resposta anterior para priorizar a fala do lead.`);
              }
            }

            // Human Debounce Buffer: Group multiple quick messages sent within 2.2s window
            if (!this.incomingDebounceMap.has(phone)) {
              this.incomingDebounceMap.set(phone, { timer: null, messages: [], jid });
            }

            const debounceEntry = this.incomingDebounceMap.get(phone);
            debounceEntry.messages.push(aiInput);
            debounceEntry.jid = jid;

            if (debounceEntry.timer) {
              clearTimeout(debounceEntry.timer);
            }

            debounceEntry.timer = setTimeout(() => {
              const pendingMessages = [...debounceEntry.messages];
              const targetJid = debounceEntry.jid;
              this.incomingDebounceMap.delete(phone);

              const consolidatedInput = pendingMessages.join('\n');
              this.handleAiResponse(phone, targetJid, consolidatedInput);
            }, 2200); // 2.2s natural conversational buffer
          }
        }
      });

    } catch (err) {
      console.error('Error in WhatsApp initialize:', err);
      this.status = 'disconnected';
      this.emit('whatsapp:status', { status: 'disconnected', error: err.message });
      storage.addLog('ERROR', `Erro ao inicializar WhatsApp: ${err.message}`);
    } finally {
      this.isInitializing = false;
    }
  }

  // Handle AI Sales Response with Human Pacing and Anti-Ban
  async handleAiResponse(phone, jid, userText) {
    if (this.status !== 'connected' || !this.sock) {
      console.warn(`[WhatsApp] Ignorando resposta para ${phone}: WhatsApp não está conectado.`);
      return;
    }

    antiBan.enqueueForLead(phone, async () => {
      const abortController = new AbortController();
      this.activeLeadControllers.set(phone, abortController);
      const signal = abortController.signal;

      try {
        if (this.status !== 'connected' || !this.sock) return;
        const lead = storage.getLead(phone);
        // Double check if operator paused AI in the meantime
        if (lead && lead.aiActive === false) return;
        if (signal.aborted) return;

        // Fetch recent conversation history
        const history = storage.getMessages(phone);

        // 1. Generate AI Response via NVIDIA NIM (with automatic fallback)
        const aiResult = await nvidiaNim.generateResponse(phone, userText, history);
        if (signal.aborted) return;
        let replyText = aiResult.text;

        if (!replyText) return;

        // Log if fallback was triggered
        if (aiResult.fallbackTriggered) {
          this.emit('ai:fallback_event', {
            modelUsed: aiResult.modelUsed,
            lead: phone
          });
        }

        // 2. Check for Voice Audio Tag in all its variations:
        //    a) [Áudio]: "..." or [Audio]: "..." (quoted text after bracketed tag)
        //    b) [AUDIO: ...] or [ÁUDIO: ...] (bracketed text)
        //    c) [ENVIAR_AUDIO: ...]
        let audioSpeechText = null;
        // Check for quoted format: [Áudio]: "..." or [AUDIO]: "..."
        const quotedRegex = /\[\s*(?:ENVIAR_?|MANDAR_?|GRAVAR_?)?(?:AUDIO|ÁUDIO)\s*\]:?\s*["'“”«»]([\s\S]*?)["'“”«»]/i;
        const quotedMatch = replyText.match(quotedRegex);

        if (quotedMatch) {
          audioSpeechText = quotedMatch[1].trim();
          replyText = replyText.replace(quotedMatch[0], '').trim();
        } else {
          // Balanced bracket extraction to safely capture nested emotion/pause tags like [warm and calm], [break], etc.
          const tagStartRegex = /\[\s*(?:ENVIAR_?|MANDAR_?|GRAVAR_?)?(?:AUDIO|ÁUDIO)(?:\s*:|\s*\]:?)\s*/i;
          const startMatch = replyText.match(tagStartRegex);
          if (startMatch) {
            const startIndex = startMatch.index;
            const contentStartIndex = startIndex + startMatch[0].length;

            let depth = 1;
            let endIndex = contentStartIndex;
            while (endIndex < replyText.length && depth > 0) {
              if (replyText[endIndex] === '[') {
                depth++;
              } else if (replyText[endIndex] === ']') {
                depth--;
                if (depth === 0) break;
              }
              endIndex++;
            }

            audioSpeechText = replyText
              .slice(contentStartIndex, endIndex)
              .trim()
              .replace(/^["'“”«»]+|["'“”«»]+$/g, '')
              .trim();
            const fullTag = replyText.slice(startIndex, endIndex + 1);
            replyText = replyText.replace(fullTag, '').trim();
          }
        }

        // Clean any remaining audio tag remnants from replyText so they NEVER leak as plain text bubbles
        replyText = replyText
          .replace(/\[\s*(?:ENVIAR_?|MANDAR_?|GRAVAR_?)?(?:AUDIO|ÁUDIO)(?:\s*:|\s*\]:?)[\s\S]*?(?:\]|$)/gi, '')
          .replace(/\[\s*(?:AUDIO|ÁUDIO)\s*\]:?\s*["'“”«»][\s\S]*?["'“”«»]/gi, '')
          .trim();

        if (audioSpeechText && audioSpeechText.length > 0 && !signal.aborted) {
          // Generate audio via Fish Audio TTS with automatic AI regional voice resolution
          try {
            const generatedAudio = await fishAudio.generateSpeech(audioSpeechText, null, null, { phone, jid, text: audioSpeechText });
            if (signal.aborted) return;

            // Anti-ban: Simulate human recording voice note
            const { thinkingDelay, recordingDelay } = antiBan.calculateAudioRecordingDelay(generatedAudio.durationSec);
            await antiBan.sleep(thinkingDelay, signal);
            if (signal.aborted || this.status !== 'connected' || !this.sock) return;

            // WhatsApp presence: 'recording'
            await this.safePresence(jid, 'recording');
            await antiBan.sleep(recordingDelay, signal);
            await this.safePresence(jid, 'paused');
            if (signal.aborted || this.status !== 'connected' || !this.sock) return;

            // Send native WhatsApp Voice Note (PTT) with animated waveform
            const audioBuffer = fs.readFileSync(generatedAudio.oggPath);
            const waveform = generatedAudio.waveform || await fishAudio.extractWaveform(generatedAudio.oggPath);
            await this.sock.sendMessage(jid, {
              audio: audioBuffer,
              mimetype: 'audio/ogg; codecs=opus',
              ptt: true,
              waveform
            });

            // Save audio message to store
            const audioMsg = storage.addMessage({
              phone,
              fromMe: true,
              text: `🎵 [Áudio]: "${audioSpeechText}"`,
              type: 'audio',
              mediaUrl: generatedAudio.audioUrl,
              audioDuration: generatedAudio.durationSec
            });
            this.emit('chat:message', audioMsg);
            storage.addLog('SUCCESS', `Áudio humanizado Fish Audio enviado para ${phone}`);
          } catch (audioErr) {
            console.error('Failed to send voice note:', audioErr);
            // If audio fails, send as text fallback so customer gets the message
            replyText = `${audioSpeechText}\n\n${replyText}`.trim();
          }
        }

        // 3. Deliverables Extraction & Matching (supports [ENVIAR_ARQUIVO: tag], [PDF: tag], and direct [TAG])
        const fileTagRegex = /\[(?:ENVIAR_)?(?:ARQUIVO|IMAGEM|DOCUMENTO|PDF|FOTO|DELIVERABLE):\s*([^\]]+)\]/gi;
        const tagMatches = [...replyText.matchAll(fileTagRegex)];
        const deliverablesToSend = [];
        const allDeliverables = storage.getDeliverables();

        for (const m of tagMatches) {
          const reqTag = m[1].trim();
          const resolved = resolveDeliverable(reqTag);
          if (resolved && !deliverablesToSend.some((d) => d.id === resolved.id)) {
            deliverablesToSend.push(resolved);
          }
        }

        // Also check if any known deliverable tag or identifier is written directly in brackets: [TAG]
        for (const d of allDeliverables) {
          const tagPattern = new RegExp(`\\[\\s*(?:(?:ENVIAR_)?(?:ARQUIVO|IMAGEM|DOCUMENTO|PDF|FOTO|DELIVERABLE):\\s*)?${d.tag}\\s*\\]`, 'i');
          if (tagPattern.test(replyText)) {
            if (!deliverablesToSend.some((x) => x.id === d.id)) {
              deliverablesToSend.push(d);
            }
          }
        }

        // 3. Antifraud & Delivery Strategy Engine
        const settings = storage.getSettings();
        const product = settings.product || {};
        const deliveryStrategy = product.deliveryStrategy || 'require_payment'; // 'require_payment' | 'deliver_first' | 'per_deliverable'
        const leadObj = storage.getLead(phone);
        const userWantsPix = /pix|pagar|pago|chave|valor|conta|manda.*pix|envia.*pix|passa.*pix|manda.*chave/i.test(userText || '');

        // If operation strategy is 'deliver_first' (entrega TUDO antes e cobra depois):
        if (deliveryStrategy === 'deliver_first') {
          const sentMsgs = storage.getMessages(phone) || [];
          const sentTexts = sentMsgs
            .filter((m) => m.fromMe && m.text && m.text.includes('📎 [Enviado]:'))
            .map((m) => m.text.toLowerCase());

          const hasReceivedAny = sentTexts.length > 0 || leadObj?.stage === 'ENTREGUE' || leadObj?.stage === 'PIX_ENVIADO' || leadObj?.deliverableSent === true;
          const isTriggeredByTag = tagMatches.length > 0 || deliverablesToSend.length > 0;
          const lowerUser = (userText || '').toLowerCase();
          const lowerReply = (replyText || '').toLowerCase();
          const userIncomingMsgs = sentMsgs.filter((m) => !m.fromMe);
          const hasChildDetails = /\b\d+\s*(?:anos?|aninhos|meses)\b|prezinho|escola|começando|creche|maternal|fundamental|alfabetiz/i.test(lowerUser);
          const isExplicitDeliveryAgreement =
            (lowerUser.includes('manda') || lowerUser.includes('envia') || lowerUser.includes('quero ver') || lowerUser.includes('pode mandar') || lowerUser.includes('quero') || lowerUser.includes('sim')) &&
            (lowerReply.includes('enviando') || lowerReply.includes('entregando') || lowerReply.includes('liberando') || lowerReply.includes('preparei') || lowerReply.includes('separei') || lowerReply.includes('abaixo'));

          const isTurn2OrEngaged = userIncomingMsgs.length >= 2 || hasChildDetails || isTriggeredByTag || isExplicitDeliveryAgreement;

          // If the customer explicitly asked for the PIX and already received materials: don't resend materials!
          if (userWantsPix && hasReceivedAny) {
            deliverablesToSend.length = 0;
          } else if (!hasReceivedAny && isTurn2OrEngaged && !userWantsPix) {
            // Deliver ALL registered deliverables together upfront as the complete package (all 3 files)!
            deliverablesToSend.length = 0;
            deliverablesToSend.push(...allDeliverables);
          } else {
            // Do NOT send deliverables on initial greeting or casual conversation
            deliverablesToSend.length = 0;
          }
        } else {
          // Filter deliverables based on the chosen strategy (require_payment / per_deliverable)
          const verifiedDeliverables = deliverablesToSend.filter((deliv) => {
            if (deliveryStrategy === 'per_deliverable') {
              if (deliv.requirePayment === false) {
                return true; // Freebie / Lead magnet - allowed before payment!
              }
            }

            // Otherwise (require_payment or paid deliverable):
            const isBlockedByReceipt =
              leadObj?.lastReceiptStatus &&
              ['AGENDADO', 'VALOR_INCORRETO', 'DESTINATARIO_INCORRETO', 'FALSO_OU_ADULTERADO', 'NAO_E_COMPROVANTE'].includes(leadObj.lastReceiptStatus);

            if (isBlockedByReceipt) {
              storage.addLog(
                'WARNING',
                `Bloqueio Antifraude: Envio do entregável pago (${deliv.name}) cancelado para ${phone} pois o comprovante está com status: ${leadObj.lastReceiptStatus}.`
              );
              return false;
            }

            return true;
          });

          deliverablesToSend.length = 0;
          deliverablesToSend.push(...verifiedDeliverables);

          // Contextual fallback for require_payment
          if (deliverablesToSend.length === 0) {
            const lowerUser = (userText || '').toLowerCase();
            const lowerReply = (replyText || '').toLowerCase();
            const isPurchaseConfirmed =
              leadObj?.lastReceiptStatus === 'APROVADO' &&
              (lowerUser.includes('paguei') ||
               lowerUser.includes('comprei') ||
               lowerUser.includes('pix') ||
               lowerUser.includes('comprovante') ||
               lowerUser.includes('pode me enviar') ||
               lowerUser.includes('manda o produto') ||
               lowerReply.includes('obrigado por ter feito sua compra') ||
               lowerReply.includes('aproveite seu produto'));

            if (isPurchaseConfirmed) {
              const defaultDeliv = resolveDeliverable('PRODUTO') || storage.getDeliverables()[0];
              if (defaultDeliv) {
                deliverablesToSend.push(defaultDeliv);
              }
            }
          }
        }

        // ========================================================
        // STEP 1: SEND DELIVERABLES (PDFs / Files) FIRST
        // Deliverables arrive at the TOP of the conversation!
        // ========================================================
        if (deliverablesToSend.length > 0 && !signal.aborted) {
          for (const deliverableToSend of deliverablesToSend) {
            if (signal.aborted || this.status !== 'connected' || !this.sock) break;
            await antiBan.sleep(1200, signal);
            if (signal.aborted || this.status !== 'connected' || !this.sock) break;

            let fullPath = path.join(UPLOADS_DIR, deliverableToSend.filename);
            if (!fs.existsSync(fullPath)) {
              fullPath = path.resolve(DATA_DIR, deliverableToSend.path.replace(/^\/?data\//, ''));
            }

            if (fs.existsSync(fullPath)) {
              const fileBuffer = fs.readFileSync(fullPath);
              const isPdf = deliverableToSend.type === 'pdf' || deliverableToSend.filename.toLowerCase().endsWith('.pdf');
              let cleanFileName = deliverableToSend.name || deliverableToSend.filename;
              if (isPdf && !cleanFileName.toLowerCase().endsWith('.pdf')) {
                cleanFileName += '.pdf';
              }

              if (isPdf) {
                await this.sock.sendMessage(jid, {
                  document: fileBuffer,
                  mimetype: 'application/pdf',
                  fileName: cleanFileName
                });
              } else {
                await this.sock.sendMessage(jid, {
                  image: fileBuffer,
                  caption: deliverableToSend.description || deliverableToSend.name
                });
              }

              const delivMsg = storage.addMessage({
                phone,
                fromMe: true,
                text: `📎 [Enviado]: ${cleanFileName}`,
                type: deliverableToSend.type || (isPdf ? 'pdf' : 'image'),
                mediaUrl: deliverableToSend.url
              });
              this.emit('chat:message', delivMsg);
              storage.addLog('SUCCESS', `Entregável (${cleanFileName}) enviado com sucesso para ${phone}`);
            } else {
              console.error(`Deliverable file not found on disk: ${fullPath}`);
              storage.addLog('ERROR', `Arquivo não encontrado no disco: ${deliverableToSend.filename}`);
            }
          }
          storage.upsertLead(phone, { stage: 'ENTREGUE', deliverableSent: true, deliverableSentAt: Date.now() });
          // Fluxo 100% autônomo da IA: a IA conduz a conversa e faz o pitch no momento ideal, sem forçar temporizadores robóticos
        }

        // ========================================================
        // STEP 3: CLEAN SYSTEM TAGS & GUARANTEE PIX BLOCK
        // ========================================================
        // Thoroughly strip all deliverable tags by known tag names so they NEVER leak as text bubbles!
        for (const d of allDeliverables) {
          const cleanTag = (d.tag || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (cleanTag) {
            replyText = replyText.replace(new RegExp(`[-•◆*]?\\s*\\[\\s*(?:(?:ENVIAR_)?(?:ARQUIVO|IMAGEM|DOCUMENTO|PDF|FOTO|DELIVERABLE):\\s*)?${cleanTag}\\s*\\]`, 'gi'), '');
          }
        }

        // Strip generic bracketed uppercase tags like [PRODUTO], [PDF], [ENVIAR_ARQUIVO: ...]
        replyText = replyText.replace(/\[(?:ENVIAR_)?(?:ARQUIVO|IMAGEM|DOCUMENTO|PDF|FOTO|DELIVERABLE|TODOS_ARQUIVOS|TODOS_ENTREGAVEIS|TUDO):[\s\S]*?(?:\]|$)/gi, '');
        replyText = replyText.replace(/^[-•◆*]?\s*\[[A-Z0-9_]{3,}\]\s*$/gm, '');
        replyText = replyText.replace(/\[[A-Z0-9_]{4,}\]/g, '');

        // Strip orphaned bullets, intro lines or audio remnants
        replyText = replyText.replace(/Aqui está (?:o seu |todo o )?material completo:?\s*$/gim, '');
        replyText = replyText.replace(/^[-•◆*]\s*$/gm, '');
        replyText = replyText.replace(/\[\s*(?:ENVIAR_?|MANDAR_?|GRAVAR_?)?(?:AUDIO|ÁUDIO)(?:\s*:|\s*\]:?)[\s\S]*?(?:\]|$)/gi, '');
        replyText = replyText.replace(/\[\s*(?:AUDIO|ÁUDIO)\s*\]:?\s*["'“”«»][\s\S]*?["'“”«»]/gi, '');
        // Anti-Leak Safeguard: Purge any prompt rules, CoT reasoning or developer notes before sending
        replyText = replyText.replace(/<think>[\s\S]*?<\/think>/gi, '');
        replyText = replyText.replace(/```(?:thought|thinking)[\s\S]*?```/gi, '');
        replyText = replyText.replace(/^(?:thought|thinking):\s*[\s\S]*?\n\n/gi, '');
        replyText = replyText.replace(/\[\s*(?:DIRETRIZ|FASE|REGRA|INSTRUÇÃO|ATENÇÃO|ESTRUTURA|COMO RESPONDER|CONTEXTO|SITUAÇÃO)[^\]]*\]:?/gi, '');
        replyText = replyText.replace(/^[-•◆*]?\s*(?:DIRETRIZ DE FUNIL|OFERTA INVERTIDA|FECHAMENTO EMOCIONAL|LIBERAÇÃO DE TUDO|CONEXÃO INICIAL|DIRETRIZ MÁXIMA|INSTRUÇÃO DO MOMENTO|SITUAÇÃO ATUAL)[\s\S]*?(?:\n|$)/gmi, '');
        replyText = replyText.replace(/^O cliente JÁ RECEBEU TUDO[^\n]*\n?/gmi, '');
        replyText = replyText.replace(/^NUNCA diga ["'“]amostra["'”]?[^\n]*\n?/gmi, '');
        replyText = replyText.replace(/^NUNCA diga [*_]?libero o restante[^\n]*\n?/gmi, '');
        replyText = replyText.replace(/^REGRA (?:CRÍTICA|SUPREMA|ABSOLUTA):[^\n]*\n?/gmi, '');
        replyText = replyText.replace(/^ATENÇÃO (?:MÁXIMA|SUPREMA|ABSOLUTA):[^\n]*\n?/gmi, '');
        replyText = replyText.replace(/^Sua mensagem DEVE seguir rigorosamente esta estrutura:?[^\n]*\n?/gmi, '');
        replyText = replyText.replace(/^ESTRUTURA OBRIGATÓRIA DA SUA RESPOSTA:?[^\n]*\n?/gmi, '');
        replyText = replyText.replace(/^Como agir conforme a análise:?[^\n]*\n?/gmi, '');
        replyText = replyText.replace(/^(?:Entendi(?:\s+perfeitamente)?|Com certeza|Claro que sim|Claro|Perfeito|Certo)[!,.]?\s*(?:Aqui está|Segue|Abaixo está|Veja|vou te mandar|essa é a resposta)[\s\S]*?:(?:\n+|\s+)/i, '');
        replyText = replyText.replace(/^(?:Aqui está a resposta|Aqui está a mensagem|Segue a mensagem|Segue o texto que você deve enviar)[\s\S]*?:(?:\n+|\s+)/i, '');
        replyText = replyText.replace(/\n+(?:Essa resposta segue rigorosamente|Espero que ajude|Qualquer dúvida estou à disposição|Se precisar de mais alguma coisa|Como posso te ajudar agora\?|Já tem algum lead aguardando)[\s\S]*?$/i, '');
        replyText = replyText.replace(/\n{3,}/g, '\n\n').trim();

        // Safeguard: Ensure PIX key is present ONLY during the initial Phase 2 closing (AFTER deliverables have been sent), or when customer explicitly asked for PIX!
        const sentMsgsForPixCheck = storage.getMessages(phone) || [];
        const hasAlreadySentPixInHistory = sentMsgsForPixCheck.some((m) => m.fromMe && m.text && (
          (product.pixKey && m.text.includes(product.pixKey)) ||
          m.text.includes('Chave PIX') ||
          m.text.includes('Copiar Chave PIX')
        ));
        const hasSentDeliverablesInHistory = sentMsgsForPixCheck.some((m) => m.fromMe && m.text && m.text.includes('📎 [Enviado]:'));
        const hasReceivedDeliverables = hasSentDeliverablesInHistory || leadObj?.stage === 'ENTREGUE' || leadObj?.stage === 'PIX_ENVIADO' || leadObj?.deliverableSent === true;

        // ONLY true on the very FIRST transition to Phase 2 (materials received, not currently sending files, and PIX never sent before in history)!
        const isFirstTimePhase2Pix = deliveryStrategy === 'deliver_first' &&
          hasReceivedDeliverables &&
          deliverablesToSend.length === 0 &&
          !hasAlreadySentPixInHistory &&
          leadObj?.stage !== 'PIX_ENVIADO';

        if (product.pixKey && (isFirstTimePhase2Pix || userWantsPix)) {
          const pixPrice = Number(product.price || 15).toFixed(2).replace('.', ',');
          const pixBlock = `Chave PIX (${product.pixKeyType || 'telefone'}): ${product.pixKey}\nNome: ${product.pixBeneficiary || 'ian alves dos anjos'}\nValor: R$ ${pixPrice}\n\nAssim que você fizer, me envia o comprovante aqui tá bom? ❤️`;

          const emotionalAppeal = `Eu confiei em você de olhos fechados e já te entreguei todo o material completo antes mesmo de você pagar! Fiz isso de coração aberto porque sei o quanto você se preocupa e quer o melhor para o seu pequeno... ❤️\n\nAgora estou aqui de coração te pedindo pra fazer a sua parte com essa contribuição simbólica de apenas R$ ${pixPrice}, que é o que mantém nosso trabalho vivo e de pé!`;

          if (!replyText || replyText.trim().length === 0) {
            replyText = `${emotionalAppeal}\n\n${pixBlock}`;
          } else {
            // Em Oferta Invertida Fase 2, apenas na PRIMEIRA vez que cobra e se o lead não pediu o PIX diretamente, garante o texto de apelo
            if (isFirstTimePhase2Pix && !userWantsPix && !replyText.toLowerCase().includes('confi')) {
              replyText = `${emotionalAppeal}\n\n${replyText}`;
            }
            if (!replyText.includes(product.pixKey)) {
              replyText += `\n\n${pixBlock}`;
            }
          }

          storage.upsertLead(phone, { stage: 'PIX_ENVIADO', deliverableSent: true });
        }

        // ========================================================
        // STEP 4: SEND TEXT MESSAGE BUBBLES
        // ========================================================
        if (replyText && replyText.length > 0 && !signal.aborted) {
          const bubbles = antiBan.splitIntoNaturalBubbles(replyText);

          for (let i = 0; i < bubbles.length; i++) {
            if (signal.aborted) {
              console.log(`[Zapix Human Pacing] Envio de bolhas cancelado para ${phone} pois o lead enviou nova mensagem.`);
              break;
            }
            const bubble = bubbles[i];
            const { baseThinking, typingTime } = antiBan.calculateTypingDelay(bubble);

            // Thinking pause (human reading / deciding)
            await antiBan.sleep(baseThinking, signal);
            if (signal.aborted || this.status !== 'connected' || !this.sock) break;

            // Typing presence update
            await this.safePresence(jid, 'composing');
            await antiBan.sleep(typingTime, signal);
            await this.safePresence(jid, 'paused');
            if (signal.aborted || this.status !== 'connected' || !this.sock) break;

            // Send bubble
            await this.sock.sendMessage(jid, { text: bubble });

            // Store message and emit to live chat
            const sentMsg = storage.addMessage({
              phone,
              fromMe: true,
              text: bubble,
              type: 'text'
            });
            this.emit('chat:message', sentMsg);

            // Natural pause between bubbles
            if (i < bubbles.length - 1) {
              await antiBan.sleep(1500, signal);
            }
          }
        }

        // ========================================================
        // STEP 5: NATIVE 1-CLICK PIX COPY BUTTON
        // ========================================================
        // Send PIX interactive button ONLY on the first time Phase 2 closing is sent or when user explicitly asks for PIX
        const shouldSendPixButton =
          product.pixKey &&
          product.sendPixButton !== false &&
          !signal.aborted &&
          (isFirstTimePhase2Pix || userWantsPix);

        if (shouldSendPixButton) {
          await antiBan.sleep(1200, signal);
          if (!signal.aborted && this.status === 'connected' && this.sock) {
            await this.sendPixCopyButton(jid, product.pixKey, product.price, product.pixBeneficiary);
          }
        }

        // Auto-update lead funnel stage based on conversation progress
        this.updateFunnelStage(phone, replyText);

      } catch (err) {
        console.error(`Error in handleAiResponse for ${phone}:`, err);
        storage.addLog('ERROR', `Erro ao responder ${phone}: ${err.message}`);
      } finally {
        if (this.activeLeadControllers.get(phone) === abortController) {
          this.activeLeadControllers.delete(phone);
        }
      }
    });
  }

  // Cancel any active AI processing, debounce, or typing presence for a lead
  cancelActiveLeadProcess(phone) {
    if (!phone) return;
    this.cancelPostDeliveryClosing(phone);
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    for (const key of [phone, cleanPhone]) {
      if (this.activeLeadControllers.has(key)) {
        const ctrl = this.activeLeadControllers.get(key);
        if (ctrl && !ctrl.signal.aborted) {
          ctrl.abort();
        }
        this.activeLeadControllers.delete(key);
      }
      if (this.incomingDebounceMap.has(key)) {
        const debounce = this.incomingDebounceMap.get(key);
        if (debounce?.timer) clearTimeout(debounce.timer);
        this.incomingDebounceMap.delete(key);
      }
    }
    const jid = this.resolveJid(phone);
    if (jid) {
      this.safePresence(jid, 'paused').catch(() => {});
    }
  }

  // Schedule automated Phase 2 closing and PIX request (disabled to ensure natural conversational flow)
  schedulePostDeliveryClosing(phone, jid, delayMs = 90000) {
    // Desativado: Funil 100% autônomo com IA conduzindo a conversa de acordo com as necessidades do lead
    return;
  }

  // Cancel pending closing timer (lead interacted or funnel was reset)
  cancelPostDeliveryClosing(phone) {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    for (const key of [phone, cleanPhone]) {
      if (this.pendingDeliveryClosingTimers?.has(key)) {
        const item = this.pendingDeliveryClosingTimers.get(key);
        if (item?.timer) {
          clearTimeout(item.timer);
          console.log(`[Zapix Timer] Temporizador pós-entrega cancelado para ${key} (cliente interagiu ou ação concluída).`);
        }
        this.pendingDeliveryClosingTimers.delete(key);
      }
      if (this.activeDeliveryClosingAbortControllers?.has(key)) {
        const ctrl = this.activeDeliveryClosingAbortControllers.get(key);
        if (ctrl && !ctrl.signal.aborted) {
          ctrl.abort();
        }
        this.activeDeliveryClosingAbortControllers.delete(key);
      }
    }
  }

  // Execute the automated Phase 2 emotional closing + voice note + PIX block + 1-click PIX button
  async executePostDeliveryClosing(phone, jid) {
    const lead = storage.getLead(phone);
    if (!lead || lead.aiActive === false) {
      console.log(`[Zapix Timer] Fechamento pós-entrega ignorado para ${phone}: IA inativa ou lead não encontrado.`);
      return;
    }
    if (this.status !== 'connected' || !this.sock) {
      console.log(`[Zapix Timer] Fechamento pós-entrega cancelado: WhatsApp desconectado.`);
      return;
    }
    if (lead.stage === 'APROVADO' || lead.lastReceiptStatus === 'APROVADO') {
      console.log(`[Zapix Timer] Lead ${phone} já está aprovado. Ignorando fechamento.`);
      return;
    }

    const sentMsgs = storage.getMessages(phone) || [];
    const settings = storage.getSettings();
    const product = settings.product || {};
    const hasAlreadySentPix = sentMsgs.some(m => m.fromMe && m.text && (
      (product.pixKey && m.text.includes(product.pixKey)) ||
      m.text.includes('Chave PIX') ||
      m.text.includes('Copiar Chave PIX')
    )) || lead.stage === 'PIX_ENVIADO';

    if (hasAlreadySentPix) {
      console.log(`[Zapix Timer] PIX já foi enviado anteriormente para ${phone}. Ignorando.`);
      return;
    }

    if (lead.deliverableSentAt) {
      const customerMsgAfterDelivery = sentMsgs.some(m => !m.fromMe && m.timestamp > (lead.deliverableSentAt + 2000));
      if (customerMsgAfterDelivery) {
        console.log(`[Zapix Timer] Lead ${phone} já interagiu após a entrega dos arquivos. O fluxo de conversa assume naturalmente.`);
        return;
      }
    }

    const abortController = new AbortController();
    this.activeDeliveryClosingAbortControllers.set(phone, abortController);
    const { signal } = abortController;

    try {
      console.log(`[Zapix Timer] Disparando fechamento emocional e envio de PIX automático para ${phone} após 90s de silêncio...`);
      storage.addLog('INFO', `Disparando fechamento emocional e envio do PIX automático (após 90s) para ${phone}`);

      const targetJid = jid || this.resolveJid(phone);
      const pixPrice = Number(product.price || 15).toFixed(2).replace('.', ',');
      const pixKey = product.pixKey || '88994892385';
      const pixKeyType = product.pixKeyType || 'telefone';
      const beneficiary = product.pixBeneficiary || 'ian alves dos anjos';

      // 1. Áudio humanizado via Fish Audio (se ativo)
      const fishSettings = settings.fishAudio || {};
      if (fishSettings.autoAudio !== false && !signal.aborted) {
        const audioScript = `Oi! Conseguiu abrir as atividades? Como você viu, eu te entreguei todo o material completo de coração aberto antes mesmo de qualquer coisa, porque eu confio em você e sei o quanto vai fazer a diferença! Para nos ajudar a manter esse projeto lindo e atualizado, a gente pede uma contribuição simbólica de apenas ${Math.round(Number(product.price || 15))} reais. Se puder fazer agora, me ajuda demais! Um beijo carinhoso!`;
        try {
          const generatedAudio = await fishAudio.generateSpeech(audioScript, null, null, { phone, jid: targetJid, text: audioScript });
          if (!signal.aborted && this.status === 'connected' && this.sock) {
            const { thinkingDelay, recordingDelay } = antiBan.calculateAudioRecordingDelay(generatedAudio.durationSec);
            await antiBan.sleep(thinkingDelay, signal);
            if (!signal.aborted && this.status === 'connected' && this.sock) {
              await this.safePresence(targetJid, 'recording');
              await antiBan.sleep(recordingDelay, signal);
              await this.safePresence(targetJid, 'paused');
              if (!signal.aborted && this.status === 'connected' && this.sock) {
                const audioBuffer = fs.readFileSync(generatedAudio.oggPath);
                const waveform = generatedAudio.waveform || await fishAudio.extractWaveform(generatedAudio.oggPath);
                await this.sock.sendMessage(targetJid, {
                  audio: audioBuffer,
                  mimetype: 'audio/ogg; codecs=opus',
                  ptt: true,
                  waveform
                });

                const audioMsg = storage.addMessage({
                  phone,
                  fromMe: true,
                  text: `🎵 [Áudio]: "${audioScript}"`,
                  type: 'audio',
                  mediaUrl: generatedAudio.audioUrl,
                  audioDuration: generatedAudio.durationSec
                });
                this.emit('chat:message', audioMsg);
                storage.addLog('SUCCESS', `Áudio de fechamento pós-entrega (90s) enviado para ${phone}`);
              }
            }
          }
        } catch (audioErr) {
          console.error('[Zapix Timer] Falha ao sintetizar/enviar áudio automático:', audioErr);
        }
      }

      if (signal.aborted || this.status !== 'connected' || !this.sock) return;

      // 2. Bolhas de texto com fechamento emocional e bloco de Chave PIX
      const textBubble1 = `E aí, conseguiu dar uma olhadinha com calma nos materiais que te mandei? 🥰`;
      const textBubble2 = `Eu confiei em você de olhos fechados e já te entreguei todo o material completo antes mesmo de você pagar! Fiz isso de coração porque sei o quanto você se preocupa com o futuro do seu pequeno... ❤️\n\nAgora estou aqui te pedindo com muito carinho para fazer a sua parte com essa contribuição simbólica de apenas R$ ${pixPrice}, que é o que mantém nosso projeto vivo!`;
      const textBubble3 = `Chave PIX (${pixKeyType}): ${pixKey}\nNome: ${beneficiary}\nValor: R$ ${pixPrice}\n\nAssim que você fizer, me envia o comprovante aqui tá bom? ❤️`;

      const bubblesToSend = [textBubble1, textBubble2, textBubble3];

      for (let i = 0; i < bubblesToSend.length; i++) {
        if (signal.aborted || this.status !== 'connected' || !this.sock) break;
        const bubble = bubblesToSend[i];
        const { baseThinking, typingTime } = antiBan.calculateTypingDelay(bubble);

        await antiBan.sleep(baseThinking, signal);
        if (signal.aborted || this.status !== 'connected' || !this.sock) break;

        await this.safePresence(targetJid, 'composing');
        await antiBan.sleep(typingTime, signal);
        await this.safePresence(targetJid, 'paused');
        if (signal.aborted || this.status !== 'connected' || !this.sock) break;

        await this.sock.sendMessage(targetJid, { text: bubble });
        const sentMsg = storage.addMessage({
          phone,
          fromMe: true,
          text: bubble,
          type: 'text'
        });
        this.emit('chat:message', sentMsg);

        if (i < bubblesToSend.length - 1) {
          await antiBan.sleep(1500, signal);
        }
      }

      if (signal.aborted || this.status !== 'connected' || !this.sock) return;

      // 3. Botão Interativo Copiar Chave PIX
      if (product.pixKey && product.sendPixButton !== false) {
        await antiBan.sleep(1200, signal);
        if (!signal.aborted && this.status === 'connected' && this.sock) {
          await this.sendPixCopyButton(targetJid, product.pixKey, product.price, product.pixBeneficiary);
        }
      }

      // 4. Atualizar estágio do lead para PIX_ENVIADO
      storage.upsertLead(phone, { stage: 'PIX_ENVIADO', deliverableSent: true });
      this.emit('lead:updated', storage.getLead(phone));
      storage.addLog('SUCCESS', `Fechamento pós-entrega (90s) concluído com sucesso para ${phone}`);
    } finally {
      if (this.activeDeliveryClosingAbortControllers.get(phone) === abortController) {
        this.activeDeliveryClosingAbortControllers.delete(phone);
      }
    }
  }

  // Infer and update lead funnel stage
  updateFunnelStage(phone, replyText) {
    const product = storage.getSettings().product;
    const lead = storage.getLead(phone);
    if (!lead || lead.stage === 'APROVADO') return;

    if (replyText.includes(product.checkoutUrl)) {
      storage.setLeadStage(phone, 'CHECKOUT');
    } else if (lead.stage === 'NOVO') {
      storage.setLeadStage(phone, 'EM_CONVERSA');
    }
    this.emit('lead:updated', storage.getLead(phone));
  }

  // Send native WhatsApp Interactive Button for 1-click PIX key copying
  async sendPixCopyButton(jid, pixKey, amount, beneficiary) {
    if (!this.sock || !pixKey) return false;
    const phone = jid.split('@')[0];
    try {
      const formattedAmount = Number(amount || 15).toFixed(2).replace('.', ',');

      // 1. Build interactiveMessage with nativeFlow cta_copy button
      const interactiveMessage = proto.Message.InteractiveMessage.create({
        body: proto.Message.InteractiveMessage.Body.create({
          text: `Você também pode tocar no botão abaixo para copiar a chave PIX direto para o seu celular 👇\n\n*Valor:* R$ ${formattedAmount}\n*Nome:* ${beneficiary || 'ian alves dos anjos'}`
        }),
        footer: proto.Message.InteractiveMessage.Footer.create({
          text: `Chave PIX: ${pixKey}`
        }),
        header: proto.Message.InteractiveMessage.Header.create({
          title: 'Pagamento Oficial PIX',
          hasMediaAttachment: false
        }),
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
          buttons: [
            {
              name: 'cta_copy',
              buttonParamsJson: JSON.stringify({
                display_text: '📋 Copiar Chave PIX',
                id: 'pix_key_copy',
                copy_code: pixKey
              })
            }
          ]
        })
      });

      const content = {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2
            },
            interactiveMessage
          }
        }
      };

      const userJid = this.sock.authState?.creds?.me?.id || this.sock.user?.id;
      const msg = generateWAMessageFromContent(jid, content, {
        userJid,
        timestamp: new Date()
      });

      // Inject binary nodes required by WhatsApp to render native flow buttons in private chats
      const isPrivate = !jid.endsWith('@g.us');
      const additionalNodes = [
        {
          tag: 'biz',
          attrs: {},
          content: [{
            tag: 'interactive',
            attrs: {
              type: 'native_flow',
              v: '1'
            },
            content: [{
              tag: 'native_flow',
              attrs: {
                v: '9',
                name: 'mixed'
              }
            }]
          }]
        }
      ];
      if (isPrivate) {
        additionalNodes.push({
          tag: 'bot',
          attrs: { biz_bot: '1' }
        });
      }

      await this.sock.relayMessage(jid, msg.message, {
        messageId: msg.key.id,
        additionalNodes
      });

      const sentMsg = storage.addMessage({
        phone,
        fromMe: true,
        text: `🔘 [Botão Interativo]: Copiar Chave PIX (${pixKey})`,
        type: 'text'
      });
      this.emit('chat:message', sentMsg);
      storage.addLog('SUCCESS', `Botão nativo de copiar Chave PIX enviado com sucesso para ${phone}`);

      return true;
    } catch (btnErr) {
      console.warn('[WhatsApp] Erro ao enviar botão interativo de PIX:', btnErr.message);
      storage.addLog('WARNING', `Tentativa de envio de botão interativo: ${btnErr.message}. Enviando chave limpa.`);
      try {
        await this.sock.sendMessage(jid, { text: pixKey });
        const keyMsg = storage.addMessage({
          phone,
          fromMe: true,
          text: pixKey,
          type: 'text'
        });
        this.emit('chat:message', keyMsg);
      } catch (_) {}
      return false;
    }
  }

  // Send manual message from Dashboard
  async sendManualMessage(phone, text, type = 'text', mediaUrl = null) {
    if (!this.sock || this.status !== 'connected') {
      throw new Error('WhatsApp não está conectado no momento.');
    }

    const jid = await this.resolveJidAsync(phone);
    if (!jid) {
      throw new Error(`JID inválido para o contato: ${phone}`);
    }

    // Cancel any pending AI responses or timers for this lead so AI doesn't talk over the human
    this.cancelPostDeliveryClosing(phone);
    if (this.incomingDebounceMap.has(phone)) {
      const entry = this.incomingDebounceMap.get(phone);
      if (entry?.timer) clearTimeout(entry.timer);
      this.incomingDebounceMap.delete(phone);
    }
    if (this.activeLeadControllers.has(phone)) {
      const activeCtrl = this.activeLeadControllers.get(phone);
      if (activeCtrl && !activeCtrl.signal.aborted) {
        activeCtrl.abort();
        console.log(`[Zapix Manual] Resposta da IA cancelada para ${phone} devido à intervenção manual do atendente.`);
      }
    }

    // Safe presence simulation
    try {
      await this.safePresence(jid, 'composing');
    } catch (_) {}

    // 1. Check if this is a Deliverable tag trigger: [ENVIAR_ARQUIVO: ...] or type === 'deliverable'
    const fileTagRegex = /\[(?:ENVIAR_)?(?:ARQUIVO|IMAGEM|DOCUMENTO|PDF|FOTO|DELIVERABLE):\s*([^\]]+)\]/iu;
    const fileMatch = text ? text.match(fileTagRegex) : null;

    if (fileMatch || type === 'deliverable' || type === 'pdf' || type === 'image') {
      const requestedTag = fileMatch ? fileMatch[1].trim() : (text || '');
      const deliv = resolveDeliverable(requestedTag);

      if (deliv) {
        let fullPath = path.join(UPLOADS_DIR, deliv.filename);
        if (!fs.existsSync(fullPath)) {
          fullPath = path.resolve(DATA_DIR, deliv.path.replace(/^\/?data\//, ''));
        }

        if (fs.existsSync(fullPath)) {
          const fileBuffer = fs.readFileSync(fullPath);
          const isPdf = deliv.type === 'pdf' || deliv.filename.toLowerCase().endsWith('.pdf');
          let cleanFileName = deliv.name || deliv.filename;
          if (isPdf && !cleanFileName.toLowerCase().endsWith('.pdf')) {
            cleanFileName += '.pdf';
          }

          let sentResult = null;
          if (isPdf) {
            sentResult = await this.sock.sendMessage(jid, {
              document: fileBuffer,
              mimetype: 'application/pdf',
              fileName: cleanFileName
            });
          } else {
            sentResult = await this.sock.sendMessage(jid, {
              image: fileBuffer,
              caption: deliv.description || deliv.name
            });
          }

          try { await this.safePresence(jid, 'paused'); } catch (_) {}

          const delivMsg = storage.addMessage({
            id: sentResult?.key?.id,
            phone,
            fromMe: true,
            text: `📎 [Enviado]: ${cleanFileName}`,
            type: deliv.type || (isPdf ? 'pdf' : 'image'),
            mediaUrl: deliv.url,
            status: 'delivered'
          });
          this.emit('chat:message', delivMsg);
          this.emit('lead:updated', storage.getLead(phone));
          storage.addLog('SUCCESS', `Entregável (${cleanFileName}) enviado manualmente para ${phone}`);
          return delivMsg;
        }
      }
    }

    // 2. Check if this is an Audio Pitch tag trigger: [AUDIO: ...] or [Áudio]: "..."
    let manualSpeechText = null;
    if (text) {
      const qMatch = text.match(/\[(?:ENVIAR_?|MANDAR_?|GRAVAR_?)?(?:AUDIO|ÁUDIO)\]:?\s*["'“”«»]([\s\S]*?)["'“”«»]/i);
      if (qMatch) {
        manualSpeechText = qMatch[1].trim();
      } else {
        const bMatch = text.match(/\[(?:ENVIAR_?|MANDAR_?|GRAVAR_?)?(?:AUDIO|ÁUDIO)(?:\s*:|\s*\]:?)\s*([\s\S]*?)(?:\]|$)/i);
        if (bMatch) {
          manualSpeechText = bMatch[1].trim().replace(/^["'“”«»]+|["'“”«»]+$/g, '').trim();
        }
      }
    }

    if (manualSpeechText && manualSpeechText.length > 0) {
      const speechText = manualSpeechText;
      const generatedAudio = await fishAudio.generateSpeech(speechText, null, null, { phone, jid, text: speechText });
      const audioBuffer = fs.readFileSync(generatedAudio.oggPath);
      const waveform = generatedAudio.waveform || await fishAudio.extractWaveform(generatedAudio.oggPath);

      const sentResult = await this.sock.sendMessage(jid, {
        audio: audioBuffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
        waveform
      });

      try { await this.safePresence(jid, 'paused'); } catch (_) {}

      const audioMsg = storage.addMessage({
        id: sentResult?.key?.id,
        phone,
        fromMe: true,
        text: `🎵 [Áudio]: "${speechText}"`,
        type: 'audio',
        mediaUrl: generatedAudio.audioUrl,
        audioDuration: generatedAudio.durationSec,
        status: 'delivered'
      });
      this.emit('chat:message', audioMsg);
      this.emit('lead:updated', storage.getLead(phone));
      storage.addLog('SUCCESS', `Áudio enviado manualmente para ${phone}`);
      return audioMsg;
    }

    // 3. Audio file with mediaUrl
    let sentResult = null;
    if (type === 'audio' && mediaUrl) {
      const audioPath = path.resolve(DATA_DIR, mediaUrl.replace(/^\/audio\//, 'audio_cache/'));
      if (fs.existsSync(audioPath)) {
        const waveform = await fishAudio.extractWaveform(audioPath);
        sentResult = await this.sock.sendMessage(jid, {
          audio: fs.readFileSync(audioPath),
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true,
          waveform
        });
      }
    } else {
      // 4. Regular Text Message
      sentResult = await this.sock.sendMessage(jid, { text });
    }

    try { await this.safePresence(jid, 'paused'); } catch (_) {}

    const msg = storage.addMessage({
      id: sentResult?.key?.id,
      phone,
      fromMe: true,
      text,
      type,
      mediaUrl,
      status: 'delivered'
    });

    this.emit('chat:message', msg);
    this.emit('lead:updated', storage.getLead(phone));
    storage.addLog('SUCCESS', `Mensagem manual enviada com sucesso para ${phone}`);
    return msg;
  }

  // Disconnect & logout
  async disconnect() {
    try {
      if (this.sock) {
        await this.sock.logout();
        this.sock = null;
      }
      this.cleanupAuth();
      this.status = 'disconnected';
      this.connectedNumber = null;
      this.qrCodeDataUrl = null;
      this.emit('whatsapp:status', { status: 'disconnected' });
      storage.addLog('INFO', 'WhatsApp desconectado manualmente.');
      return true;
    } catch (err) {
      console.error('Error disconnecting WhatsApp:', err);
      return false;
    }
  }

  // Resolve correct WhatsApp JID (supports standard phone numbers and modern WhatsApp LIDs)
  resolveJid(phoneOrJid) {
    if (!phoneOrJid) return null;
    const str = String(phoneOrJid).trim();
    if (str.includes('@')) {
      return str;
    }
    let clean = str.replace(/[^0-9]/g, '');
    if (!clean) return null;

    const lead = storage.getLead(clean) || storage.getLead(str);
    if (lead?.jid && String(lead.jid).includes('@')) {
      return lead.jid;
    }
    // WhatsApp Privacy LID heuristic (14+ digits)
    if (clean.length >= 14) {
      return `${clean}@lid`;
    }
    // Brazilian standard mobile numbers without country code 55 (10 or 11 digits)
    if ((clean.length === 10 || clean.length === 11) && !clean.startsWith('55')) {
      clean = `55${clean}`;
    }
    return `${clean}@s.whatsapp.net`;
  }

  // Asynchronous resolver that checks WhatsApp network if necessary
  async resolveJidAsync(phoneOrJid) {
    const syncJid = this.resolveJid(phoneOrJid);
    if (!syncJid) return null;
    if (syncJid.endsWith('@lid')) return syncJid;

    const clean = String(phoneOrJid).replace(/[^0-9]/g, '');
    const lead = storage.getLead(clean) || storage.getLead(phoneOrJid);
    if (lead?.jid && String(lead.jid).includes('@')) return lead.jid;

    if (this.sock && this.status === 'connected') {
      try {
        const checkNumber = syncJid.split('@')[0];
        const [result] = await this.sock.onWhatsApp(checkNumber);
        if (result?.exists && result.jid) {
          if (lead) {
            storage.upsertLead(clean || phoneOrJid, { jid: result.jid });
          }
          return result.jid;
        }
      } catch (_) {}
    }

    return syncJid;
  }

  // Send a voice note directly to a contact (e.g. for Remarketing or manual triggers)
  async sendVoiceNoteDirect(phone, speechText) {
    if (!this.sock || this.status !== 'connected') {
      throw new Error('WhatsApp não está conectado no momento.');
    }
    const jid = await this.resolveJidAsync(phone);
    if (!jid) {
      throw new Error(`JID inválido para o contato: ${phone}`);
    }

    const generatedAudio = await fishAudio.generateSpeech(speechText, null, null, { phone, jid, text: speechText });
    const { thinkingDelay, recordingDelay } = antiBan.calculateAudioRecordingDelay(generatedAudio.durationSec);
    
    await antiBan.sleep(thinkingDelay);
    await this.safePresence(jid, 'recording');
    await antiBan.sleep(recordingDelay);
    await this.safePresence(jid, 'paused');
    if (!this.sock || this.status !== 'connected') {
      throw new Error('Conexão perdida durante gravação.');
    }

    const audioBuffer = fs.readFileSync(generatedAudio.oggPath);
    const waveform = generatedAudio.waveform || await fishAudio.extractWaveform(generatedAudio.oggPath);
    await this.sock.sendMessage(jid, {
      audio: audioBuffer,
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true,
      waveform
    });

    const audioMsg = storage.addMessage({
      phone,
      fromMe: true,
      text: `🎵 [Áudio Remarketing]: "${speechText}"`,
      type: 'audio',
      mediaUrl: generatedAudio.audioUrl,
      audioDuration: generatedAudio.durationSec
    });
    this.emit('chat:message', audioMsg);
    storage.addLog('SUCCESS', `Áudio de Remarketing enviado com sucesso para ${phone}`);
    return { success: true, audioMsg, generatedAudio };
  }

  // Send a text directly to a contact
  async sendTextDirect(phone, text) {
    if (!this.sock || this.status !== 'connected') {
      throw new Error('WhatsApp não está conectado no momento.');
    }
    const jid = await this.resolveJidAsync(phone);
    if (!jid) {
      throw new Error(`JID inválido para o contato: ${phone}`);
    }
    const bubbles = antiBan.splitIntoNaturalBubbles(text);

    for (let i = 0; i < bubbles.length; i++) {
      const bubble = bubbles[i];
      const { baseThinking, typingTime } = antiBan.calculateTypingDelay(bubble);
      await antiBan.sleep(baseThinking);
      await this.safePresence(jid, 'composing');
      await antiBan.sleep(typingTime);
      await this.safePresence(jid, 'paused');

      await this.sock.sendMessage(jid, { text: bubble });
      const sentMsg = storage.addMessage({
        phone,
        fromMe: true,
        text: bubble,
        type: 'text'
      });
      this.emit('chat:message', sentMsg);
      if (i < bubbles.length - 1) await antiBan.sleep(1500);
    }
    return { success: true };
  }

  // Fetch contact profile information (avatar, name) from WhatsApp
  async fetchContactInfo(phone) {
    if (!this.sock) {
      return { phone, error: 'WhatsApp não está conectado no momento' };
    }
    try {
      const jid = await this.resolveJidAsync(phone);
      if (!jid) return { phone, error: 'JID inválido' };
      
      let avatarUrl = null;
      try {
        avatarUrl = await this.sock.profilePictureUrl(jid, 'image').catch(() => null);
      } catch (e) {}

      let pushName = null;
      try {
        const contact = this.sock.contacts?.[jid];
        if (contact && (contact.name || contact.notify)) {
          pushName = contact.name || contact.notify;
        }
      } catch (e) {}

      const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
      const lead = storage.getLead(cleanPhone) || storage.getLead(phone);
      const updated = storage.upsertLead(phone, {
        ...(avatarUrl ? { avatarUrl } : {}),
        ...(pushName ? { name: pushName, pushName } : {})
      });

      this.emit('lead:updated', updated);
      return updated;
    } catch (err) {
      console.warn(`[WhatsApp] Erro ao sincronizar dados de ${phone}:`, err.message);
      return { phone, error: err.message };
    }
  }

  cleanupAuth() {
    if (fs.existsSync(AUTH_DIR)) {
      try {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      } catch (e) {
        console.warn('Could not remove auth directory:', e);
      }
    }
  }
}

export const whatsapp = new WhatsAppService();
