import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { storage, UPLOADS_DIR } from '../services/storage.js';
import { whatsapp } from '../services/whatsapp.js';
import { salesMetrics } from '../services/salesMetrics.js';
import { fishAudio } from '../services/fishAudio.js';
import { nvidiaNim } from '../services/nvidiaNim.js';

const router = Router();

// Multer storage for PDF and Image deliverables
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
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
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// === WhatsApp Connection Status & Controls ===
router.get('/whatsapp/status', (req, res) => {
  res.json(whatsapp.getStatus());
});

router.post('/whatsapp/connect', async (req, res) => {
  whatsapp.initialize();
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

// === Leads ===
router.get('/leads', (req, res) => {
  res.json(storage.getLeads());
});

router.put('/leads/:phone', (req, res) => {
  const { phone } = req.params;
  const updates = req.body;
  const updated = storage.upsertLead(phone, updates);
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
    return res.status(400).json({ error: 'Telefone e conteúdo são obrigatórios' });
  }

  try {
    const msg = await whatsapp.sendManualMessage(phone, text, type, mediaUrl);
    res.json(msg);
  } catch (err) {
    // If WhatsApp is offline, still save the message in DB for testing
    const fallbackMsg = storage.addMessage({
      phone,
      fromMe: true,
      text: text || '',
      type: type || 'text',
      mediaUrl: mediaUrl || null
    });
    whatsapp.emit('chat:message', fallbackMsg);
    res.json({ ...fallbackMsg, warning: 'WhatsApp offline. Mensagem registrada localmente.' });
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

router.post('/deliverables', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }

  const { name, tag, description } = req.body;
  const isPdf = req.file.mimetype.includes('pdf');
  const type = isPdf ? 'pdf' : 'image';

  const newDeliverable = storage.addDeliverable({
    name: name || req.file.originalname,
    filename: req.file.filename,
    type,
    tag: (tag || name || 'ARQUIVO').toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
    description: description || '',
    url: `/uploads/${req.file.filename}`,
    path: `/data/uploads/${req.file.filename}`,
    size: req.file.size
  });

  storage.addLog('SUCCESS', `Entregável adicionado: ${newDeliverable.name} (${newDeliverable.type})`);
  res.json(newDeliverable);
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

// === Fish Audio Test Synthesis ===
router.post('/fish-audio/test', async (req, res) => {
  const { text, voiceId, model } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Texto obrigatório' });
  }

  try {
    const result = await fishAudio.generateSpeech(text, model, voiceId);
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

// === System Logs ===
router.get('/logs', (req, res) => {
  res.json(storage.getLogs(60));
});

export default router;
