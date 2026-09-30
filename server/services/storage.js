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

// Ensure necessary directories exist
[DATA_DIR, UPLOADS_DIR, AUDIO_CACHE_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const DEFAULT_STATE = {
  settings: {
    ai: {
      primaryModel: 'meta/llama-3.2-11b-vision-instruct',
      primaryApiKey: process.env.NVIDIA_NIM_PRIMARY_API_KEY || '',
      fallbackModel: 'meta/llama-3.2-11b-vision-instruct',
      fallbackApiKey: process.env.NVIDIA_NIM_FALLBACK_API_KEY || '',
      temperature: 0.7,
      maxTokens: 600,
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
      autoAudioMode: 'pitch_and_welcome',
      speed: 1.0
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
    product: {
      name: '',
      niche: '',
      targetAudience: '',
      price: 0,
      currency: 'BRL',
      paymentMethod: 'both', // 'checkout' | 'pix' | 'both'
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
            product: { ...DEFAULT_STATE.settings.product, ...(parsed.settings?.product || {}) }
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
    if (partialSettings.product) {
      this.data.settings.product = { ...this.data.settings.product, ...partialSettings.product };
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
    const existing = this.data.leads[phone] || {
      id: phone,
      phone,
      name: phone.replace(/[^0-9]/g, ''),
      stage: 'NOVO', // NOVO | EM_CONVERSA | PITCH_ENVIADO | CHECKOUT | APROVADO | PERDIDO
      aiActive: true,
      tags: [],
      createdAt: Date.now(),
      unreadCount: 0
    };

    const updated = {
      ...existing,
      ...updates,
      updatedAt: Date.now()
    };

    this.data.leads[phone] = updated;
    this.save();
    supabaseService.upsertLead(updated);
    return updated;
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
export { DATA_DIR, UPLOADS_DIR, AUDIO_CACHE_DIR };
