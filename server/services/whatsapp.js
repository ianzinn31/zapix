import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  downloadMediaMessage
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

  // Initialize and connect WhatsApp socket
  async initialize() {
    if (this.isInitializing) return;
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
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.connectedNumber = null;
          this.status = 'disconnected';
          this.emit('whatsapp:status', { status: 'disconnected' });

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
                    // Update lead with receipt analysis
                    storage.updateLead(phone, {
                      lastReceiptStatus: analysis.status,
                      lastReceiptAmount: analysis.amount,
                      lastReceiptBank: analysis.bank,
                      lastReceiptDate: Date.now(),
                      lastReceiptSummary: analysis.reason,
                      lastReceiptExplanation: analysis.customerExplanation
                    });

                    if (analysis.isBankReceipt) {
                      messageContent = `[COMPROVANTE DE PAGAMENTO ANALISADO]:
- Status: ${analysis.status}
- Banco: ${analysis.bank || 'Não identificado'}
- Valor identificado: ${analysis.amount ? `R$ ${analysis.amount}` : 'Não identificado'}
- Efetivado?: ${analysis.shouldReleaseProduct ? 'SIM (Liberar produto)' : 'NÃO (NÃO LIBERAR)'}
- Detalhes: ${analysis.reason}
- Instrução para sua resposta: ${
                        analysis.status === 'AGENDADO'
                          ? 'Explique com simpatia que você viu o comprovante, mas ele é um AGENDAMENTO (o dinheiro ainda não caiu). Oriente o cliente a cancelar o agendamento no aplicativo do banco e fazer a transferência imediata na hora para que o sistema possa liberar o produto imediatamente.'
                          : analysis.status === 'APROVADO'
                          ? 'Agradeça pelo pagamento confirmado e envie o produto com a tag do entregável.'
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

          // Ensure lead exists with their actual WhatsApp pushName
          if (pushName && !fromMe) {
            storage.upsertLead(phone, { name: pushName, pushName });
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
            // Trigger AI Sales Agent with Anti-Ban & Human Simulation
            this.handleAiResponse(phone, jid, aiInput);
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
    antiBan.enqueueForLead(phone, async () => {
      try {
        const lead = storage.getLead(phone);
        // Double check if operator paused AI in the meantime
        if (lead && lead.aiActive === false) return;

        // Fetch recent conversation history
        const history = storage.getMessages(phone);

        // 1. Generate AI Response via NVIDIA NIM (with automatic fallback)
        const aiResult = await nvidiaNim.generateResponse(phone, userText, history);
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
        const quotedRegex = /\[(?:ENVIAR_?|MANDAR_?|GRAVAR_?)?(?:AUDIO|ÁUDIO)\]:?\s*["'“”«»]([\s\S]*?)["'“”«»]/i;
        const quotedMatch = replyText.match(quotedRegex);

        if (quotedMatch) {
          audioSpeechText = quotedMatch[1].trim();
          replyText = replyText.replace(quotedMatch[0], '').trim();
        } else {
          const bracketRegex = /\[(?:ENVIAR_?|MANDAR_?|GRAVAR_?)?(?:AUDIO|ÁUDIO)(?:\s*:|\s*\]:?)\s*([\s\S]*?)(?:\]|$)/i;
          const bracketMatch = replyText.match(bracketRegex);
          if (bracketMatch) {
            audioSpeechText = bracketMatch[1].trim().replace(/^["'“”«»]+|["'“”«»]+$/g, '').trim();
            replyText = replyText.replace(bracketMatch[0], '').trim();
          }
        }

        // Clean any remaining audio tag remnants from replyText so they NEVER leak as plain text bubbles
        replyText = replyText
          .replace(/\[(?:ENVIAR_?|MANDAR_?|GRAVAR_?)?(?:AUDIO|ÁUDIO)(?:\s*:|\s*\]:?)[\s\S]*?(?:\]|$)/gi, '')
          .trim();

        if (audioSpeechText && audioSpeechText.length > 0) {
            // Generate audio via Fish Audio TTS
            try {
              const generatedAudio = await fishAudio.generateSpeech(audioSpeechText);

              // Anti-ban: Simulate human recording voice note
              const { thinkingDelay, recordingDelay } = antiBan.calculateAudioRecordingDelay(generatedAudio.durationSec);
              await antiBan.sleep(thinkingDelay);

              // WhatsApp presence: 'recording'
              await this.sock?.sendPresenceUpdate('recording', jid);
              await antiBan.sleep(recordingDelay);
              await this.sock?.sendPresenceUpdate('paused', jid);

              // Send native WhatsApp Voice Note (PTT) with animated waveform
              const audioBuffer = fs.readFileSync(generatedAudio.oggPath);
              const waveform = generatedAudio.waveform || await fishAudio.extractWaveform(generatedAudio.oggPath);
              await this.sock?.sendMessage(jid, {
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
        }

        // 3. Check for Deliverable Tags: [ENVIAR_ARQUIVO: tag], [ENVIAR_IMAGEM: tag], [PDF: tag], etc.
        const fileTagRegex = /\[(?:ENVIAR_)?(?:ARQUIVO|IMAGEM|DOCUMENTO|PDF|FOTO|DELIVERABLE):\s*([^\]]+)\]/gi;
        const tagMatches = [...replyText.matchAll(fileTagRegex)];
        const deliverablesToSend = [];

        for (const m of tagMatches) {
          const reqTag = m[1].trim();
          const resolved = resolveDeliverable(reqTag);
          if (resolved && !deliverablesToSend.some((d) => d.id === resolved.id)) {
            deliverablesToSend.push(resolved);
          }
        }

        // 3. Antifraud & Delivery Strategy Engine
        const settings = storage.getSettings();
        const product = settings.product || {};
        const deliveryStrategy = product.deliveryStrategy || 'require_payment'; // 'require_payment' | 'deliver_first' | 'per_deliverable'
        const leadObj = storage.getLead(phone);

        // Filter deliverables based on the chosen strategy
        const verifiedDeliverables = deliverablesToSend.filter((deliv) => {
          // If operation strategy is 'deliver_first' (entrega antes e cobra depois)
          if (deliveryStrategy === 'deliver_first') {
            return true; // Allowed to send before payment!
          }

          // If operation strategy is 'per_deliverable'
          if (deliveryStrategy === 'per_deliverable') {
            if (deliv.requirePayment === false) {
              return true; // Freebie / Sample / Lead magnet - allowed before payment!
            }
          }

          // Otherwise (require_payment or paid deliverable):
          // Check if lead sent a fake or scheduled receipt
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

        // Contextual fallback: if customer asked for the file or confirmed purchase
        if (deliverablesToSend.length === 0) {
          const lowerUser = (userText || '').toLowerCase();
          const lowerReply = (replyText || '').toLowerCase();

          // Strategy A: 'deliver_first' -> allow sending sample / product if customer wants it, before charging!
          if (deliveryStrategy === 'deliver_first') {
            const wantsFile =
              lowerUser.includes('amostra') ||
              lowerUser.includes('receita') ||
              lowerUser.includes('material') ||
              lowerUser.includes('manda') ||
              lowerUser.includes('envia') ||
              lowerUser.includes('quero') ||
              lowerUser.includes('pode me enviar') ||
              lowerReply.includes('vou te enviar') ||
              lowerReply.includes('aqui está') ||
              lowerReply.includes('estou enviando');

            if (wantsFile) {
              const defaultDeliv = resolveDeliverable('AMOSTRA') || resolveDeliverable('PRODUTO') || storage.getDeliverables()[0];
              if (defaultDeliv) {
                deliverablesToSend.push(defaultDeliv);
              }
            }
          } else {
            // Strategy B: 'require_payment' or 'per_deliverable' -> only release paid product if receipt is APROVADO
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

        // CRITICAL: Strip ALL system tags completely from replyText so they are NEVER sent as plain text bubbles!
        replyText = replyText
          .replace(/\[(?:ENVIAR_)?(?:ARQUIVO|IMAGEM|DOCUMENTO|PDF|FOTO|DELIVERABLE):[\s\S]*?(?:\]|$)/gi, '')
          .replace(/\[(?:ENVIAR_?|MANDAR_?|GRAVAR_?)?(?:AUDIO|ÁUDIO)(?:\s*:|\s*\]:?)[\s\S]*?(?:\]|$)/gi, '')
          .replace(/\[(?:AUDIO|ÁUDIO)\]:?\s*["'“”«»][\s\S]*?["'“”«»]/gi, '')
          .trim();

        // 4. Send Text Messages with Natural Anti-Ban Bubbles & Typing Simulation
        if (replyText && replyText.length > 0) {
          const bubbles = antiBan.splitIntoNaturalBubbles(replyText);

          for (let i = 0; i < bubbles.length; i++) {
            const bubble = bubbles[i];
            const { baseThinking, typingTime } = antiBan.calculateTypingDelay(bubble);

            // Thinking pause (human reading / deciding)
            await antiBan.sleep(baseThinking);

            // Typing presence update
            await this.sock?.sendPresenceUpdate('composing', jid);
            await antiBan.sleep(typingTime);
            await this.sock?.sendPresenceUpdate('paused', jid);

            // Send bubble
            await this.sock?.sendMessage(jid, { text: bubble });

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
              await antiBan.sleep(1500);
            }
          }
        }

        // 5. Send Deliverable(s) if triggered
        for (const deliverableToSend of deliverablesToSend) {
          await antiBan.sleep(2000);
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
              await this.sock?.sendMessage(jid, {
                document: fileBuffer,
                mimetype: 'application/pdf',
                fileName: cleanFileName
              });
            } else {
              await this.sock?.sendMessage(jid, {
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

        // Auto-update lead funnel stage based on conversation progress
        this.updateFunnelStage(phone, replyText);

      } catch (err) {
        console.error(`Error in handleAiResponse for ${phone}:`, err);
        storage.addLog('ERROR', `Erro ao responder ${phone}: ${err.message}`);
      }
    });
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

  // Send manual message from Dashboard
  async sendManualMessage(phone, text, type = 'text', mediaUrl = null) {
    if (!this.sock || this.status !== 'connected') {
      throw new Error('WhatsApp não está conectado.');
    }

    const jid = `${phone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

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

          if (isPdf) {
            await this.sock.sendMessage(jid, {
              document: fileBuffer,
              mimetype: 'application/pdf',
              fileName: cleanFileName
            });
          } else {
            await this.sock.sendMessage(jid, {
              image: fileBuffer,
              caption: deliv.description || deliv.name
            });
          }

          const delivMsg = storage.addMessage({
            phone,
            fromMe: true,
            text: `📎 [Enviado]: ${cleanFileName}`,
            type: deliv.type || (isPdf ? 'pdf' : 'image'),
            mediaUrl: deliv.url
          });
          this.emit('chat:message', delivMsg);
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
        const generatedAudio = await fishAudio.generateSpeech(speechText);
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
          text: `🎵 [Áudio]: "${speechText}"`,
          type: 'audio',
          mediaUrl: generatedAudio.audioUrl,
          audioDuration: generatedAudio.durationSec
        });
        this.emit('chat:message', audioMsg);
        storage.addLog('SUCCESS', `Áudio enviado manualmente para ${phone}`);
        return audioMsg;
      }
    }

    // 3. Audio file with mediaUrl
    if (type === 'audio' && mediaUrl) {
      const audioPath = path.resolve(DATA_DIR, mediaUrl.replace(/^\/audio\//, 'audio_cache/'));
      if (fs.existsSync(audioPath)) {
        const waveform = await fishAudio.extractWaveform(audioPath);
        await this.sock.sendMessage(jid, {
          audio: fs.readFileSync(audioPath),
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true,
          waveform
        });
      }
    } else {
      // 4. Regular Text Message
      await this.sock.sendMessage(jid, { text });
    }

    const msg = storage.addMessage({
      phone,
      fromMe: true,
      text,
      type,
      mediaUrl
    });

    this.emit('chat:message', msg);
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

  // Send a voice note directly to a contact (e.g. for Remarketing or manual triggers)
  async sendVoiceNoteDirect(phone, speechText) {
    if (!this.sock || this.status !== 'connected') {
      throw new Error('WhatsApp não está conectado no momento.');
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;

    const generatedAudio = await fishAudio.generateSpeech(speechText);
    const { thinkingDelay, recordingDelay } = antiBan.calculateAudioRecordingDelay(generatedAudio.durationSec);
    
    await antiBan.sleep(thinkingDelay);
    await this.sock.sendPresenceUpdate('recording', jid);
    await antiBan.sleep(recordingDelay);
    await this.sock.sendPresenceUpdate('paused', jid);

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
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;
    const bubbles = antiBan.splitIntoNaturalBubbles(text);

    for (let i = 0; i < bubbles.length; i++) {
      const bubble = bubbles[i];
      const { baseThinking, typingTime } = antiBan.calculateTypingDelay(bubble);
      await antiBan.sleep(baseThinking);
      await this.sock.sendPresenceUpdate('composing', jid);
      await antiBan.sleep(typingTime);
      await this.sock.sendPresenceUpdate('paused', jid);

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
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const jid = `${cleanPhone}@s.whatsapp.net`;
      
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
