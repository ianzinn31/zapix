import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { storage, UPLOADS_DIR } from '../services/storage.js';
import { whatsapp } from '../services/whatsapp.js';
import { salesMetrics } from '../services/salesMetrics.js';
import { fishAudio } from '../services/fishAudio.js';
import { nvidiaNim } from '../services/nvidiaNim.js';
import { remarketingService } from '../services/remarketingService.js';
import { xpagService } from '../services/xpag.js';

const router = Router();

// Multer storage for PDF and Image deliverables
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${cleanName}_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// === System Health & Watchdog Check ===
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    whatsapp: whatsapp.getStatus(),
    memory: process.memoryUsage().rss
  });
});

// === WhatsApp Connection Status & Controls ===
router.get('/whatsapp/status', (req, res) => {
  res.json(whatsapp.getStatus());
});

router.post('/whatsapp/connect', async (req, res) => {
  if (typeof whatsapp.reconnect === 'function') {
    whatsapp.reconnect();
  } else {
    whatsapp.initialize();
  }
  res.json({ message: 'Conexão iniciada' });
});

router.post('/whatsapp/disconnect', async (req, res) => {
  const result = await whatsapp.disconnect();
  res.json({ success: result });
});

// === Settings ===
router.get('/settings', (req, res) => {
  res.json(storage.getSettings());
});

router.post('/settings', (req, res) => {
  const updated = storage.updateSettings(req.body);
  storage.addLog('INFO', 'Configurações atualizadas no painel.');
  res.json(updated);
});

// === Global Offer Localization with AI ===
router.post('/product/localize-offer', async (req, res) => {
  try {
    const { targetCountry, baseProduct } = req.body || {};
    if (!targetCountry) {
      return res.status(400).json({ error: 'targetCountry é obrigatório (ex: México, Colômbia)' });
    }

    storage.addLog('INFO', `Iniciando localização da oferta com IA para ${targetCountry}...`);
    const localized = await nvidiaNim.localizeOfferWithAi(targetCountry, baseProduct);
    res.json({ success: true, targetCountry, localized });
  } catch (err) {
    console.error(`[API /product/localize-offer Error (${req.body?.targetCountry})]:`, err.message);
    storage.addLog('ERROR', `Falha ao localizar oferta para ${req.body?.targetCountry}: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/product/localized-offers', (req, res) => {
  const settings = storage.getSettings();
  res.json(settings.product?.localizedOffers || {});
});

// === Country-Specific Ticket Pricing ===
router.get('/product/country-prices', (req, res) => {
  const settings = storage.getSettings();
  res.json(settings.product?.countryPrices || {});
});

router.post('/product/country-prices', (req, res) => {
  try {
    const { countryPrices, country, ticketBasic, ticketComplete, currencyCode, currencySymbol } = req.body || {};
    if (country && (ticketBasic !== undefined || ticketComplete !== undefined)) {
      const saved = storage.saveCountryPrice(country, ticketBasic, ticketComplete, currencyCode, currencySymbol);
      return res.json({ success: true, countryPrice: saved });
    }
    if (countryPrices && typeof countryPrices === 'object') {
      for (const [cName, pData] of Object.entries(countryPrices)) {
        if (pData && (pData.ticketBasic !== undefined || pData.ticketComplete !== undefined)) {
          storage.saveCountryPrice(cName, pData.ticketBasic, pData.ticketComplete, pData.currencyCode, pData.currencySymbol);
        }
      }
      const settings = storage.getSettings();
      return res.json({ success: true, countryPrices: settings.product?.countryPrices || {} });
    }
    res.status(400).json({ error: 'Dados de preços inválidos' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Leads ===
router.get('/leads', (req, res) => {
  res.json(storage.getLeads());
});

router.put('/leads/:phone', (req, res) => {
  const { phone } = req.params;
  const updates = req.body;
  const newPhone = updates.phone || updates.newPhone;
  let updated;
  if (newPhone && newPhone.replace(/[^0-9]/g, '') !== phone.replace(/[^0-9]/g, '')) {
    updated = storage.migrateLidLead(phone, newPhone, updates.name);
    if (!updated) {
      updated = storage.upsertLead(phone, updates);
    }
  } else {
    updated = storage.upsertLead(phone, updates);
  }
  whatsapp.emit('lead:updated', updated);
  storage.addLog('INFO', `Lead ${phone} atualizado manualmente.`);
  res.json(updated);
});

router.delete('/leads/:phone', (req, res) => {
  const { phone } = req.params;
  const success = storage.deleteLead(phone);
  if (success) {
    whatsapp.emit('lead:deleted', { phone });
    storage.addLog('INFO', `Lead ${phone} e histórico de mensagens foram excluídos.`);
    return res.json({ success: true, phone });
  }
  res.status(404).json({ error: 'Lead não encontrado' });
});

router.post('/leads/:phone/reset', async (req, res) => {
  const { phone } = req.params;
  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // 1. Cancel ongoing AI execution / debounce for this phone
    whatsapp.cancelActiveLeadProcess(cleanPhone);

    // 2. Clear all chat messages from storage and Supabase
    storage.deleteMessagesForPhone(cleanPhone);

    // 3. Reset funnel stage, deliverables and receipt memory back to zero
    const resetLead = storage.resetLeadFunnel(cleanPhone);

    if (!resetLead) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }

    // 4. Emit real-time updates to all connected dashboards
    whatsapp.emit('lead:updated', resetLead);
    whatsapp.emit('lead:messages_cleared', { phone: cleanPhone, rawPhone: phone });
    storage.addLog('SUCCESS', `Funil do lead ${resetLead.name || cleanPhone} foi resetado com sucesso para novos testes do zero.`);

    res.json({ success: true, lead: resetLead });
  } catch (err) {
    console.error(`[API] Erro ao resetar funil do lead ${phone}:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/leads/:phone/sync', async (req, res) => {
  const { phone } = req.params;
  try {
    const updated = await whatsapp.fetchContactInfo(phone);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/leads/:phone/ai-toggle', (req, res) => {
  const { phone } = req.params;
  const { aiActive } = req.body;
  const updated = storage.setLeadAiActive(phone, Boolean(aiActive));
  if (updated) {
    whatsapp.emit('lead:updated', updated);
    storage.addLog('INFO', `IA ${aiActive ? 'Ativada' : 'Pausada'} para o lead ${phone}`);
    return res.json(updated);
  }
  res.status(404).json({ error: 'Lead não encontrado' });
});

router.post('/leads/:phone/stage', (req, res) => {
  const { phone } = req.params;
  const { stage } = req.body;
  const updated = storage.setLeadStage(phone, stage);
  if (updated) {
    whatsapp.emit('lead:updated', updated);
    return res.json(updated);
  }
  res.status(404).json({ error: 'Lead não encontrado' });
});

// === Messages & Live Chat ===
router.get('/messages/:phone', (req, res) => {
  const { phone } = req.params;
  res.json(storage.getMessages(phone));
});

router.post('/messages/send', async (req, res) => {
  const { phone, text, type, mediaUrl } = req.body;
  if (!phone || (!text && !mediaUrl)) {
    return res.status(400).json({ error: 'Telefone e conteúdo são obrigatórios.' });
  }

  try {
    const msg = await whatsapp.sendManualMessage(phone, text, type, mediaUrl);
    res.json(msg);
  } catch (err) {
    console.error(`[API /messages/send ERROR] Falha ao enviar para ${phone}:`, err.message);
    storage.addLog('ERROR', `Falha ao enviar mensagem manual para ${phone}: ${err.message}`);

    const isOffline = whatsapp.status !== 'connected';
    const warningMsg = isOffline
      ? 'WhatsApp não está conectado no momento. Mensagem salva apenas localmente.'
      : `Erro ao enviar no WhatsApp: ${err.message}. Mensagem salva localmente.`;

    const fallbackMsg = storage.addMessage({
      phone,
      fromMe: true,
      text: text || '',
      type: type || 'text',
      mediaUrl: mediaUrl || null,
      status: 'failed'
    });
    whatsapp.emit('chat:message', fallbackMsg);

    res.status(isOffline ? 503 : 500).json({
      ...fallbackMsg,
      error: warningMsg,
      warning: warningMsg
    });
  }
});

// Simulate incoming message from customer (great for testing without a real device)
router.post('/messages/simulate-incoming', async (req, res) => {
  const { phone = '5511999991234', text = 'Olá! Gostaria de saber mais sobre o método com IA', name = 'Lead Teste' } = req.body;

  storage.upsertLead(phone, { name });
  const savedMsg = storage.addMessage({
    phone,
    fromMe: false,
    text,
    type: 'text'
  });

  whatsapp.emit('chat:message', savedMsg);
  whatsapp.emit('lead:updated', storage.getLead(phone));

  // Trigger AI if active
  const lead = storage.getLead(phone);
  if (lead && lead.aiActive !== false) {
    whatsapp.handleAiResponse(phone, `${phone}@s.whatsapp.net`, text);
  }

  res.json({ success: true, message: savedMsg });
});

// === Deliverables (PDF & Imagens) ===
router.get('/deliverables', (req, res) => {
  res.json(storage.getDeliverables());
});

router.post('/deliverables', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('[DELIVERABLES UPLOAD ERROR]', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Arquivo excede o tamanho máximo suportado (100MB).' });
        }
        return res.status(400).json({ error: `Erro no upload: ${err.message}` });
      }
      return res.status(500).json({ error: `Erro interno no upload: ${err.message}` });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const { name, tag, description, requirePayment } = req.body;
    const isPdf = req.file.mimetype.includes('pdf');
    const type = isPdf ? 'pdf' : 'image';

    const newDeliverable = storage.addDeliverable({
      name: name || req.file.originalname,
      filename: req.file.filename,
      type,
      tag: (tag || name || 'ARQUIVO').toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
      description: description || '',
      requirePayment: requirePayment !== 'false' && requirePayment !== false,
      url: `/uploads/${req.file.filename}`,
      path: `/data/uploads/${req.file.filename}`,
      size: req.file.size
    });

    storage.addLog('SUCCESS', `Entregável adicionado: ${newDeliverable.name} (${newDeliverable.type}) - ${newDeliverable.requirePayment ? 'Exige Pagamento' : 'Liberação Antecipada/Isca'}`);
    res.json(newDeliverable);
  });
});

router.patch('/deliverables/:id', (req, res) => {
  const { id } = req.params;
  const updated = storage.updateDeliverable(id, req.body);
  if (updated) {
    storage.addLog('INFO', `Entregável atualizado (${updated.name}): ${updated.requirePayment ? 'Exige Pagamento' : 'Liberação Antecipada/Isca'}`);
    res.json(updated);
  } else {
    res.status(404).json({ error: 'Entregável não encontrado' });
  }
});

router.delete('/deliverables/:id', (req, res) => {
  const { id } = req.params;
  const deliverable = storage.getDeliverables().find((d) => d.id === id);
  if (deliverable) {
    const fullPath = path.resolve(UPLOADS_DIR, deliverable.filename);
    if (fs.existsSync(fullPath)) {
      try { fs.unlinkSync(fullPath); } catch (e) {}
    }
  }
  storage.deleteDeliverable(id);
  res.json({ success: true });
});

// === Metrics & Meta Ads ===
router.get('/metrics', (req, res) => {
  res.json(salesMetrics.getMetrics());
});

router.post('/meta-ads/sync', async (req, res) => {
  try {
    const spend = await salesMetrics.syncMetaAdsSpend();
    res.json({ success: true, spend });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Sales
router.get('/sales', (req, res) => {
  res.json(storage.getSales());
});

// Simulate Sale (Manual or Test)
router.post('/sales/simulate', (req, res) => {
  const { phone, customerName, amount, platform = 'Kiwify' } = req.body;
  const product = storage.getSettings().product;

  const sale = storage.addSale({
    phone: phone || '5511999998888',
    customerName: customerName || 'Cliente Teste',
    amount: amount || product.price,
    platform
  });

  res.json(sale);
});

// === System Logs ===
router.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  res.json(storage.getLogs(limit));
});

router.delete('/logs', (req, res) => {
  storage.clearLogs();
  res.json({ success: true, message: 'Logs limpos com sucesso.' });
});

// === Fish Audio Test Synthesis ===
router.post('/fish-audio/test', async (req, res) => {
  const { text, voiceId, model, country, phone, regionalKey } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Texto obrigatório' });
  }

  try {
    const result = await fishAudio.generateSpeech(text, model, voiceId, { targetCountry: country, phone, regionalKey });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Groq Whisper STT Test Endpoint ===
router.post('/transcription/test', async (req, res) => {
  const { apiKey } = req.body;
  try {
    const effectiveKey = (apiKey || storage.getSettings().transcription?.apiKey || process.env.GROQ_API_KEY || '').trim();
    if (!effectiveKey) {
      return res.status(400).json({ error: 'Nenhuma chave Groq API informada. Cole sua chave para testar.' });
    }
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${effectiveKey}` }
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(400).json({ error: err.error?.message || `Chave Groq inválida (HTTP ${response.status})` });
    }
    const data = await response.json();
    const whisperModels = (data.data || []).filter(m => m.id.includes('whisper')).map(m => m.id);
    res.json({
      success: true,
      message: 'Conexão com a Groq Cloud estabelecida com sucesso!',
      whisperModels: whisperModels.length > 0 ? whisperModels : ['whisper-large-v3', 'whisper-large-v3-turbo']
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Remarketing & Auto Recovery Engine ===
router.get('/remarketing', (req, res) => {
  const settings = storage.getSettings();
  const config = settings.remarketing || {};
  const leads = storage.getLeads();
  
  // Compute queue stats
  const eligibleLeads = leads.filter(l => l.stage !== 'APROVADO' && l.lastReceiptStatus !== 'APROVADO' && l.aiActive !== false);
  const recoveringLeads = eligibleLeads.filter(l => typeof l.lastRemarketingStep === 'number' && l.lastRemarketingStep >= 0);
  
  res.json({
    config,
    stats: {
      totalEligible: eligibleLeads.length,
      currentlyRecovering: recoveringLeads.length,
      withinHours: remarketingService.isWithinOperatingHours(config.startHour ?? 8, config.endHour ?? 22),
      isProcessing: remarketingService.isProcessing
    }
  });
});

router.post('/remarketing', (req, res) => {
  const updatedSettings = storage.updateSettings({ remarketing: req.body });
  storage.addLog('INFO', 'Configurações de Remarketing em Áudio atualizadas.');
  res.json(updatedSettings.remarketing);
});

router.post('/remarketing/test', async (req, res) => {
  const { stepId, targetPhone } = req.body;
  try {
    const result = await remarketingService.testStep(stepId, targetPhone);
    res.json({ success: true, message: 'Disparo de teste realizado com sucesso!', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/remarketing/preview-audio', async (req, res) => {
  const { text } = req.body;
  try {
    const result = await remarketingService.previewAudio(text);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/remarketing/trigger-now', async (req, res) => {
  try {
    remarketingService.checkAndExecuteRemarketing();
    res.json({ success: true, message: 'Verificação da fila de remarketing iniciada!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Dynamic AI Models Fetching ===
router.get('/ai/models/nim', async (req, res) => {
  const { apiKey } = req.query;
  const effectiveKey = (apiKey || storage.getSettings().ai?.primaryApiKey || storage.getSettings().ai?.fallbackApiKey || process.env.NVIDIA_NIM_PRIMARY_API_KEY || '').trim();

  if (!effectiveKey) {
    return res.status(400).json({ error: 'Nenhuma chave de API da NVIDIA NIM informada.' });
  }

  try {
    const response = await axios.get('https://integrate.api.nvidia.com/v1/models', {
      headers: {
        Authorization: `Bearer ${effectiveKey}`
      },
      timeout: 15000
    });

    const rawModels = response.data?.data || [];
    const models = rawModels.map((m) => {
      const parts = (m.id || '').split('/');
      const org = parts[0] || m.owned_by || 'nvidia';
      const cleanName = parts[1] || m.id;
      return {
        id: m.id,
        name: m.id,
        shortName: cleanName,
        org,
        created: m.created
      };
    }).sort((a, b) => a.id.localeCompare(b.id));

    res.json({
      success: true,
      count: models.length,
      models
    });
  } catch (err) {
    console.error('[API /ai/models/nim Error]:', err.response?.status, err.message);
    const status = err.response?.status || 500;
    const msg = err.response?.data?.message || err.response?.data?.error?.message || err.message;
    res.status(status).json({
      error: `Erro ao buscar modelos na NVIDIA NIM: ${msg}`
    });
  }
});

router.get('/ai/models/openrouter', async (req, res) => {
  const { apiKey } = req.query;
  const effectiveKey = (apiKey || storage.getSettings().ai?.tertiaryApiKey || process.env.OPENROUTER_API_KEY || '').trim();

  try {
    const headers = {
      'HTTP-Referer': 'https://zapix.ai',
      'X-Title': 'Zapix AI'
    };
    if (effectiveKey) {
      headers['Authorization'] = `Bearer ${effectiveKey}`;
    }

    const response = await axios.get('https://openrouter.ai/api/v1/models', {
      headers,
      timeout: 15000
    });

    const rawModels = response.data?.data || [];
    const models = rawModels.map((m) => {
      const isFree = m.id.endsWith(':free') || m.pricing?.prompt === '0' || m.pricing?.prompt === 0;
      return {
        id: m.id,
        name: m.name || m.id,
        isFree,
        contextLength: m.context_length,
        description: m.description || ''
      };
    }).sort((a, b) => {
      if (a.isFree && !b.isFree) return -1;
      if (!a.isFree && b.isFree) return 1;
      return a.name.localeCompare(b.name);
    });

    res.json({
      success: true,
      count: models.length,
      freeCount: models.filter((m) => m.isFree).length,
      models
    });
  } catch (err) {
    console.error('[API /ai/models/openrouter Error]:', err.response?.status, err.message);
    const status = err.response?.status || 500;
    const msg = err.response?.data?.message || err.response?.data?.error?.message || err.message;
    res.status(status).json({
      error: `Erro ao buscar modelos no OpenRouter: ${msg}`
    });
  }
});

// === XPag Payment Gateway Endpoints ===

// 1. Get XPag integration status
router.get('/xpag/status', (req, res) => {
  const config = xpagService.getConfig();
  res.json({
    enabled: config.enabled,
    isConfigured: xpagService.isConfigured(),
    environment: config.environment,
    isSandbox: config.isSandbox,
    hasClientId: Boolean(config.clientId),
    hasClientSecret: Boolean(config.clientSecret),
    webhookUrl: config.webhookUrl
  });
});

// 2. Test XPag Connection
router.post('/xpag/test-connection', async (req, res) => {
  try {
    const { clientId, clientSecret, environment } = req.body || {};
    const customConfig = (clientId && clientSecret) ? {
      clientId,
      clientSecret,
      environment: environment || 'production'
    } : null;

    const result = await xpagService.testConnection(customConfig);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Get Real-time Wallet Balances (BRL, MXN, USDT)
router.get('/xpag/balance', async (req, res) => {
  try {
    const result = await xpagService.getBalance();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Create Dynamic Cash-in Charge (SPEI, PIX, OXXO, USDT)
router.post('/xpag/create-charge', async (req, res) => {
  try {
    const {
      phone,
      amount,
      currency = 'MXN',
      name,
      document,
      description,
      method
    } = req.body || {};

    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    const settings = storage.getSettings();
    const product = settings.product || {};

    const finalAmount = amount || (currency === 'MXN' ? (product.ticketBasic || 150) : (product.price || 15));
    const lead = cleanPhone ? storage.getLead(cleanPhone) : null;
    const customerName = name || lead?.name || 'Cliente Zapix';

    const origin = req.protocol + '://' + req.get('host');
    const webhookUrl = `${origin}/webhooks/xpag`;

    const charge = await xpagService.createCashIn({
      currency,
      amount: finalAmount,
      externalId: cleanPhone || `charge_${Date.now()}`,
      name: customerName,
      document: document || '',
      description: description || `Acesso ${product.name || 'Infoproduto'}`,
      method,
      webhookUrl
    });

    res.json({ success: true, charge });
  } catch (err) {
    console.error('[API /xpag/create-charge Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Consult Transaction
router.get('/xpag/transaction/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = id.startsWith('pr_') ? { transactionId: id } : { externalId: id };
    const result = await xpagService.consultTransaction(query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Sandbox Payment Simulation
router.post('/xpag/simulate-sandbox', async (req, res) => {
  try {
    const { transactionId, outcome = 'paid' } = req.body;
    if (!transactionId) {
      return res.status(400).json({ error: 'transactionId obrigatório' });
    }
    const result = await xpagService.simulateSandboxPayment(transactionId, outcome);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
