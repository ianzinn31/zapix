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

// Helper for exact phone matching with Brazilian 9th digit normalization
export function isSamePhoneNumber(p1, p2) {
  if (!p1 || !p2) return false;
  const c1 = String(p1).replace(/[^0-9]/g, '');
  const c2 = String(p2).replace(/[^0-9]/g, '');
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;

  const n1 = (c1.length === 10 || c1.length === 11) && !c1.startsWith('55') ? `55${c1}` : c1;
  const n2 = (c2.length === 10 || c2.length === 11) && !c2.startsWith('55') ? `55${c2}` : c2;
  if (n1 === n2) return true;

  // Brazilian mobile numbers: 55 + DDD (2 digits) + 8 or 9 digits
  if (n1.startsWith('55') && n2.startsWith('55')) {
    const ddd1 = n1.slice(2, 4);
    const ddd2 = n2.slice(2, 4);
    if (ddd1 === ddd2) {
      const num1 = n1.slice(4);
      const num2 = n2.slice(4);
      if ((num1.length === 8 || num1.length === 9) && (num2.length === 8 || num2.length === 9)) {
        return num1.slice(-8) === num2.slice(-8);
      }
    }
  }
  return false;
}

const DEFAULT_STATE = {
  settings: {
    ai: {
      primaryModel: 'z-ai/glm-5.3',
      primaryApiKey: process.env.NVIDIA_NIM_PRIMARY_API_KEY || '',
      fallbackModel: 'google/diffusiongemma-26b-a4b-it',
      fallbackApiKey: process.env.NVIDIA_NIM_FALLBACK_API_KEY || '',
      tertiaryModel: 'nvidia/nemotron-3.5-lightning:free',
      tertiaryApiKey: process.env.OPENROUTER_API_KEY || '',
      tertiaryProvider: 'openrouter',
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
      speed: 0.85,
      regionalVoices: {
        'pt-BR': {
          country: 'Brasil',
          language: 'Português (Brasil)',
          flag: '🇧🇷',
          ddi: '55',
          voiceId: '7f92f8afb8ec43bf81429cc1c9199cb1',
          sampleText: 'Oi, tudo bem? Aqui é do time de atendimento, tô passando pra te mandar as atividades!',
          description: 'Voz brasileira nativa, tom acolhedor e consultivo.'
        },
        'es-MX': {
          country: 'México',
          language: 'Español (México)',
          flag: '🇲🇽',
          ddi: '52',
          voiceId: '',
          sampleText: '¡Hola! ¿Cómo estás? Te comparto con mucho gusto el material completo para que lo revises.',
          description: 'Acento mexicano nativo, entonación cálida y cercana.'
        },
        'es-CO': {
          country: 'Colômbia',
          language: 'Español (Colombia)',
          flag: '🇨🇴',
          ddi: '57',
          voiceId: '',
          sampleText: '¡Hola! Qué gusto saludarte. Con todo gusto te comparto el material para que empiecen hoy mismo.',
          description: 'Acento colombiano suave, amable y respetuoso.'
        },
        'es-AR': {
          country: 'Argentina',
          language: 'Español (Argentina)',
          flag: '🇦🇷',
          ddi: '54',
          voiceId: '',
          sampleText: '¡Hola! ¿Cómo estás? Te paso con mucho gusto el material para que lo veas ahora mismo.',
          description: 'Acento argentino/porteño, fluido y empático.'
        },
        'es-BO': {
          country: 'Bolívia',
          language: 'Español (Bolivia)',
          flag: '🇧🇴',
          ddi: '591',
          voiceId: '',
          sampleText: '¡Hola! Qué alegría saludarte. Te paso toda la información y el material para comenzar.',
          description: 'Acento boliviano andino/oriental, formal y cálido.'
        },
        'es-PY': {
          country: 'Paraguai',
          language: 'Español (Paraguay)',
          flag: '🇵🇾',
          ddi: '595',
          voiceId: '',
          sampleText: '¡Hola! Un gusto saludarte. Te envío los materiales completos para que puedas aprovecharlos.',
          description: 'Acento paraguayo servicial y cordial.'
        },
        'es-PE': {
          country: 'Peru',
          language: 'Español (Perú)',
          flag: '🇵🇪',
          ddi: '51',
          voiceId: '',
          sampleText: '¡Hola! Qué gusto saludarte. Te comparto las actividades completas para comenzar.',
          description: 'Español peruano neutro, claro y confiable.'
        },
        'es-CL': {
          country: 'Chile',
          language: 'Español (Chile)',
          flag: '🇨🇱',
          ddi: '56',
          voiceId: '',
          sampleText: '¡Hola! ¿Cómo estás? Te comparto altiro el material para que lo puedas revisar.',
          description: 'Español chileno dinámico y cercano.'
        },
        'es-419': {
          country: 'LatAm Geral (Neutro)',
          language: 'Español Neutro (Latinoamérica)',
          flag: '🌎',
          ddi: '',
          voiceId: '',
          sampleText: '¡Hola! Un gran saludo. Te comparto el material completo con todo cariño para ti.',
          description: 'Español neutro latinoamericano universal para cualquier país hispano.'
        },
        'en-US': {
          country: 'Estados Unidos / Global',
          language: 'English (US)',
          flag: '🇺🇸',
          ddi: '1',
          voiceId: '',
          sampleText: 'Hi there! Great to connect with you. Here are the complete activities for you to get started.',
          description: 'Native English speaker, friendly and engaging tone.'
        }
      }
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
      ticketBasic: 0,
      ticketComplete: 0,
      currency: 'BRL',
      currencyCode: 'BRL',
      currencySymbol: 'R$',
      targetCountry: 'Brasil',
      paymentMethod: 'both', // 'checkout' | 'pix' | 'both'
      paymentMethodType: 'pix', // 'XPag_AutoCode' | 'Nequi_BreB' | 'QR_Bolivia' | 'Alias_Paraguay' | 'pix'
      paymentInstructions: 'Código de pagamento automático SPEI',
      voiceAccentId: 'pt_BR_native_01',
      // Regional gateways
      xpagApiKey: '',
      xpagClientId: '',
      xpagClientSecret: '',
      xpagEnvironment: 'production', // 'production' | 'sandbox'
      xpagAutoCharge: true,
      xpagInstructions: 'Código de pago automático SPEI',
      nequiNumber: '',
      nequiBeneficiary: '',
      nequiInstructions: 'Transferencia directa Nequi / Bre-B',
      boliviaQrUrl: '',
      boliviaBankName: '',
      boliviaAccountNumber: '',
      boliviaBeneficiary: '',
      boliviaInstructions: 'Pago mediante QR Simple o transferencia bancaria',
      aliasKey: '',
      aliasBank: '',
      aliasBeneficiary: '',
      aliasInstructions: 'Transferencia directa vía Alias',
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
      defaultAudioPitchText: '',
      localizedOffers: {}, // Country-specific localized offers { "México": { ... }, "Colômbia": { ... } }
      countryPrices: {
        'Brasil': { ticketBasic: 15, ticketComplete: 37, currencyCode: 'BRL', currencySymbol: 'R$' },
        'México': { ticketBasic: 150, ticketComplete: 250, currencyCode: 'MXN', currencySymbol: '$' },
        'Colômbia': { ticketBasic: 45000, ticketComplete: 75000, currencyCode: 'COP', currencySymbol: '$' },
        'Argentina': { ticketBasic: 15000, ticketComplete: 25000, currencyCode: 'ARS', currencySymbol: '$' },
        'Bolívia': { ticketBasic: 70, ticketComplete: 120, currencyCode: 'BOB', currencySymbol: 'Bs' },
        'Paraguai': { ticketBasic: 120000, ticketComplete: 200000, currencyCode: 'PYG', currencySymbol: 'Gs' },
        'Estados Unidos': { ticketBasic: 15, ticketComplete: 27, currencyCode: 'USD', currencySymbol: '$' }
      },
      sendPixButton: true
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
  lidMappings: {},
  messages: [],
  deliverables: [],
  sales: [],
  xpagCharges: {},
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
          if (!this.data.settings.ai.tertiaryApiKey && process.env.OPENROUTER_API_KEY) {
            this.data.settings.ai.tertiaryApiKey = process.env.OPENROUTER_API_KEY;
          }
          if (!this.data.settings.ai.tertiaryModel) {
            this.data.settings.ai.tertiaryModel = 'nvidia/nemotron-3.5-lightning:free';
          }
          if (!this.data.settings.fishAudio.apiKey && process.env.OPENROUTER_API_KEY) {
            this.data.settings.fishAudio.apiKey = process.env.OPENROUTER_API_KEY;
          }
          if (!this.data.settings.fishAudio.regionalVoices) {
            this.data.settings.fishAudio.regionalVoices = { ...DEFAULT_STATE.settings.fishAudio.regionalVoices };
          }
          if (!this.data.settings.transcription?.apiKey && process.env.GROQ_API_KEY) {
            if (!this.data.settings.transcription) {
              this.data.settings.transcription = { ...DEFAULT_STATE.settings.transcription };
            }
            this.data.settings.transcription.apiKey = process.env.GROQ_API_KEY;
          }
          // Upgrade deprecated or 404 model names to verified active NVIDIA NIM models
          const invalidPrimary = [
            'z-ai/glm-5.3-flash',
            'moonshotai/kimi-k2.6',
            'meta/llama-3.3-70b-instruct',
            'meta/llama-3.1-70b-instruct',
            'nvidia/nemotron-4-340b-instruct'
          ];
          if (invalidPrimary.includes(this.data.settings.ai.primaryModel) || !this.data.settings.ai.primaryModel) {
            this.data.settings.ai.primaryModel = 'z-ai/glm-5.3';
          }
          const invalidFallback = [
            'mistralai/mixtral-8x22b-instruct',
            'nvidia/nemotron-4-340b-instruct',
            'meta/llama-3.3-70b-instruct',
            'meta/llama-3.1-70b-instruct'
          ];
          if (invalidFallback.includes(this.data.settings.ai.fallbackModel) || !this.data.settings.ai.fallbackModel) {
            this.data.settings.ai.fallbackModel = 'google/diffusiongemma-26b-a4b-it';
          }
          if (this.data.settings.ai.isFallbackActive && this.data.settings.ai.primaryModel === 'z-ai/glm-5.3') {
            this.data.settings.ai.isFallbackActive = false;
            this.data.settings.ai.lastFallbackReason = null;
          }
          await supabaseService.saveSettings(this.data.settings);
        } else {
          await supabaseService.saveSettings(this.data.settings);
        }

        const localLeads = { ...this.data.leads };
        this.data.leads = {};
        if (cloudLeads && cloudLeads.length > 0) {
          cloudLeads.forEach((l) => {
            const local = localLeads[l.phone] || {};
            this.data.leads[l.phone] = { ...local, ...l };
          });
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
        const loaded = {
          ...DEFAULT_STATE,
          ...parsed,
          settings: {
            ...DEFAULT_STATE.settings,
            ...(parsed.settings || {}),
            ai: { ...DEFAULT_STATE.settings.ai, ...(parsed.settings?.ai || {}) },
            fishAudio: {
              ...DEFAULT_STATE.settings.fishAudio,
              ...(parsed.settings?.fishAudio || {}),
              regionalVoices: {
                ...DEFAULT_STATE.settings.fishAudio.regionalVoices,
                ...(parsed.settings?.fishAudio?.regionalVoices || {})
              },
              speed: (parsed.settings?.fishAudio?.speed && parsed.settings?.fishAudio?.speed < 1.0)
                ? parsed.settings.fishAudio.speed
                : 0.85
            },
            transcription: { ...DEFAULT_STATE.settings.transcription, ...(parsed.settings?.transcription || {}) },
            antiBan: { ...DEFAULT_STATE.settings.antiBan, ...(parsed.settings?.antiBan || {}) },
            metaAds: { ...DEFAULT_STATE.settings.metaAds, ...(parsed.settings?.metaAds || {}) },
            vision: { ...DEFAULT_STATE.settings.vision, ...(parsed.settings?.vision || {}) },
            product: {
              ...DEFAULT_STATE.settings.product,
              ...(parsed.settings?.product || {}),
              countryPrices: {
                ...DEFAULT_STATE.settings.product.countryPrices,
                ...(parsed.settings?.product?.countryPrices || {})
              },
              localizedOffers: {
                ...DEFAULT_STATE.settings.product.localizedOffers,
                ...(parsed.settings?.product?.localizedOffers || {})
              }
            },
            remarketing: { ...DEFAULT_STATE.settings.remarketing, ...(parsed.settings?.remarketing || {}) }
          },
          leads: parsed.leads || DEFAULT_STATE.leads,
          lidMappings: parsed.lidMappings || DEFAULT_STATE.lidMappings || {},
          messages: parsed.messages || DEFAULT_STATE.messages,
          deliverables: parsed.deliverables || DEFAULT_STATE.deliverables,
          sales: parsed.sales || DEFAULT_STATE.sales,
          systemLogs: parsed.systemLogs || DEFAULT_STATE.systemLogs
        };

        // Normalize deprecated models and reset fallback if using active model
        const invalidPrimary = [
          'z-ai/glm-5.3-flash',
          'moonshotai/kimi-k2.6',
          'meta/llama-3.3-70b-instruct',
          'meta/llama-3.1-70b-instruct',
          'nvidia/nemotron-4-340b-instruct'
        ];
        if (invalidPrimary.includes(loaded.settings.ai.primaryModel) || !loaded.settings.ai.primaryModel) {
          loaded.settings.ai.primaryModel = 'z-ai/glm-5.3';
        }
        const invalidFallback = [
          'mistralai/mixtral-8x22b-instruct',
          'nvidia/nemotron-4-340b-instruct',
          'meta/llama-3.3-70b-instruct',
          'meta/llama-3.1-70b-instruct'
        ];
        if (invalidFallback.includes(loaded.settings.ai.fallbackModel) || !loaded.settings.ai.fallbackModel) {
          loaded.settings.ai.fallbackModel = 'google/diffusiongemma-26b-a4b-it';
        }
        if (loaded.settings.ai.isFallbackActive && loaded.settings.ai.primaryModel === 'z-ai/glm-5.3') {
          loaded.settings.ai.isFallbackActive = false;
          loaded.settings.ai.lastFallbackReason = null;
        }

        if (!loaded.settings.product.ticketBasic || Number(loaded.settings.product.ticketBasic) === 0) {
          loaded.settings.product.ticketBasic = Number(loaded.settings.product.price) || 15;
        }
        if (!loaded.settings.product.ticketComplete || Number(loaded.settings.product.ticketComplete) === 0) {
          loaded.settings.product.ticketComplete = 37;
        }

        return loaded;
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
      const existingRegional = this.data.settings.fishAudio?.regionalVoices || DEFAULT_STATE.settings.fishAudio.regionalVoices;
      const updatedRegional = partialSettings.fishAudio.regionalVoices
        ? { ...existingRegional, ...partialSettings.fishAudio.regionalVoices }
        : existingRegional;
      this.data.settings.fishAudio = {
        ...this.data.settings.fishAudio,
        ...partialSettings.fishAudio,
        regionalVoices: updatedRegional
      };
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
      const existingCountryPrices = this.data.settings.product?.countryPrices || DEFAULT_STATE.settings.product.countryPrices || {};
      const updatedCountryPrices = {
        ...existingCountryPrices,
        ...(partialSettings.product.countryPrices || {})
      };
      
      const existingLocalizedOffers = this.data.settings.product?.localizedOffers || {};
      const updatedLocalizedOffers = {
        ...existingLocalizedOffers,
        ...(partialSettings.product.localizedOffers || {})
      };

      this.data.settings.product = {
        ...this.data.settings.product,
        ...partialSettings.product,
        countryPrices: updatedCountryPrices,
        localizedOffers: updatedLocalizedOffers
      };

      // Always ensure the active targetCountry's tickets are safely registered in countryPrices
      const activeCountry = this.data.settings.product.targetCountry || 'Brasil';
      const bTicket = Number(this.data.settings.product.ticketBasic);
      const cTicket = Number(this.data.settings.product.ticketComplete);
      if (bTicket > 0 || cTicket > 0) {
        this.data.settings.product.countryPrices[activeCountry] = {
          ...(this.data.settings.product.countryPrices[activeCountry] || {}),
          ...(bTicket > 0 ? { ticketBasic: bTicket } : {}),
          ...(cTicket > 0 ? { ticketComplete: cTicket } : {}),
          currencyCode: this.data.settings.product.currencyCode || this.data.settings.product.countryPrices[activeCountry]?.currencyCode || 'BRL',
          currencySymbol: this.data.settings.product.currencySymbol || this.data.settings.product.countryPrices[activeCountry]?.currencySymbol || 'R$'
        };
      }
    }
    if (partialSettings.remarketing) {
      this.data.settings.remarketing = { ...this.data.settings.remarketing, ...partialSettings.remarketing };
    }
    this.save();
    supabaseService.saveSettings(this.data.settings);
    return this.data.settings;
  }

  // LID Mappings (WhatsApp Privacy Identity -> Real Phone Number)
  saveLidMapping(lid, phone) {
    if (!lid || !phone) return;
    const cleanLid = String(lid).replace(/[^0-9]/g, '');
    const cleanPhone = String(phone).replace(/[^0-9]/g, '');
    if (!cleanLid || !cleanPhone || cleanLid === cleanPhone) return;

    if (!this.data.lidMappings) {
      this.data.lidMappings = {};
    }
    this.data.lidMappings[cleanLid] = cleanPhone;
    this.data.lidMappings[cleanPhone] = cleanLid;
    this.save();
  }

  getPhoneForLid(lid) {
    if (!lid) return null;
    const clean = String(lid).replace(/[^0-9]/g, '');
    return this.data.lidMappings?.[clean] || null;
  }

  getLidForPhone(phone) {
    if (!phone) return null;
    const clean = String(phone).replace(/[^0-9]/g, '');
    return this.data.lidMappings?.[clean] || null;
  }

  migrateLidLead(lid, realPhone, optionalName = null) {
    if (!lid || !realPhone) return null;
    const cleanLid = String(lid).replace(/[^0-9]/g, '');
    const cleanPhone = String(realPhone).replace(/[^0-9]/g, '');
    if (!cleanLid || !cleanPhone || cleanLid === cleanPhone) return null;

    this.saveLidMapping(cleanLid, cleanPhone);

    const oldLead = this.data.leads[cleanLid] || this.data.leads[lid];
    const existingReal = this.data.leads[cleanPhone] || this.data.leads[realPhone];

    const routingJid = oldLead?.jid || (cleanLid.length >= 14 ? `${cleanLid}@lid` : `${cleanLid}@s.whatsapp.net`);

    let name = optionalName || existingReal?.name || oldLead?.name || cleanPhone;
    if (name === cleanLid && optionalName) {
      name = optionalName;
    } else if (name === cleanLid) {
      name = cleanPhone;
    }

    const mergedLead = {
      ...(oldLead || {}),
      ...(existingReal || {}),
      id: cleanPhone,
      phone: cleanPhone,
      realPhone: cleanPhone,
      lid: cleanLid,
      jid: routingJid,
      name,
      updatedAt: Date.now()
    };

    this.data.leads[cleanPhone] = mergedLead;

    // Remove obsolete LID key from leads map so it doesn't duplicate in CRM
    if (this.data.leads[cleanLid] && cleanLid !== cleanPhone) {
      delete this.data.leads[cleanLid];
    }
    if (this.data.leads[lid] && lid !== cleanPhone) {
      delete this.data.leads[lid];
    }

    // Migrate messages to real phone number
    if (Array.isArray(this.data.messages)) {
      for (const msg of this.data.messages) {
        if (msg.phone === cleanLid || msg.phone === lid) {
          msg.phone = cleanPhone;
        }
      }
    }

    this.save();
    supabaseService.upsertLead(mergedLead);
    if (cleanLid !== cleanPhone) {
      supabaseService.deleteLead(cleanLid);
    }

    console.log(`[Storage] Lead migrado com sucesso: LID ${cleanLid} -> Telefone Real ${cleanPhone} (${name})`);
    return mergedLead;
  }

  // Leads
  getLeads() {
    return Object.values(this.data.leads).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  getLead(phone) {
    if (!phone) return null;
    const cleanPhone = String(phone).replace(/[^0-9]/g, '');
    if (this.data.leads[phone]) return this.data.leads[phone];
    if (this.data.leads[cleanPhone]) return this.data.leads[cleanPhone];

    // Check if phone is a LID that maps to a real phone
    const mappedPhone = this.getPhoneForLid(cleanPhone);
    if (mappedPhone && this.data.leads[mappedPhone]) {
      return this.data.leads[mappedPhone];
    }

    // Check if phone is a real phone that maps from a LID
    const mappedLid = this.getLidForPhone(cleanPhone);
    if (mappedLid && this.data.leads[mappedLid]) {
      return this.data.leads[mappedLid];
    }

    // Search across leads by phone, lid, or fuzzy phone match
    for (const lead of Object.values(this.data.leads)) {
      if (lead.phone === cleanPhone || lead.lid === cleanPhone || lead.realPhone === cleanPhone || lead.id === cleanPhone) {
        return lead;
      }
      if (isSamePhoneNumber(lead.phone, cleanPhone) || (lead.lid && isSamePhoneNumber(lead.lid, cleanPhone))) {
        return lead;
      }
    }
    return null;
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

  updateLead(phone, updates = {}) {
    return this.upsertLead(phone, updates);
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

  deleteMessagesForPhone(phone) {
    if (!phone) return false;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    this.data.messages = this.data.messages.filter((m) => {
      const mClean = (m.phone || '').replace(/[^0-9]/g, '');
      return mClean !== cleanPhone && m.phone !== phone;
    });
    this.save();
    supabaseService.deleteMessagesByPhone(phone);
    return true;
  }

  resetLeadFunnel(phone) {
    if (!phone) return null;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const lead = this.getLead(cleanPhone) || this.getLead(phone);
    if (!lead) return null;

    const resetData = {
      ...lead,
      stage: 'NOVO',
      deliverableSent: false,
      deliverableSentAt: null,
      lastReceiptStatus: null,
      lastReceiptAmount: null,
      lastReceiptBank: null,
      lastReceiptDate: null,
      lastReceiptSummary: null,
      lastReceiptExplanation: null,
      lastRemarketingStep: -1,
      lastRemarketingAt: null,
      remarketingHistory: [],
      lastMessage: '',
      lastMessageFromMe: false,
      unreadCount: 0,
      updatedAt: Date.now()
    };

    this.data.leads[phone] = resetData;
    if (this.data.leads[cleanPhone]) {
      this.data.leads[cleanPhone] = resetData;
    }
    this.save();
    supabaseService.upsertLead(resetData);
    return resetData;
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
    const cleanPhone = String(phone).replace(/[^0-9]/g, '');
    if (!cleanPhone) return [];
    const mappedPhone = this.getPhoneForLid(cleanPhone);
    const mappedLid = this.getLidForPhone(cleanPhone);
    return this.data.messages.filter((m) => {
      const mClean = (m.phone || '').replace(/[^0-9]/g, '');
      return (
        mClean === cleanPhone ||
        (mappedPhone && mClean === mappedPhone) ||
        (mappedLid && mClean === mappedLid) ||
        isSamePhoneNumber(m.phone, cleanPhone)
      );
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

  // XPag Charges
  saveXpagCharge(key, chargeData) {
    if (!this.data.xpagCharges) this.data.xpagCharges = {};
    this.data.xpagCharges[key] = chargeData;
    if (chargeData.transactionId) {
      this.data.xpagCharges[chargeData.transactionId] = chargeData;
    }
    if (chargeData.externalId && chargeData.externalId !== key) {
      this.data.xpagCharges[chargeData.externalId] = chargeData;
    }
    this.save();
    return chargeData;
  }

  getXpagCharge(key) {
    if (!this.data.xpagCharges) return null;
    return this.data.xpagCharges[key] || null;
  }

  // Country-specific localized offers
  saveLocalizedOffer(targetCountry, localizedData) {
    if (!this.data.settings.product) this.data.settings.product = {};
    if (!this.data.settings.product.localizedOffers) this.data.settings.product.localizedOffers = {};
    if (!this.data.settings.product.countryPrices) this.data.settings.product.countryPrices = {};
    
    this.data.settings.product.localizedOffers[targetCountry] = {
      ...localizedData,
      updatedAt: Date.now()
    };

    if (localizedData.ticketBasic > 0 || localizedData.ticketComplete > 0) {
      this.data.settings.product.countryPrices[targetCountry] = {
        ...(this.data.settings.product.countryPrices[targetCountry] || {}),
        ticketBasic: Number(localizedData.ticketBasic) || 0,
        ticketComplete: Number(localizedData.ticketComplete) || 0,
        currencyCode: localizedData.currencyCode || localizedData.currency || 'USD',
        currencySymbol: localizedData.currencySymbol || '$'
      };
    }

    this.save();
    supabaseService.saveSettings(this.data.settings);
    this.addLog('SUCCESS', `Oferta localizada com sucesso para ${targetCountry} e salva no sistema.`);
    return this.data.settings.product.localizedOffers[targetCountry];
  }

  getLocalizedOffer(targetCountry) {
    return this.data.settings?.product?.localizedOffers?.[targetCountry] || null;
  }

  saveCountryPrice(country, ticketBasic, ticketComplete, currencyCode = '', currencySymbol = '') {
    if (!this.data.settings.product) this.data.settings.product = {};
    if (!this.data.settings.product.countryPrices) this.data.settings.product.countryPrices = {};
    this.data.settings.product.countryPrices[country] = {
      ...(this.data.settings.product.countryPrices[country] || {}),
      ticketBasic: Number(ticketBasic) || 0,
      ticketComplete: Number(ticketComplete) || 0,
      ...(currencyCode ? { currencyCode } : {}),
      ...(currencySymbol ? { currencySymbol } : {})
    };
    if (this.data.settings.product.localizedOffers?.[country]) {
      this.data.settings.product.localizedOffers[country].ticketBasic = Number(ticketBasic) || 0;
      this.data.settings.product.localizedOffers[country].ticketComplete = Number(ticketComplete) || 0;
    }
    this.save();
    supabaseService.saveSettings(this.data.settings);
    return this.data.settings.product.countryPrices[country];
  }

  getCountryPrice(country) {
    const cp = this.data.settings?.product?.countryPrices?.[country];
    if (cp && (cp.ticketBasic > 0 || cp.ticketComplete > 0)) {
      return cp;
    }
    const loc = this.data.settings?.product?.localizedOffers?.[country];
    if (loc && (loc.ticketBasic > 0 || loc.ticketComplete > 0)) {
      return { ticketBasic: loc.ticketBasic, ticketComplete: loc.ticketComplete, currencyCode: loc.currencyCode, currencySymbol: loc.currencySymbol };
    }
    return null;
  }

  // Logs
  getLogs(limit = 100) {
    return this.data.systemLogs.slice(-limit).reverse();
  }

  clearLogs() {
    this.data.systemLogs = [];
    this.save();
    return true;
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
