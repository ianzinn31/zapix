import React from 'react';
import { 
  Zap, 
  Smartphone, 
  Cpu, 
  Mic, 
  ShieldCheck, 
  DollarSign, 
  MessageSquarePlus, 
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function Header({ 
  whatsappStatus, 
  onOpenQrModal, 
  settings, 
  onSimulateLead, 
  onSimulateSale,
  isRefreshing,
  onRefresh
}) {
  const isConnected = whatsappStatus.status === 'connected';
  const isQrReady = whatsappStatus.status === 'qr_ready';
  const isFallbackActive = settings?.ai?.isFallbackActive;

  const triggerCelebration = () => {
    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.6 }
    });
    onSimulateSale();
  };

  return (
    <header className="glass-card" style={{
      padding: '16px 22px',
      marginBottom: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      border: '1px solid rgba(255, 255, 255, 0.08)'
    }}>
      {/* Top Row: Brand on Left, Action Buttons on Right */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '11px',
            background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 18px rgba(16, 185, 129, 0.45)',
            flexShrink: 0
          }}>
            <Zap size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                Zapix AI
              </span>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '6px',
                padding: '2px 7px',
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase'
              }}>
                Closer v2.4
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
              Agente de Vendas Autônomo para WhatsApp • NVIDIA NIM & Fish Audio
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onRefresh}
            className="btn-secondary"
            style={{ fontSize: '0.82rem', padding: '8px 14px' }}
            title="Atualizar dados em tempo real"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.05)', width: '100%' }}></div>

      {/* Bottom Row: Status Badges Cluster */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* WhatsApp Status Pill */}
          <button
            onClick={onOpenQrModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: isConnected ? 'rgba(16, 185, 129, 0.12)' : isQrReady ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              border: isConnected ? '1px solid rgba(16, 185, 129, 0.35)' : isQrReady ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '6px 13px',
              cursor: 'pointer',
              color: '#f8fafc',
              fontSize: '0.78rem',
              fontWeight: 500,
              transition: 'all 0.15s ease'
            }}
            title="Gerenciar conexão WhatsApp"
          >
            <span className={isConnected ? 'status-pulse-green' : isQrReady ? 'status-pulse-amber' : 'status-pulse-gray'}></span>
            <Smartphone size={14} color={isConnected ? '#34d399' : '#cbd5e1'} />
            <span>
              {isConnected 
                ? `Zap Conectado (${whatsappStatus.connectedNumber || 'Ativo'})` 
                : isQrReady 
                  ? 'Escanear QR Code' 
                  : 'Conectar WhatsApp'}
            </span>
          </button>

          {/* NVIDIA NIM Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            background: isFallbackActive ? 'rgba(245, 158, 11, 0.12)' : 'rgba(139, 92, 246, 0.12)',
            border: isFallbackActive ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '8px',
            padding: '6px 13px',
            fontSize: '0.78rem',
            fontWeight: 500,
            color: isFallbackActive ? '#fbbf24' : '#c084fc'
          }}>
            {isFallbackActive ? <AlertTriangle size={14} color="#fbbf24" /> : <Cpu size={14} />}
            <span>NVIDIA NIM: {isFallbackActive ? 'Fallback Ativo' : 'Primário Ativo'}</span>
          </div>

          {/* Fish Audio Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            background: 'rgba(6, 182, 212, 0.12)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            borderRadius: '8px',
            padding: '6px 13px',
            fontSize: '0.78rem',
            fontWeight: 500,
            color: '#22d3ee'
          }}>
            <Mic size={14} />
            <span>Fish Audio TTS (Voz Humana)</span>
          </div>

          {/* Anti-Ban Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '8px',
            padding: '6px 13px',
            fontSize: '0.78rem',
            fontWeight: 500,
            color: '#34d399'
          }}>
            <ShieldCheck size={14} />
            <span>Anti-Ban 99% (Simulação Humana)</span>
          </div>
        </div>

        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
          API WebSocket: <span style={{ color: '#10b981', fontWeight: 600 }}>Online</span>
        </div>
      </div>
    </header>
  );
}
