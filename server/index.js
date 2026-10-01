import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import apiRouter from './routes/api.js';
import webhooksRouter from './routes/webhooks.js';
import { whatsapp } from './services/whatsapp.js';
import { storage, DATA_DIR, UPLOADS_DIR, AUDIO_CACHE_DIR, MEDIA_CACHE_DIR } from './services/storage.js';
import { remarketingService } from './services/remarketingService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Attach socket.io to WhatsApp service
whatsapp.setSocketIo(io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Static directories for deliverables & audio/media cache
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/audio', express.static(AUDIO_CACHE_DIR));
app.use('/media', express.static(MEDIA_CACHE_DIR));

// Routes
app.use('/api', apiRouter);
app.use('/webhooks', webhooksRouter);

// Serve built frontend if client/dist exists
const clientDistPath = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/webhooks') && !req.path.startsWith('/uploads') && !req.path.startsWith('/audio')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[Socket.io] Dashboard client connected: ${socket.id}`);

  // Send initial statuses immediately upon dashboard connection
  socket.emit('whatsapp:status', whatsapp.getStatus());
  socket.emit('settings:updated', storage.getSettings());

  socket.on('disconnect', () => {
    // client disconnected
  });
});

const PORT = process.env.PORT || 3001;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ [Zapix Server] ERRO: A porta ${PORT} já está em uso por outro aplicativo!`);
    console.error(`👉 Dica: Se o navegador Dolphin Anty estiver aberto, ele costuma usar a porta 3001 por padrão. Feche-o ou encerre o processo anterior para liberar a porta.\n`);
  } else {
    console.error('[Zapix Server] Erro ao iniciar servidor HTTP:', err);
  }
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Zapix AI - WhatsApp Sales Agent Server rodando!`);
  console.log(`🌐 Backend API & WebSockets: http://localhost:${PORT}`);
  console.log(`📊 Dashboard UI: http://localhost:5173 (dev) ou :${PORT}`);
  console.log(`⚡ NVIDIA NIM Dual Fallback: Pronto`);
  console.log(`🎙️ Fish Audio TTS + Opus WhatsApp PTT: Pronto`);
  console.log(`🛡️ Anti-Ban & Human Simulation: Ativado`);
  console.log(`=======================================================`);

  storage.addLog('INFO', `Servidor Zapix AI iniciado com sucesso na porta ${PORT}`);
  
  // Start background remarketing monitor
  remarketingService.init();

  // Auto-connect WhatsApp if saved session credentials exist
  const authCredsPath = path.join(DATA_DIR, 'auth_info_baileys', 'creds.json');
  if (fs.existsSync(authCredsPath)) {
    console.log('[WhatsApp] Sessão salva encontrada em disco. Conectando automaticamente...');
    whatsapp.initialize();
  }
});
