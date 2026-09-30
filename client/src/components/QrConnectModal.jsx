import React from 'react';
import { 
  X, 
  Smartphone, 
  CheckCircle2, 
  RefreshCw, 
  LogOut, 
  ShieldCheck, 
  QrCode as QrIcon 
} from 'lucide-react';

export default function QrConnectModal({ 
  isOpen, 
  onClose, 
  whatsappStatus, 
  onConnect, 
  onDisconnect 
}) {
  if (!isOpen) return null;

  const isConnected = whatsappStatus.status === 'connected';
  const isQrReady = whatsappStatus.status === 'qr_ready';
  const isConnecting = whatsappStatus.status === 'connecting';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(7, 10, 18, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div className="glass-card" style={{
        maxWidth: '460px',
        width: '100%',
        padding: '28px',
        position: 'relative',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '10px', color: '#10b981' }}>
            <Smartphone size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
              Conexão com WhatsApp Web
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              API Não-Oficial com Protocolo Baileys & Multi-Device
            </p>
          </div>
        </div>

        {/* State 1: Connected */}
        {isConnected ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <CheckCircle2 size={36} />
            </div>

            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
              WhatsApp Conectado com Sucesso!
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '20px' }}>
              Número ativo: <strong style={{ color: '#34d399' }}>+{whatsappStatus.connectedNumber || 'Ativo'}</strong>
            </p>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '12px',
              borderRadius: '10px',
              marginBottom: '24px',
              fontSize: '0.78rem',
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <ShieldCheck size={18} color="#10b981" />
              <span>O Agente Zapix está ativo e pronto para atender leads automaticamente.</span>
            </div>

            <button
              onClick={onDisconnect}
              className="btn-outline-danger"
              style={{ width: '100%', padding: '10px', fontSize: '0.88rem' }}
            >
              <LogOut size={16} />
              <span>Desconectar este Número</span>
            </button>
          </div>
        ) : isQrReady && whatsappStatus.qrCode ? (
          /* State 2: QR Code Ready */
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '16px' }}>
              Aponte a câmera do WhatsApp para conectar o robô de vendas:
            </p>

            {/* QR Code Frame */}
            <div style={{
              background: '#ffffff',
              padding: '16px',
              borderRadius: '14px',
              display: 'inline-block',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
              marginBottom: '16px'
            }}>
              <img
                src={whatsappStatus.qrCode}
                alt="WhatsApp QR Code"
                style={{ width: '220px', height: '220px', display: 'block' }}
              />
            </div>

            {/* Step-by-Step Instructions */}
            <div style={{
              textAlign: 'left',
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '12px 16px',
              borderRadius: '10px',
              fontSize: '0.78rem',
              color: '#94a3b8',
              marginBottom: '16px',
              lineHeight: 1.6
            }}>
              <div>1. Abra o WhatsApp no seu smartphone</div>
              <div>2. Toque em <strong>Configurações &gt; Aparelhos Conectados</strong></div>
              <div>3. Toque em <strong>Conectar Aparelho</strong> e aponte para o QR Code</div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={onConnect}
                className="btn-secondary"
                style={{ flex: 1, padding: '10px' }}
              >
                <RefreshCw size={15} />
                <span>Atualizar QR Code</span>
              </button>
            </div>
          </div>
        ) : (
          /* State 3: Disconnected / Connecting */
          <div style={{ textAlign: 'center', padding: '30px 10px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <QrIcon size={32} />
            </div>

            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
              Nenhum WhatsApp Conectado
            </h4>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '24px' }}>
              Clique abaixo para inicializar o socket seguro e gerar o QR Code de autenticação.
            </p>

            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="btn-primary"
              style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
            >
              <RefreshCw size={16} className={isConnecting ? 'animate-spin' : ''} />
              <span>{isConnecting ? 'Gerando QR Code Seguro...' : 'Gerar QR Code de Conexão'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
