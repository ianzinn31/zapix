import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { 
  BarChart3, 
  MessageSquare, 
  Package, 
  Cpu, 
  Mic, 
  ShieldCheck, 
  FileText, 
  Megaphone,
  Bell,
  Sparkles
} from 'lucide-react';

import Header from './components/Header';
import DashboardOverview from './components/DashboardOverview';
import LiveChatInbox from './components/LiveChatInbox';
import ProductSettings from './components/ProductSettings';
import AiConfig from './components/AiConfig';
import FishAudioConfig from './components/FishAudioConfig';
import AntiBanConfig from './components/AntiBanConfig';
import DeliverablesManager from './components/DeliverablesManager';
import MetaAdsConfig from './components/MetaAdsConfig';
import QrConnectModal from './components/QrConnectModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [whatsappStatus, setWhatsappStatus] = useState({
    status: 'disconnected',
    qrCode: null,
    connectedNumber: null
  });
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [leads, setLeads] = useState([]);
  const [selectedLeadPhone, setSelectedLeadPhone] = useState(null);
  const [messages, setMessages] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [sales, setSales] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncingMeta, setIsSyncingMeta] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Socket.io initialization
  useEffect(() => {
    const socket = io();

    socket.on('connect', () => {
      console.log('Connected to backend WebSocket');
    });

    socket.on('whatsapp:status', (data) => {
      setWhatsappStatus((prev) => ({ ...prev, ...data }));
    });

    socket.on('whatsapp:qr', (data) => {
      setWhatsappStatus((prev) => ({ ...prev, qrCode: data.qrCode, status: 'qr_ready' }));
    });

    socket.on('settings:updated', (data) => {
      setSettings(data);
    });

    socket.on('lead:updated', (updatedLead) => {
      setLeads((prev) => {
        const index = prev.findIndex((l) => l.phone === updatedLead.phone);
        if (index >= 0) {
          const next = [...prev];
          next[index] = updatedLead;
          return next;
        }
        return [updatedLead, ...prev];
      });
      fetchMetrics();
    });

    socket.on('lead:deleted', ({ phone }) => {
      setLeads((prev) => prev.filter((l) => l.phone !== phone));
      setMessages((prev) => prev.filter((m) => m.phone !== phone));
      setSelectedLeadPhone((curr) => (curr === phone ? null : curr));
      fetchMetrics();
    });

    socket.on('chat:message', (newMsg) => {
      setMessages((prev) => {
        // Prevent duplicate IDs
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      fetchLogs();
      fetchMetrics();
    });

    socket.on('ai:fallback_event', (event) => {
      showToast(`Alerta: NVIDIA NIM Modelo Primário falhou! Alternado para ${event.modelUsed}`, 'warning');
      fetchLogs();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Fetch initial data
  const loadInitialData = async () => {
    setIsRefreshing(true);
    try {
      const [statusRes, settingsRes, leadsRes, delivRes, metricsRes, logsRes, salesRes] = await Promise.all([
        fetch('/api/whatsapp/status').then((r) => r.json()),
        fetch('/api/settings').then((r) => r.json()),
        fetch('/api/leads').then((r) => r.json()),
        fetch('/api/deliverables').then((r) => r.json()),
        fetch('/api/metrics').then((r) => r.json()),
        fetch('/api/logs').then((r) => r.json()),
        fetch('/api/sales').then((r) => r.json()).catch(() => [])
      ]);

      setWhatsappStatus(statusRes);
      setSettings(settingsRes);
      setLeads(leadsRes);
      setDeliverables(delivRes);
      setMetrics(metricsRes);
      setLogs(logsRes);
      if (Array.isArray(salesRes)) setSales(salesRes);

      if (leadsRes.length > 0 && !selectedLeadPhone) {
        setSelectedLeadPhone(leadsRes[0].phone);
      }
    } catch (err) {
      console.error('Error fetching initial data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Load chat messages when selected lead changes
  useEffect(() => {
    if (selectedLeadPhone) {
      fetch(`/api/messages/${selectedLeadPhone}`)
        .then((r) => r.json())
        .then((data) => setMessages(data))
        .catch((err) => console.error('Error fetching messages:', err));
    }
  }, [selectedLeadPhone]);

  const fetchMetrics = () => {
    fetch('/api/metrics')
      .then((r) => r.json())
      .then((data) => setMetrics(data))
      .catch((e) => console.error(e));
  };

  const fetchLogs = () => {
    fetch('/api/logs')
      .then((r) => r.json())
      .then((data) => setLogs(data))
      .catch((e) => console.error(e));
  };

  // WhatsApp connection actions
  const handleConnectWhatsApp = async () => {
    try {
      await fetch('/api/whatsapp/connect', { method: 'POST' });
      setWhatsappStatus((prev) => ({ ...prev, status: 'connecting' }));
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDisconnectWhatsApp = async () => {
    try {
      await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      setWhatsappStatus({ status: 'disconnected', qrCode: null, connectedNumber: null });
      showToast('WhatsApp desconectado.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Settings Save
  const handleSaveSettings = async (partialSettings) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partialSettings)
      });
      const updated = await res.json();
      setSettings(updated);
      showToast('Configurações atualizadas com sucesso!');
      fetchLogs();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Chat actions
  const handleSendMessage = async (phone, text, type = 'text', mediaUrl = null) => {
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, text, type, mediaUrl })
      });
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      fetchMetrics();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleAi = async (phone, aiActive) => {
    try {
      const res = await fetch(`/api/leads/${phone}/ai-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiActive })
      });
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.phone === phone ? updated : l)));
      showToast(`IA ${aiActive ? 'ativada' : 'pausada'} para ${phone}`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleChangeLeadStage = async (phone, stage) => {
    try {
      const res = await fetch(`/api/leads/${phone}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage })
      });
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.phone === phone ? updated : l)));
      fetchMetrics();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteLead = async (phone) => {
    try {
      const res = await fetch(`/api/leads/${phone}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao excluir lead');
      setLeads((prev) => prev.filter((l) => l.phone !== phone));
      if (selectedLeadPhone === phone) {
        setSelectedLeadPhone(null);
        setMessages([]);
      }
      showToast('Lead e histórico excluídos com sucesso!');
      fetchMetrics();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdateLead = async (phone, updates) => {
    try {
      const res = await fetch(`/api/leads/${phone}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Falha ao atualizar lead');
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.phone === phone ? updated : l)));
      showToast('Lead atualizado com sucesso!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSyncLead = async (phone) => {
    try {
      showToast('Buscando dados no WhatsApp...', 'info');
      const res = await fetch(`/api/leads/${phone}/sync`, { method: 'POST' });
      if (!res.ok) throw new Error('Falha ao sincronizar com WhatsApp');
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.phone === phone ? { ...l, ...updated } : l)));
      showToast('Dados sincronizados do WhatsApp!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Deliverables
  const handleUploadDeliverable = async (formData) => {
    const res = await fetch('/api/deliverables', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Falha no upload');
    const newDeliv = await res.json();
    setDeliverables((prev) => [...prev, newDeliv]);
    showToast('Entregável cadastrado com sucesso!');
    fetchLogs();
  };

  const handleDeleteDeliverable = async (id) => {
    await fetch(`/api/deliverables/${id}`, { method: 'DELETE' });
    setDeliverables((prev) => prev.filter((d) => d.id !== id));
    showToast('Entregável removido.');
  };

  // Meta Ads Spend Sync
  const handleSyncMeta = async () => {
    setIsSyncingMeta(true);
    try {
      const res = await fetch('/api/meta-ads/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`Meta Ads sincronizado! Gasto: R$ ${data.spend.toFixed(2)}`);
      fetchMetrics();
      fetchLogs();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSyncingMeta(false);
    }
  };

  // Simulators for testing
  const handleSimulateLead = async () => {
    const testPhones = ['5511998877665', '5521991234567', '5531987654321', '5541995544332'];
    const randomPhone = testPhones[Math.floor(Math.random() * testPhones.length)];
    const testQuestions = [
      'Oi! Vi o anúncio no Insta e queria saber como funciona o método de renda com IA?',
      'Qual o valor do treinamento? Tem desconto à vista?',
      'Será que funciona pra mim? Não entendo nada de computador ou programação.',
      'Você tem alguma prova ou resultado de aluno para eu ver?',
      'Como faço pra me inscrever agora?'
    ];
    const randomMsg = testQuestions[Math.floor(Math.random() * testQuestions.length)];

    try {
      await fetch('/api/messages/simulate-incoming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: randomPhone,
          name: `Lead Interessado ${randomPhone.slice(-4)}`,
          text: randomMsg
        })
      });
      setSelectedLeadPhone(randomPhone);
      showToast(`Mensagem de lead simulada (${randomPhone})! A IA está respondendo com simulação humana...`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSimulateSale = async () => {
    try {
      const platforms = ['Kiwify', 'Hotmart', 'PerfectPay'];
      const randomPlatform = platforms[Math.floor(Math.random() * platforms.length)];
      await fetch('/api/sales/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedLeadPhone || '5511999998888',
          customerName: 'Novo Aluno VIP',
          amount: settings?.product?.price || 97.00,
          platform: randomPlatform
        })
      });
      showToast(`🎉 Venda aprovada na ${randomPlatform} computada!`, 'success');
      fetchMetrics();
      fetchLogs();
      fetch('/api/sales').then((r) => r.json()).then((data) => setSales(data)).catch(() => {});
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Fish Audio test synthesizer
  const handleTestAudio = async (text, voiceId, model) => {
    const res = await fetch('/api/fish-audio/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId, model })
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Erro na síntese');
    }
    return await res.json();
  };

  const navTabs = [
    { id: 'dashboard', label: 'Métricas & Vendas', icon: BarChart3 },
    { id: 'chat', label: 'WhatsApp Live', icon: MessageSquare, badge: leads.length },
    { id: 'product', label: 'Oferta & Infoproduto', icon: Package },
    { id: 'deliverables', label: 'Entregáveis (PDF/Foto)', icon: FileText, badge: deliverables.length },
    { id: 'ai', label: 'NVIDIA NIM (IA)', icon: Cpu },
    { id: 'fish_audio', label: 'Fish Audio (Voz)', icon: Mic },
    { id: 'anti_ban', label: 'Anti-Banimento', icon: ShieldCheck },
    { id: 'meta_ads', label: 'Meta Ads & Webhooks', icon: Megaphone }
  ];

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '16px 20px 60px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          padding: '10px 18px',
          borderRadius: '8px',
          background: toastMessage.type === 'error' ? 'rgba(244, 63, 94, 0.95)' : toastMessage.type === 'warning' ? 'rgba(245, 158, 11, 0.95)' : 'rgba(16, 185, 129, 0.95)',
          backdropFilter: 'blur(10px)',
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.82rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Header */}
      <Header
        whatsappStatus={whatsappStatus}
        onOpenQrModal={() => setIsQrModalOpen(true)}
        settings={settings}
        onSimulateLead={handleSimulateLead}
        onSimulateSale={handleSimulateSale}
        isRefreshing={isRefreshing}
        onRefresh={loadInitialData}
      />

      {/* Navigation Tabs Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        overflowX: 'auto',
        padding: '6px',
        background: 'rgba(13, 20, 36, 0.6)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        marginBottom: '20px',
        scrollbarWidth: 'none'
      }}>
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: isActive ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(6, 182, 212, 0.18) 100%)' : 'transparent',
                color: isActive ? '#34d399' : '#94a3b8',
                border: isActive ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.68rem',
                  background: isActive ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 255, 255, 0.08)',
                  color: isActive ? '#ffffff' : '#cbd5e1',
                  fontWeight: 700
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Tab View */}
      <main>
        {activeTab === 'dashboard' && (
          <DashboardOverview
            metrics={metrics}
            sales={sales}
            logs={logs}
            onSyncMeta={handleSyncMeta}
            isSyncingMeta={isSyncingMeta}
          />
        )}

        {activeTab === 'chat' && (
          <LiveChatInbox
            leads={leads}
            selectedLeadPhone={selectedLeadPhone}
            onSelectLead={(phone) => setSelectedLeadPhone(phone)}
            messages={messages}
            onSendMessage={handleSendMessage}
            onToggleAi={handleToggleAi}
            onChangeLeadStage={handleChangeLeadStage}
            onDeleteLead={handleDeleteLead}
            onUpdateLead={handleUpdateLead}
            onSyncLead={handleSyncLead}
            product={settings?.product}
            deliverables={deliverables}
          />
        )}

        {activeTab === 'product' && (
          <ProductSettings
            product={settings?.product}
            onSave={handleSaveSettings}
          />
        )}

        {activeTab === 'deliverables' && (
          <DeliverablesManager
            deliverables={deliverables}
            onUpload={handleUploadDeliverable}
            onDelete={handleDeleteDeliverable}
          />
        )}

        {activeTab === 'ai' && (
          <AiConfig
            aiSettings={settings?.ai}
            onSave={handleSaveSettings}
          />
        )}

        {activeTab === 'fish_audio' && (
          <FishAudioConfig
            fishSettings={settings?.fishAudio}
            transcriptionSettings={settings?.transcription}
            onSave={handleSaveSettings}
            onTestAudio={handleTestAudio}
          />
        )}

        {activeTab === 'anti_ban' && (
          <AntiBanConfig
            antiBanSettings={settings?.antiBan}
            onSave={handleSaveSettings}
          />
        )}

        {activeTab === 'meta_ads' && (
          <MetaAdsConfig
            metaSettings={settings?.metaAds}
            onSave={handleSaveSettings}
            onSyncMeta={handleSyncMeta}
            isSyncing={isSyncingMeta}
          />
        )}
      </main>

      {/* QR Code WhatsApp Connect Modal */}
      <QrConnectModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        whatsappStatus={whatsappStatus}
        onConnect={handleConnectWhatsApp}
        onDisconnect={handleDisconnectWhatsApp}
      />
    </div>
  );
}
