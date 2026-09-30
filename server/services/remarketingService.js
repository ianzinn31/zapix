import { storage } from './storage.js';
import { whatsapp } from './whatsapp.js';
import { fishAudio } from './fishAudio.js';
import { nvidiaNim } from './nvidiaNim.js';
import { antiBan } from './antiBan.js';

class RemarketingService {
  constructor() {
    this.interval = null;
    this.isProcessing = false;
    this.checkIntervalMs = 60 * 1000; // Check every 60 seconds
  }

  init() {
    if (this.interval) return;
    console.log('[Remarketing Service] Inicializando monitor de recuperação e remarketing em áudio...');
    this.interval = setInterval(() => {
      this.checkAndExecuteRemarketing().catch((err) => {
        console.error('[Remarketing Service] Erro no loop de remarketing:', err);
      });
    }, this.checkIntervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  // Check if current local time is within business/safe operating hours (e.g. 08:00 to 22:00)
  isWithinOperatingHours(startHour = 8, endHour = 22) {
    try {
      const now = new Date();
      // Brazil Brasília Time (UTC-3)
      const brTimeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'America/Sao_Paulo',
        hour12: false,
        hour: 'numeric'
      });
      const currentHour = parseInt(brTimeStr, 10);
      return currentHour >= startHour && currentHour < endHour;
    } catch (e) {
      const hour = new Date().getHours();
      return hour >= startHour && hour < endHour;
    }
  }

  // Format dynamic speech script with lead and product variables
  interpolateTemplate(template, lead, product) {
    let text = template || '';
    const firstName = (lead.name || '').split(' ')[0] || '';
    const cleanName = /^[0-9+() -]+$/.test(firstName) ? 'amigo(a)' : firstName;

    text = text.replace(/\{nome\}/gi, cleanName);
    text = text.replace(/\{produto\}/gi, product.name || 'nosso método');
    text = text.replace(/\{preco\}/gi, `R$ ${Number(product.price || 0).toFixed(2)}`);
    text = text.replace(/\{chave_pix\}/gi, product.pixKey || '');
    text = text.replace(/\{link\}/gi, product.checkoutUrl || '');
    return text;
  }

  // Check all leads and trigger overdue remarketing steps
  async checkAndExecuteRemarketing() {
    if (this.isProcessing) return;
    const settings = storage.getSettings();
    const config = settings.remarketing || {};

    if (!config.enabled) return;

    // Safety: WhatsApp must be connected
    const waStatus = whatsapp.getStatus();
    if (waStatus.status !== 'connected') return;

    // Safety: Never send audio during quiet hours (e.g., late night 22:00 - 08:00)
    const startHour = Number(config.startHour ?? 8);
    const endHour = Number(config.endHour ?? 22);
    if (!this.isWithinOperatingHours(startHour, endHour)) {
      return;
    }

    const steps = (config.steps || []).sort((a, b) => (a.delayMinutes || 0) - (b.delayMinutes || 0));
    if (steps.length === 0) return;

    this.isProcessing = true;

    try {
      const leads = storage.getLeads();
      const product = settings.product || {};
      const now = Date.now();

      for (const lead of leads) {
        // 1. Safety check: Lead already paid / approved? NEVER remarket!
        if (lead.stage === 'APROVADO' || lead.lastReceiptStatus === 'APROVADO') {
          continue;
        }

        // 2. Safety check: Operator paused AI for this lead
        if (lead.aiActive === false) {
          continue;
        }

        // 3. Safety check: Check who sent the last message in this conversation
        const messages = storage.getMessages(lead.phone);
        if (!messages || messages.length === 0) continue;

        const lastMsg = messages[messages.length - 1];

        // If the customer was the last one to speak (fromMe === false), they are actively talking to us or waiting for a normal reply!
        // We only trigger remarketing when WE were the last to talk and the customer went silent!
        if (!lastMsg.fromMe) {
          continue;
        }

        const inactivityMs = now - (lastMsg.timestamp || lead.updatedAt || lead.createdAt);
        const inactivityMinutes = inactivityMs / (60 * 1000);

        // Find which step is next for this lead
        const currentStepIndex = typeof lead.lastRemarketingStep === 'number' ? lead.lastRemarketingStep : -1;
        const nextStepIndex = currentStepIndex + 1;

        if (nextStepIndex >= steps.length) {
          // All remarketing touches have already been dispatched for this lead
          continue;
        }

        const step = steps[nextStepIndex];
        const stepDelay = Number(step.delayMinutes || 20);

        // Add human anti-ban jitter (e.g. 2 to 5 min)
        const minJitter = Number(config.minJitterMinutes || 1);
        const maxJitter = Number(config.maxJitterMinutes || 4);
        const jitterMinutes = Math.min(minJitter, maxJitter);

        if (inactivityMinutes < stepDelay + jitterMinutes) {
          // Not enough inactivity time has passed yet
          continue;
        }

        // 4. Funnel Match Check
        const targetFunnel = step.targetFunnel || 'ALL_UNPAID';
        let funnelMatches = false;

        if (targetFunnel === 'ALL_UNPAID') {
          funnelMatches = lead.stage !== 'APROVADO';
        } else if (targetFunnel === 'PIX_OR_ABANDONED') {
          funnelMatches =
            lead.stage === 'CHECKOUT' ||
            lead.stage === 'PITCH_ENVIADO' ||
            lead.lastReceiptStatus === 'AGENDADO' ||
            messages.some((m) => m.fromMe && (m.text?.toLowerCase().includes('pix') || m.text?.toLowerCase().includes('checkout')));
        } else if (targetFunnel === 'NOVO_OU_CONVERSA') {
          funnelMatches = lead.stage === 'NOVO' || lead.stage === 'EM_CONVERSA';
        } else {
          funnelMatches = true;
        }

        if (!funnelMatches) {
          continue;
        }

        // 5. Generate Speech / Text for this Step
        let speechText = '';
        if (step.useAiGeneratedText && step.aiPromptInstruction) {
          const aiSpeech = await nvidiaNim.generateRemarketingSpeech(step.aiPromptInstruction, lead, product);
          if (aiSpeech && aiSpeech.trim().length > 5) {
            speechText = aiSpeech.trim();
          }
        }

        // Fallback to configured audio template
        if (!speechText) {
          speechText = this.interpolateTemplate(step.audioText, lead, product);
        }

        if (!speechText) continue;

        // Clean speech text
        speechText = speechText
          .replace(/\[(?:AUDIO|ÁUDIO):[\s\S]*?\]/gi, '')
          .replace(/["'“”«»]/g, '')
          .trim();

        // 6. Dispatch Remarketing (Audio Preferred)
        const sendAsAudio = step.sendMode === 'audio' || config.preferAudio !== false;

        storage.addLog(
          'INFO',
          `[Remarketing] Disparando ${sendAsAudio ? 'Áudio' : 'Texto'} (Etapa ${nextStepIndex + 1}: ${step.name}) para ${lead.name || lead.phone}...`
        );

        let dispatchSuccess = false;

        if (sendAsAudio) {
          try {
            await whatsapp.sendVoiceNoteDirect(lead.phone, speechText);
            dispatchSuccess = true;
          } catch (audioErr) {
            console.error(`[Remarketing] Falha ao enviar áudio para ${lead.phone}, enviando texto de fallback:`, audioErr.message);
            // Fallback to text delivery if audio generation encounters an issue
            try {
              await whatsapp.sendTextDirect(lead.phone, speechText);
              dispatchSuccess = true;
            } catch (txtErr) {
              console.error(`[Remarketing] Falha no fallback de texto para ${lead.phone}:`, txtErr.message);
            }
          }
        } else {
          try {
            await whatsapp.sendTextDirect(lead.phone, speechText);
            dispatchSuccess = true;
          } catch (txtErr) {
            console.error(`[Remarketing] Falha no envio de texto para ${lead.phone}:`, txtErr.message);
          }
        }

        // 7. Update lead remarketing history and stage
        if (dispatchSuccess) {
          const remarketingHistory = lead.remarketingHistory || [];
          remarketingHistory.push({
            stepIndex: nextStepIndex,
            stepId: step.id,
            stepName: step.name,
            sentAt: Date.now(),
            speechText,
            mode: sendAsAudio ? 'audio' : 'text'
          });

          storage.upsertLead(lead.phone, {
            lastRemarketingStep: nextStepIndex,
            lastRemarketingAt: Date.now(),
            remarketingHistory
          });

          whatsapp.emit('lead:updated', storage.getLead(lead.phone));
          whatsapp.emit('remarketing:step_sent', {
            phone: lead.phone,
            stepName: step.name,
            stepIndex: nextStepIndex,
            mode: sendAsAudio ? 'audio' : 'text'
          });

          // Natural human pause between remarketing executions to protect WhatsApp number
          await antiBan.sleep(4000);
        }
      }
    } catch (err) {
      console.error('[Remarketing Service] Erro geral ao processar fila:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  // Test an individual step immediately on a test phone number
  async testStep(stepId, targetPhone) {
    if (!whatsapp.sock || whatsapp.status !== 'connected') {
      throw new Error('WhatsApp não está conectado no momento.');
    }

    const settings = storage.getSettings();
    const config = settings.remarketing || {};
    const product = settings.product || {};
    const steps = config.steps || [];
    const step = steps.find((s) => s.id === stepId) || steps[0];

    if (!step) {
      throw new Error('Nenhuma etapa de remarketing encontrada.');
    }

    const cleanPhone = (targetPhone || '').replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error('Número de WhatsApp de teste inválido.');
    }

    let dummyLead = storage.getLead(cleanPhone) || {
      phone: cleanPhone,
      name: 'Cliente Teste'
    };

    let speechText = '';
    if (step.useAiGeneratedText && step.aiPromptInstruction) {
      const aiSpeech = await nvidiaNim.generateRemarketingSpeech(step.aiPromptInstruction, dummyLead, product);
      if (aiSpeech && aiSpeech.trim().length > 5) {
        speechText = aiSpeech.trim();
      }
    }

    if (!speechText) {
      speechText = this.interpolateTemplate(step.audioText, dummyLead, product);
    }

    speechText = speechText
      .replace(/\[(?:AUDIO|ÁUDIO):[\s\S]*?\]/gi, '')
      .replace(/["'“”«»]/g, '')
      .trim();

    const sendAsAudio = step.sendMode === 'audio' || config.preferAudio !== false;

    if (sendAsAudio) {
      return await whatsapp.sendVoiceNoteDirect(cleanPhone, speechText);
    } else {
      return await whatsapp.sendTextDirect(cleanPhone, speechText);
    }
  }

  // Synthesize audio preview for UI playback (no WhatsApp sending required)
  async previewAudio(text) {
    if (!text || text.trim().length === 0) {
      throw new Error('Texto para geração de áudio não pode ser vazio.');
    }
    const cleanText = text
      .replace(/\[(?:AUDIO|ÁUDIO):[\s\S]*?\]/gi, '')
      .replace(/["'“”«»]/g, '')
      .trim();
    return await fishAudio.generateSpeech(cleanText);
  }
}

export const remarketingService = new RemarketingService();
