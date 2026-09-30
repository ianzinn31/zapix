-- ========================================================
-- Zapix AI - Script de Criação de Tabelas no Supabase
-- Cole e execute este script no "SQL Editor" do Supabase
-- ========================================================

-- 1. Tabela de Configurações Globais (IA, Fish Audio, Anti-Ban, Oferta, Meta Ads)
CREATE TABLE IF NOT EXISTS zapix_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Leads do WhatsApp
CREATE TABLE IF NOT EXISTS zapix_leads (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  stage TEXT DEFAULT 'NOVO', -- NOVO, EM_CONVERSA, PITCH_ENVIADO, CHECKOUT, APROVADO, PERDIDO
  ai_active BOOLEAN DEFAULT TRUE,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  last_message TEXT,
  last_message_from_me BOOLEAN DEFAULT FALSE,
  unread_count INT DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- 3. Tabela de Mensagens Trocadas no WhatsApp (Chat History)
CREATE TABLE IF NOT EXISTS zapix_messages (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  from_me BOOLEAN DEFAULT FALSE,
  text TEXT,
  type TEXT DEFAULT 'text', -- text, audio, image, document
  media_url TEXT,
  audio_duration INT,
  status TEXT DEFAULT 'delivered',
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zapix_messages_phone ON zapix_messages (phone);
CREATE INDEX IF NOT EXISTS idx_zapix_messages_timestamp ON zapix_messages (timestamp DESC);

-- 4. Tabela de Entregáveis (PDFs, Amostras, Provas Sociais)
CREATE TABLE IF NOT EXISTS zapix_deliverables (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  filename TEXT NOT NULL,
  type TEXT NOT NULL, -- pdf, image
  tag TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  path TEXT,
  size BIGINT DEFAULT 0,
  created_at BIGINT NOT NULL
);

-- 5. Tabela de Vendas Aprovadas (Kiwify, Hotmart, PerfectPay, Cakto)
CREATE TABLE IF NOT EXISTS zapix_sales (
  id TEXT PRIMARY KEY,
  lead_id TEXT,
  phone TEXT,
  customer_name TEXT DEFAULT 'Cliente',
  amount NUMERIC(10, 2) NOT NULL,
  platform TEXT DEFAULT 'Kiwify',
  status TEXT DEFAULT 'approved',
  created_at BIGINT NOT NULL
);

-- 6. Tabela de Logs do Sistema & Eventos de Fallback
CREATE TABLE IF NOT EXISTS zapix_logs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- INFO, SUCCESS, WARNING, ERROR, FALLBACK_TRIGGERED
  message TEXT NOT NULL,
  meta JSONB,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Desabilitar Row Level Security (RLS) para acesso direto da API com service_role ou anon key
ALTER TABLE zapix_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE zapix_leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE zapix_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE zapix_deliverables DISABLE ROW LEVEL SECURITY;
ALTER TABLE zapix_sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE zapix_logs DISABLE ROW LEVEL SECURITY;
