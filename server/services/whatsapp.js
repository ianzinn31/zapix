import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { storage, DATA_DIR, UPLOADS_DIR, AUDIO_CACHE_DIR } from './storage.js';
import { antiBan } from './antiBan.js';
import { nvidiaNim } from './nvidiaNim.js';
import { fishAudio } from './fishAudio.js';
import { audioTranscriber } from './audioTranscriber.js';

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
          } else if (isImage) {
            messageType = 'image';
          } else if (isDocument) {
            messageType = 'document';
          }

          // Build message text for display in chat & logs
          let displayText = messageContent;
          if (isAudio) {
            displayText = messageContent ? `🎵 [Áudio]: "${messageContent}"` : '🎵 [Áudio do Cliente]';
          } else if (isImage) {
            displayText = messageContent ? `📷 [Imagem]: ${messageContent}` : '📷 [Imagem]';
          } else if (isDocument) {
            displayText = messageContent ? `📎 [Arquivo]: ${messageContent}` : '📎 [Arquivo]';
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

        // 2. Check for Voice Audio Tag: [AUDIO: ...]
        const audioTagMatch = replyText.match(/\[AUDIO:\s*([\s\S]*?)\]/i);
        if (audioTagMatch) {
          const audioSpeechText = audioTagMatch[1].trim();
          replyText = replyText.replace(/\[AUDIO:\s*([\s\S]*?)\]/i, '').trim();

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

            // Send native WhatsApp Voice Note (PTT)
            const audioBuffer = fs.readFileSync(generatedAudio.oggPath);
            await this.sock?.sendMessage(jid, {
              audio: audioBuffer,
              mimetype: 'audio/ogg; codecs=opus',
              ptt: true
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

        // Contextual fallback: if customer confirmed purchase or asked for the file and we have deliverables
        if (deliverablesToSend.length === 0) {
          const lowerUser = (userText || '').toLowerCase();
          const lowerReply = (replyText || '').toLowerCase();
          const isPurchaseConfirmed =
            lowerUser.includes('paguei') ||
            lowerUser.includes('comprei') ||
            lowerUser.includes('pix') ||
            lowerUser.includes('comprovante') ||
            lowerUser.includes('pode me enviar') ||
            lowerUser.includes('manda o produto') ||
            lowerReply.includes('obrigado por ter feito sua compra') ||
            lowerReply.includes('aproveite seu produto');

          if (isPurchaseConfirmed) {
            const defaultDeliv = resolveDeliverable('PRODUTO');
            if (defaultDeliv) {
              deliverablesToSend.push(defaultDeliv);
            }
          }
        }

        // CRITICAL: Strip ALL system tags completely from replyText so they are NEVER sent as plain text bubbles!
        replyText = replyText
          .replace(/\[(?:ENVIAR_)?(?:ARQUIVO|IMAGEM|DOCUMENTO|PDF|FOTO|DELIVERABLE):[^\]]*\]/gi, '')
          .replace(/\[AUDIO:[^\]]*\]/gi, '')
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

    // 2. Check if this is an Audio Pitch tag trigger: [AUDIO: ...]
    const audioMatch = text ? text.match(/\[AUDIO:\s*([\s\S]*?)\]/i) : null;
    if (audioMatch) {
      const speechText = audioMatch[1].trim();
      const generatedAudio = await fishAudio.generateSpeech(speechText);
      const audioBuffer = fs.readFileSync(generatedAudio.oggPath);

      await this.sock.sendMessage(jid, {
        audio: audioBuffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true
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

    // 3. Audio file with mediaUrl
    if (type === 'audio' && mediaUrl) {
      const audioPath = path.resolve(DATA_DIR, mediaUrl.replace(/^\/audio\//, 'audio_cache/'));
      if (fs.existsSync(audioPath)) {
        await this.sock.sendMessage(jid, {
          audio: fs.readFileSync(audioPath),
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true
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
