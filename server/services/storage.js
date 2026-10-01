import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseService } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const AUDIO_CACHE_DIR = path.join(DATA_DIR, 'audio_cache');
const MEDIA_CACHE_DIR = path.join(DATA_DIR, 'media_cache');

// Ensure necessary directories exist
[DATA_DIR, UPLOADS_DIR, AUDIO_CACHE_DIR, MEDIA_CACHE_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const DEFAULT_STATE = {
  settings: {
    ai: {
      primaryModel: 'z-ai/glm-5.3-flash',
      primaryApiKey: process.env.NVIDIA_NIM_PRIMARY_API_KEY || '',
      fallbackModel: 'google/diffusiongemma-26b-a4b-it',
      fallbackApiKey: process.env.NVIDIA_NIM_FALLBACK_API_KEY || '',
      temperature: 0.7,
      maxTokens: 1500,
      isFallbackActive: false,
      lastFallbackReason: null,
      customPromptInstructions: ''
    },
    fishAudio: {
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY || process.env.FISH_AUDIO_API_KEY || '',
      model: 'fish-audio/s2.1-pro-free:free',
      voiceId: process.env.FISH_AUDIO_VOICE_ID || '7f92f8afb8ec43bf81429cc1c9199cb1',
      enabled: true,
      autoAudioMode: 'hybrid_high_conversion',
      speed: 0.92
    },
    antiBan: {
      minThinkingDelay: 1800, // 1.8s
      maxThinkingDelay: 4200, // 4.2s
      charDelayMin: 22, // 22ms per char
      charDelayMax: 48, // 48ms per char
      splitBubbles: true,
      maxCharsPerBubble: 220,
      sendComposing: true,
      sendRecording: true,
      minIntervalBetweenMessages: 1200,
      safetyPauseEveryXMessages: 8,
      safetyPauseDurationMs: 6000
    },
    metaAds: {
      accessToken: process.env.META_ACCESS_TOKEN || '',
      adAccountId: process.env.META_AD_ACCOUNT_ID || '',
      manualSpend: 0.00,
      autoSync: false,
      lastSyncedAt: null
    },
    transcription: {
      provider: 'groq',
      apiKey: process.env.GROQ_API_KEY || '',
      model: 'whisper-large-v3',
      language: 'pt',
      enabled: true
    },
    vision: {
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: 'google/gemini-2.5-flash',
      fallbackModel: 'meta/llama-3.2-11b-vision-instruct',
      enabled: true,
      autoValidatePix: true,
      blockDeliverablesOnPending: true
    },
    product: {
      name: '',
      niche: '',
      targetAudience: '',
      price: 0,
      currency: 'BRL',
      paymentMethod: 'both', // 'checkout' | 'pix' | 'both'
      deliveryStrategy: 'require_payment', // 'require_payment' | 'deliver_first' | 'per_deliverable'
      deliveryInstructions: '',
      checkoutUrl: '',
      pixKey: '',
      pixKeyType: 'aleatoria', // 'aleatoria' | 'cpf' | 'cnpj' | 'email' | 'telefone'
      pixBeneficiary: '',
      pixInstructions: 'Enviar o comprovante aqui no WhatsApp para liberação imediata do acesso.',
      guaranteeDays: 7,
      mainPainPoints: [],
      mainBenefits: [],
      objections: [],
      defaultAudioPitchText: ''
    },
    remarketing: {
      enabled: true,
      preferAudio: true, // "todos os nossos remarketing devem ser de preferencia em audio"
      startHour: 8,      // 08:00
      endHour: 22,       // 22:00
      minJitterMinutes: 2, // Variação humana de tempo
      maxJitterMinutes: 6,
      steps: [
        {
          id: 'step-1',
          name: '1º Toque: Suporte no PIX / Dificuldade no App',
          delayMinutes: 20,
          sendMode: 'audio',
          targetFunnel: 'PIX_OR_ABANDONED',
          audioText: 'Opa, tudo bem? Tô passando aqui rapidinho só pra saber se você conseguiu abrir o app do banco ou se deu algum errinho no PIX. Qualquer coisa me dá um alô aqui que eu te ajudo!',
          useAiGeneratedText: true,
          aiPromptInstruction: 'Pergunte com simpatia se o lead teve alguma dificuldade no aplicativo do banco para concluir o PIX e ofereça ajuda.'
        },
        {
          id: 'step-2',
          name: '2º Toque: Escassez & Condição Promocional (2h)',
          delayMinutes: 120,
          sendMode: 'audio',
          targetFunnel: 'PIX_OR_ABANDONED',
          audioText: 'Oi! Passando só pra te avisar que eu consegui segurar aquela condição promocional de R$ 37,90 pra você até o fim do dia. Se você ainda quiser aproveitar, me avisa pra eu já liberar seu acesso na hora!',
          useAiGeneratedText: true,
          aiPromptInstruction: 'Avise que segurou o valor promocional do produto até o final do dia e pergunte se ele quer aproveitar para liberar o acesso imediato.'
        },
        {
          id: 'step-3',
          name: '3º Toque: Reengajamento & Prova Social (24h)',
          delayMinutes: 1440,
          sendMode: 'audio',
          targetFunnel: 'ALL_UNPAID',
          audioText: 'Oi! Tudo bem com você? Tava lembrando da nossa conversa aqui e queria ver como você tá. Você ainda tem interesse nas receitas de doces saudáveis? Muita gente tá amando os resultados!',
          useAiGeneratedText: true,
          aiPromptInstruction: 'Fale de forma calorosa no dia seguinte perguntando se o lead ainda quer transformar a rotina com o método e se ficou alguma dúvida.'
        }
      ]
    }
  },
  leads: {},
  messages: [],
  deliverables: [],
  sales: [],
  systemLogs: []
};

class StorageService {
  constructor() {
    this.data = this.loadData();
    this.initSupabaseSync();
  }

  async initSupabaseSync() {
    if (supabaseService.isConfigured) {
      try {
        console.log('[Storage] Sincronizando dados com Supabase...');
        const [cloudSettings, cloudLeads, cloudMessages, cloudDeliverables, cloudSales] = await Promise.all([
          supabaseService.getSettings(),
          supabaseService.getLeads(),
          supabaseService.getMessages(),
          supabaseService.getDeliverables(),
          supabaseService.getSales()
        ]);

        if (cloudSettings) {
          this.data.settings = { ...this.data.settings, ...cloudSettings };
          // Ensure real credentials from env are linked if blank
          if (!this.data.settings.ai.primaryApiKey && process.env.NVIDIA_NIM_PRIMARY_API_KEY) {
            this.data.settings.ai.primaryApiKey = process.env.NVIDIA_NIM_PRIMARY_API_KEY;
          }
          if (!this.data.settings.ai.fallbackApiKey && process.env.NVIDIA_NIM_FALLBACK_API_KEY) {
            this.data.settings.ai.fallbackApiKey = process.env.NVIDIA_NIM_FALLBACK_API_KEY;
          }
          if (!this.data.settings.fishAudio.apiKey && process.env.OPENROUTER_API_KEY) {
            this.data.settings.fishAudio.apiKey = process.env.OPENROUTER_API_KEY;
          }
          if (!this.data.settings.transcription?.apiKey && process.env.GROQ_API_KEY) {
            if (!this.data.settings.transcription) {
              this.data.settings.transcription = { ...DEFAULT_STATE.settings.transcription };
            }
            this.data.settings.transcription.apiKey = process.env.GROQ_API_KEY;
          }
          // Upgrade deprecated model names to current active NVIDIA models
          if (this.data.settings.ai.primaryModel === 'meta/llama-3.3-70b-instruct' || !this.data.settings.ai.primaryModel) {
            this.data.settings.ai.primaryModel = 'meta/llama-3.2-11b-vision-instruct';
          }
          if (this.data.settings.ai.fallbackModel === 'mistralai/mixtral-8x22b-instruct' || !this.data.settings.ai.fallbackModel) {
            this.data.settings.ai.fallbackModel = 'meta/llama-3.2-11b-vision-instruct';
          }
          await supabaseService.saveSettings(this.data.settings);
        } else {
          await supabaseService.saveSettings(this.data.settings);
        }

        this.data.leads = {};
        if (cloudLeads && cloudLeads.length > 0) {
          cloudLeads.forEach((l) => { this.data.leads[l.phone] = l; });
        }

        this.data.messages = cloudMessages || [];
        this.data.deliverables = cloudDeliverables || [];
        this.data.sales = cloudSales || [];

        this.save();
        console.log('[Storage] Sincronização com Supabase concluída com sucesso!');
      } catch (err) {
        console.warn('[Storage] Erro na sincronização com Supabase:', err.message);
      }
    }
  }

  loadData() {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Deep merge with DEFAULT_STATE to guarantee all properties exist
        return {
          ...DEFAULT_STATE,
          ...parsed,
          settings: {
            ...DEFAULT_STATE.settings,
            ...(parsed.settings || {}),
            ai: { ...DEFAULT_STATE.settings.ai, ...(parsed.settings?.ai || {}) },
            fishAudio: { ...DEFAULT_STATE.settings.fishAudio, ...(parsed.settings?.fishAudio || {}) },
            transcription: { ...DEFAULT_STATE.settings.transcription, ...(parsed.settings?.transcription || {}) },
            antiBan: { ...DEFAULT_STATE.settings.antiBan, ...(parsed.settings?.antiBan || {}) },
            metaAds: { ...DEFAULT_STATE.settings.metaAds, ...(parsed.settings?.metaAds || {}) },
            vision: { ...DEFAULT_STATE.settings.vision, ...(parsed.settings?.vision || {}) },
            product: { ...DEFAULT_STATE.settings.product, ...(parsed.settings?.product || {}) },
            remarketing: { ...DEFAULT_STATE.settings.remarketing, ...(parsed.settings?.remarketing || {}) }
          },
          leads: parsed.leads || DEFAULT_STATE.leads,
          messages: parsed.messages || DEFAULT_STATE.messages,
          deliverables: parsed.deliverables || DEFAULT_STATE.deliverables,
          sales: parsed.sales || DEFAULT_STATE.sales,
          systemLogs: parsed.systemLogs || DEFAULT_STATE.systemLogs
        };
      }
    } catch (err) {
      console.error('Error loading store.json, using defaults:', err);
    }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  save() {
    try {
      const tempPath = `${STORE_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, STORE_FILE);
    } catch (err) {
      console.error('Error saving store.json:', err);
    }
  }

  // Settings
  getSettings() {
    return this.data.settings;
  }

  updateSettings(partialSettings) {
    if (partialSettings.ai) {
      this.data.settings.ai = { ...this.data.settings.ai, ...partialSettings.ai };
    }
    if (partialSettings.fishAudio) {
      this.data.settings.fishAudio = { ...this.data.settings.fishAudio, ...partialSettings.fishAudio };
    }
    if (partialSettings.transcription) {
      this.data.settings.transcription = { ...this.data.settings.transcription, ...partialSettings.transcription };
    }
    if (partialSettings.antiBan) {
      this.data.settings.antiBan = { ...this.data.settings.antiBan, ...partialSettings.antiBan };
    }
    if (partialSettings.metaAds) {
      this.data.settings.metaAds = { ...this.data.settings.metaAds, ...partialSettings.metaAds };
    }
    if (partialSettings.vision) {
      this.data.settings.vision = { ...this.data.settings.vision, ...partialSettings.vision };
    }
    if (partialSettings.product) {
      this.data.settings.product = { ...this.data.settings.product, ...partialSettings.product };
    }
    if (partialSettings.remarketing) {
      this.data.settings.remarketing = { ...this.data.settings.remarketing, ...partialSettings.remarketing };
    }
    this.save();
    supabaseService.saveSettings(this.data.settings);
    return this.data.settings;
  }

  // Leads
  getLeads() {
    return Object.values(this.data.leads).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  getLead(phone) {
    return this.data.leads[phone] || null;
  }

  upsertLead(phone, updates = {}) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const existing = this.data.leads[phone] || this.data.leads[cleanPhone] || {
      id: phone,
      phone,
      name: phone.replace(/[^0-9]/g, ''),
      stage: 'NOVO', // NOVO | EM_CONVERSA | PITCH_ENVIADO | CHECKOUT | APROVADO | PERDIDO
      aiActive: true,
      tags: [],
      createdAt: Date.now(),
      unreadCount: 0
    };

    // If existing name is just the raw numbers and updates provides a friendly name, prioritize the friendly name
    let name = updates.name || existing.name;
    const existingIsDigits = /^[0-9+() -]+$/.test(existing.name || '');
    if (updates.name && existingIsDigits && !/^[0-9+() -]+$/.test(updates.name)) {
      name = updates.name;
    }

    const updated = {
      ...existing,
      ...updates,
      name,
      updatedAt: Date.now()
    };

    this.data.leads[phone] = updated;
    this.save();
    supabaseService.upsertLead(updated);
    return updated;
  }

  deleteLead(phone) {
    if (!phone) return false;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    delete this.data.leads[phone];
    if (this.data.leads[cleanPhone]) delete this.data.leads[cleanPhone];

    // Remove all associated messages
    this.data.messages = this.data.messages.filter((m) => {
      const mClean = (m.phone || '').replace(/[^0-9]/g, '');
      return mClean !== cleanPhone && m.phone !== phone;
    });

    this.save();
    supabaseService.deleteLead(phone);
    supabaseService.deleteMessagesByPhone(phone);
    return true;
  }

  setLeadAiActive(phone, isActive) {
    if (this.data.leads[phone]) {
      this.data.leads[phone].aiActive = isActive;
      this.data.leads[phone].updatedAt = Date.now();
      this.save();
      supabaseService.upsertLead(this.data.leads[phone]);
      return this.data.leads[phone];
    }
    return null;
  }

  setLeadStage(phone, stage) {
    if (this.data.leads[phone]) {
      this.data.leads[phone].stage = stage;
      this.data.leads[phone].updatedAt = Date.now();
      this.save();
      supabaseService.upsertLead(this.data.leads[phone]);
      return this.data.leads[phone];
    }
    return null;
  }

  // Messages
  getMessages(phone) {
    if (!phone) return this.data.messages;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return this.data.messages.filter((m) => {
      const mPhone = m.phone.replace(/[^0-9]/g, '');
      return mPhone.includes(cleanPhone) || cleanPhone.includes(mPhone);
    });
  }

  addMessage(msg) {
    const newMsg = {
      id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      phone: msg.phone,
      fromMe: Boolean(msg.fromMe),
      text: msg.text || '',
      type: msg.type || 'text', // text | audio | image | document
      mediaUrl: msg.mediaUrl || null,
      audioDuration: msg.audioDuration || null,
      timestamp: msg.timestamp || Date.now(),
      status: msg.status || 'delivered'
    };

    this.data.messages.push(newMsg);

    // Keep last 3,000 messages in store for optimal speed
    if (this.data.messages.length > 3000) {
      this.data.messages = this.data.messages.slice(-3000);
    }

    // Update lead last message
    if (msg.phone) {
      this.upsertLead(msg.phone, {
        lastMessage: msg.text || (msg.type === 'audio' ? '🎵 [Áudio]' : '📎 [Arquivo]'),
        lastMessageFromMe: Boolean(msg.fromMe),
        unreadCount: msg.fromMe ? 0 : ((this.data.leads[msg.phone]?.unreadCount || 0) + 1)
      });
    }

    this.save();
    supabaseService.addMessage(newMsg);
    return newMsg;
  }

  // Deliverables
  getDeliverables() {
    return this.data.deliverables;
  }

  addDeliverable(deliv) {
    const newDeliv = {
      id: `deliv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: deliv.name,
      filename: deliv.filename,
      type: deliv.type || 'pdf',
      tag: deliv.tag || deliv.name.toUpperCase().replace(/\s+/g, '_'),
      description: deliv.description || '',
      requirePayment: deliv.requirePayment !== undefined ? Boolean(deliv.requirePayment) : true,
      url: deliv.url,
      path: deliv.path,
      size: deliv.size || 0,
      createdAt: Date.now()
    };
    this.data.deliverables.push(newDeliv);
    this.save();
    supabaseService.addDeliverable(newDeliv);
    return newDeliv;
  }

  updateDeliverable(id, updates = {}) {
    const index = this.data.deliverables.findIndex((d) => d.id === id);
    if (index !== -1) {
      this.data.deliverables[index] = {
        ...this.data.deliverables[index],
        ...updates
      };
      this.save();
      supabaseService.addDeliverable(this.data.deliverables[index]);
      return this.data.deliverables[index];
    }
    return null;
  }

  deleteDeliverable(id) {
    this.data.deliverables = this.data.deliverables.filter((d) => d.id !== id);
    this.save();
    supabaseService.deleteDeliverable(id);
    return true;
  }

  // Sales
  getSales() {
    return this.data.sales.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  addSale(sale) {
    const newSale = {
      id: sale.id || `sale-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      leadId: sale.leadId || (sale.phone ? `${sale.phone}@s.whatsapp.net` : null),
      phone: sale.phone || '',
      customerName: sale.customerName || 'Cliente WhatsApp',
      amount: Number(sale.amount) || Number(this.data.settings.product.price) || 97.00,
      platform: sale.platform || 'Kiwify',
      status: 'approved',
      createdAt: sale.createdAt || Date.now()
    };

    this.data.sales.push(newSale);

    // If matching lead exists, change status to APROVADO
    if (sale.phone && this.data.leads[sale.phone]) {
      this.upsertLead(sale.phone, { stage: 'APROVADO' });
    }

    this.addLog('SUCCESS', `Venda Aprovada! R$ ${newSale.amount.toFixed(2)} - ${newSale.customerName} (${newSale.platform})`);
    this.save();
    supabaseService.addSale(newSale);
    return newSale;
  }

  // Logs
  getLogs(limit = 100) {
    return this.data.systemLogs.slice(-limit).reverse();
  }

  addLog(type, message, meta = null) {
    const logItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: Date.now(),
      type, // INFO | SUCCESS | WARNING | ERROR | FALLBACK_TRIGGERED
      message,
      meta
    };
    this.data.systemLogs.push(logItem);
    if (this.data.systemLogs.length > 500) {
      this.data.systemLogs = this.data.systemLogs.slice(-500);
    }
    this.save();
    supabaseService.addLog(logItem);
    return logItem;
  }
}

export const storage = new StorageService();
export { DATA_DIR, UPLOADS_DIR, AUDIO_CACHE_DIR, MEDIA_CACHE_DIR };
