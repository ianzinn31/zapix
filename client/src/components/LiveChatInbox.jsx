import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Send, 
  Bot, 
  User, 
  Mic, 
  Play, 
  Pause, 
  FileText, 
  Image as ImageIcon, 
  ExternalLink, 
  Sparkles, 
  CheckCheck, 
  DollarSign, 
  Zap, 
  Clock,
  ShieldAlert,
  Trash2,
  Edit2,
  RefreshCw,
  RotateCcw,
  Check,
  X,
  Phone
} from 'lucide-react';

export function formatPhoneNumber(raw) {
  if (!raw) return '';
  const num = String(raw).replace(/[^0-9]/g, '');
  if (num.length === 13 && num.startsWith('55')) {
    return `+55 (${num.slice(2, 4)}) ${num.slice(4, 9)}-${num.slice(9)}`;
  }
  if (num.length === 12 && num.startsWith('55')) {
    return `+55 (${num.slice(2, 4)}) ${num.slice(4, 8)}-${num.slice(8)}`;
  }
  if (num.length === 11) {
    return `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7)}`;
  }
  if (num.length === 10) {
    return `(${num.slice(0, 2)}) ${num.slice(2, 6)}-${num.slice(6)}`;
  }
  return `+${num}`;
}

export default function LiveChatInbox({ 
  leads, 
  selectedLeadPhone, 
  onSelectLead, 
  messages, 
  onSendMessage, 
  onToggleAi, 
  onChangeLeadStage,
  onDeleteLead,
  onResetLead,
  onUpdateLead,
  onSyncLead,
  product,
  deliverables,
  whatsappStatus
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [leadToReset, setLeadToReset] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const audioRefs = useRef({});
  const messagesEndRef = useRef(null);

  // Filter leads by search term
  const filteredLeads = leads.filter((lead) => {
    const term = searchTerm.toLowerCase();
    const phone = (lead.phone || '').toLowerCase();
    const name = (lead.name || '').toLowerCase();
    const formatted = formatPhoneNumber(lead.phone).toLowerCase();
    return phone.includes(term) || name.includes(term) || formatted.includes(term);
  });

  const activeLead = leads.find((l) => l.phone === selectedLeadPhone) || filteredLeads[0];

  // Auto scroll to bottom of chat when new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setEditingName(false);
  }, [messages, selectedLeadPhone]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const textToSend = inputMessage.trim();
    if (!textToSend || !activeLead || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage(activeLead.phone, textToSend, 'text');
      setInputMessage('');
    } catch (err) {
      console.error('[LiveChatInbox] Erro ao enviar mensagem:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveName = async () => {
    if (!activeLead || !nameInput.trim()) return;
    if (onUpdateLead) {
      await onUpdateLead(activeLead.phone, { name: nameInput.trim() });
    }
    setEditingName(false);
  };

  const handleSyncLeadInfo = async () => {
    if (!activeLead || !onSyncLead) return;
    setIsSyncing(true);
    try {
      await onSyncLead(activeLead.phone);
    } finally {
      setIsSyncing(false);
    }
  };

  const togglePlayAudio = (msgId, audioUrl) => {
    if (playingAudioId === msgId) {
      if (audioRefs.current[msgId]) {
        audioRefs.current[msgId].pause();
      }
      setPlayingAudioId(null);
    } else {
      // Pause any currently playing audio
      if (playingAudioId && audioRefs.current[playingAudioId]) {
        audioRefs.current[playingAudioId].pause();
      }

      if (!audioRefs.current[msgId]) {
        const audio = new Audio(audioUrl);
        audio.onended = () => setPlayingAudioId(null);
        audioRefs.current[msgId] = audio;
      }

      audioRefs.current[msgId].play();
      setPlayingAudioId(msgId);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', height: 'calc(100vh - 170px)', minHeight: '620px' }}>
      
      {/* Delete Confirmation Modal */}
      {leadToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-card" style={{ maxWidth: '440px', width: '100%', padding: '24px', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ padding: '10px', background: 'rgba(244, 63, 94, 0.15)', borderRadius: '10px', color: '#f43f5e' }}>
                <Trash2 size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                  Excluir Lead e Conversa?
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Esta ação é irreversível.
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5', marginBottom: '20px' }}>
              Você está excluindo o lead <strong>{leadToDelete.name || formatPhoneNumber(leadToDelete.phone)}</strong> ({formatPhoneNumber(leadToDelete.phone)}). Todas as mensagens e mídias desta conversa serão permanentemente apagadas.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setLeadToDelete(null)}
                className="btn-secondary"
                style={{ fontSize: '0.82rem' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteLead) onDeleteLead(leadToDelete.phone);
                  setLeadToDelete(null);
                }}
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 18px',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer'
                }}
              >
                Excluir Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Funnel Confirmation Modal */}
      {leadToReset && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-card" style={{ maxWidth: '460px', width: '100%', padding: '24px', border: '1px solid rgba(99, 102, 241, 0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '10px', color: '#818cf8' }}>
                <RotateCcw size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                  Resetar Funil e Testar do Zero?
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Limpa o histórico e reinicia a memória da IA.
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5', marginBottom: '20px' }}>
              Você está resetando o lead <strong>{leadToReset.name || formatPhoneNumber(leadToReset.phone)}</strong> ({formatPhoneNumber(leadToReset.phone)}).
              <br /><br />
              Todas as mensagens desta conversa serão apagadas e o funil voltará ao estágio <strong>NOVO LEAD</strong>. A IA esquecerá os PDFs enviados, o PIX e comprovantes anteriores para você poder testar o atendimento do início no WhatsApp.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setLeadToReset(null)}
                className="btn-secondary"
                style={{ fontSize: '0.82rem' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onResetLead) onResetLead(leadToReset.phone);
                  setLeadToReset(null);
                }}
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 18px',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RotateCcw size={14} />
                <span>Resetar e Testar do Zero</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left Sidebar: Leads List */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Search Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou número..."
              className="input-field"
              style={{ paddingLeft: '38px', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* Lead List Scrollable */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredLeads.length === 0 ? (
            <div style={{ padding: '30px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              Nenhum lead encontrado.
            </div>
          ) : (
            filteredLeads.map((lead) => {
              const isSelected = activeLead?.phone === lead.phone;
              return (
                <div
                  key={lead.phone}
                  onClick={() => onSelectLead(lead.phone)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #10b981' : '3px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {lead.avatarUrl ? (
                        <img 
                          src={lead.avatarUrl} 
                          alt="" 
                          style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} 
                        />
                      ) : (
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: isSelected ? '#10b981' : '#1e293b',
                          color: isSelected ? '#ffffff' : '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.8rem',
                          fontWeight: 700
                        }}>
                          {lead.name ? lead.name[0].toUpperCase() : 'Z'}
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lead.name || formatPhoneNumber(lead.phone)}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {formatPhoneNumber(lead.phone)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`badge badge-${(lead.stage || 'novo').toLowerCase()}`} style={{ fontSize: '0.62rem' }}>
                        {lead.stage || 'NOVO'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLeadToReset(lead);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Resetar Funil (Testar do Zero)"
                      >
                        <RotateCcw size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLeadToDelete(lead);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#475569',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Excluir Lead"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <span style={{
                      fontSize: '0.76rem',
                      color: isSelected ? '#cbd5e1' : '#94a3b8',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '180px'
                    }}>
                      {lead.lastMessage || 'Conversa iniciada'}
                    </span>

                    <span style={{
                      fontSize: '0.65rem',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: lead.aiActive !== false ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                      color: lead.aiActive !== false ? '#34d399' : '#fb7185',
                      fontWeight: 600
                    }}>
                      {lead.aiActive !== false ? 'IA ON' : 'IA OFF'}
                    </span>
                    {lead.lastReceiptStatus && (
                      <span style={{
                        fontSize: '0.62rem',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: lead.lastReceiptStatus === 'APROVADO' 
                          ? 'rgba(16, 185, 129, 0.2)' 
                          : lead.lastReceiptStatus === 'AGENDADO'
                          ? 'rgba(245, 158, 11, 0.25)'
                          : 'rgba(239, 68, 68, 0.2)',
                        color: lead.lastReceiptStatus === 'APROVADO' 
                          ? '#10b981' 
                          : lead.lastReceiptStatus === 'AGENDADO'
                          ? '#f59e0b'
                          : '#ef4444',
                        fontWeight: 700,
                        marginLeft: '4px'
                      }}>
                        {lead.lastReceiptStatus === 'APROVADO' ? '✓ PIX Pago' : lead.lastReceiptStatus === 'AGENDADO' ? '⏳ Agendado' : '✕ Inválido'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeLead ? (
          <>
            {/* Chat Header */}
            <div style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(11, 17, 32, 0.4)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {activeLead.avatarUrl ? (
                  <img 
                    src={activeLead.avatarUrl} 
                    alt="" 
                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} 
                  />
                ) : (
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700
                  }}>
                    {activeLead.name ? activeLead.name[0].toUpperCase() : 'W'}
                  </div>
                )}

                <div>
                  {/* Lead Name with Inline Edit & WhatsApp Sync */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {editingName ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="text"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          className="input-field"
                          style={{ padding: '3px 8px', fontSize: '0.88rem', height: '28px', width: '180px' }}
                          placeholder="Nome do Lead"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveName();
                            if (e.key === 'Escape') setEditingName(false);
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleSaveName}
                          style={{ background: '#10b981', border: 'none', borderRadius: '4px', padding: '5px', cursor: 'pointer', color: '#fff', display: 'flex' }}
                          title="Salvar Nome"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingName(false)}
                          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', padding: '5px', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}
                          title="Cancelar"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#f8fafc' }}>
                          {activeLead.name || formatPhoneNumber(activeLead.phone)}
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            setNameInput(activeLead.name || '');
                            setEditingName(true);
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px', display: 'flex' }}
                          title="Editar Nome do Lead"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={handleSyncLeadInfo}
                          disabled={isSyncing}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#38bdf8', padding: '2px', display: 'flex' }}
                          title="Puxar Nome e Foto do WhatsApp"
                        >
                          <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                        </button>
                      </>
                    )}

                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      ({formatPhoneNumber(activeLead.phone)})
                    </span>
                  </div>

                  {/* Funnel Stage Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Estágio:</span>
                    <select
                      value={activeLead.stage || 'NOVO'}
                      onChange={(e) => onChangeLeadStage(activeLead.phone, e.target.value)}
                      style={{
                        background: '#0e172a',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="NOVO">NOVO LEAD</option>
                      <option value="EM_CONVERSA">EM CONVERSA</option>
                      <option value="PITCH_ENVIADO">PITCH ENVIADO</option>
                      <option value="CHECKOUT">LINK CHECKOUT</option>
                      <option value="APROVADO">VENDA APROVADA</option>
                      <option value="PERDIDO">PERDIDO</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Right Controls: AI Switch & Delete Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.78rem', color: activeLead.aiActive !== false ? '#34d399' : '#94a3b8', fontWeight: 600 }}>
                    {activeLead.aiActive !== false ? 'IA Ativa' : 'Pausado'}
                  </span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={activeLead.aiActive !== false}
                      onChange={(e) => onToggleAi(activeLead.phone, e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => setLeadToReset(activeLead)}
                  style={{
                    background: 'rgba(99, 102, 241, 0.12)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: '6px',
                    padding: '5px 10px',
                    color: '#a5b4fc',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  title="Apagar mensagens e resetar o funil deste lead para testar do zero no WhatsApp"
                >
                  <RotateCcw size={13} />
                  <span>Resetar Funil (Testar do Zero)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLeadToDelete(activeLead)}
                  style={{
                    background: 'rgba(244, 63, 94, 0.1)',
                    border: '1px solid rgba(244, 63, 94, 0.25)',
                    borderRadius: '6px',
                    padding: '5px 10px',
                    color: '#fb7185',
                    fontSize: '0.74rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                  title="Excluir este lead e todo o histórico da conversa"
                >
                  <Trash2 size={13} />
                  <span>Excluir Lead</span>
                </button>
              </div>
            </div>

            {/* Chat Messages Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.02) 0%, transparent 70%)'
            }}>
              {messages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: '#64748b' }}>
                  <p style={{ fontSize: '0.9rem', marginBottom: '6px' }}>Nenhuma mensagem nesta conversa ainda.</p>
                  <span style={{ fontSize: '0.75rem' }}>As mensagens trocadas aparecerão aqui em tempo real via WhatsApp.</span>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.fromMe;
                  const isAudio = msg.type === 'audio';
                  const isDeliverable = msg.type === 'pdf' || msg.type === 'image' || msg.type === 'document';

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start',
                        width: '100%'
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '75%',
                          padding: '10px 14px',
                          borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                          background: isMe ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)' : 'rgba(30, 41, 59, 0.85)',
                          border: isMe ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                          color: '#f8fafc',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                        }}
                      >
                        {/* Header badge inside bubble */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: isMe ? '#34d399' : '#94a3b8' }}>
                            {isMe ? '🤖 IA Zapix / Você' : (activeLead.name || formatPhoneNumber(activeLead.phone))}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {msg.status === 'failed' && (
                              <span style={{ fontSize: '0.62rem', color: '#f43f5e', background: 'rgba(244, 63, 94, 0.15)', padding: '1px 5px', borderRadius: '4px' }}>
                                Não entregue
                              </span>
                            )}
                            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                              {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        {/* Audio Message Player (Fish Audio PTT / Groq STT) */}
                        {isAudio ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <button
                                onClick={() => msg.mediaUrl && togglePlayAudio(msg.id, msg.mediaUrl)}
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: '50%',
                                  background: isMe ? '#10b981' : '#06b6d4',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  color: '#fff'
                                }}
                              >
                                {playingAudioId === msg.id ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: '2px' }} />}
                              </button>

                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '24px' }}>
                                  <div className="wave-bar"></div>
                                  <div className="wave-bar"></div>
                                  <div className="wave-bar"></div>
                                  <div className="wave-bar"></div>
                                  <div className="wave-bar"></div>
                                  <div className="wave-bar"></div>
                                  <div className="wave-bar"></div>
                                </div>
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                  {msg.audioDuration ? `00:${String(msg.audioDuration).padStart(2, '0')}` : '00:08'} • Nota de Voz PTT
                                </span>
                              </div>
                            </div>

                            {/* Transcription text if available */}
                            {msg.text && (
                              <div style={{ fontSize: '0.78rem', color: '#e2e8f0', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px' }}>
                                <span style={{ color: isMe ? '#34d399' : '#38bdf8', fontSize: '0.7rem', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                                  {isMe ? '🗣️ Texto Sintetizado:' : '🎙️ Transcrição Groq:'}
                                </span>
                                <span style={{ fontStyle: 'italic' }}>
                                  {msg.text.replace(/🎵\s*\[(?:Áudio|Áudio do Cliente)\]:?\s*/i, '').replace(/^"|"$/g, '')}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : isDeliverable ? (
                          /* Deliverable Document or Image Preview */
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' }}>
                            {msg.type === 'image' && msg.mediaUrl && (
                              <a
                                href={msg.mediaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'block', borderRadius: '8px', overflow: 'hidden', maxWidth: '280px', border: '1px solid rgba(255,255,255,0.1)' }}
                              >
                                <img
                                  src={msg.mediaUrl}
                                  alt="Comprovante / Anexo"
                                  style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }}
                                />
                              </a>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                padding: '10px',
                                background: 'rgba(255, 255, 255, 0.08)',
                                borderRadius: '8px',
                                color: msg.type === 'pdf' ? '#f43f5e' : '#fbbf24'
                              }}>
                                {msg.type === 'pdf' ? <FileText size={24} /> : <ImageIcon size={24} />}
                              </div>
                              <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'pre-wrap' }}>
                                  {msg.text}
                                </div>
                                {msg.mediaUrl && (
                                  <a
                                    href={msg.mediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: '0.75rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}
                                  >
                                    <span>Visualizar Anexo Completo</span>
                                    <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Regular text message */
                          <div style={{ fontSize: '0.88rem', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
                            {msg.text}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions Toolbar */}
            <div style={{
              padding: '6px 20px',
              background: 'rgba(15, 23, 42, 0.6)',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
              whiteSpace: 'nowrap'
            }}>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Zap size={12} color="#fbbf24" />
                Atalhos:
              </span>

              {product?.pixKey && (
                <button
                  type="button"
                  onClick={() => {
                    const beneficiaryText = product.pixBeneficiary ? ` (Titular: ${product.pixBeneficiary})` : '';
                    const priceText = product.price ? `R$ ${Number(product.price).toFixed(2)}` : 'da oferta';
                    setInputMessage(`🔑 Segue a nossa chave PIX para pagamento:\n\n${product.pixKey}${beneficiaryText}\nValor: ${priceText}\n\nAssim que fizer a transferência, me mande o comprovante aqui para liberarmos seu acesso imediatamente!`);
                  }}
                  style={{
                    fontSize: '0.72rem',
                    padding: '4px 10px',
                    borderRadius: '14px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#34d399',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Inserir chave PIX no campo de texto"
                >
                  <span>🔑 Enviar PIX</span>
                </button>
              )}

              {product?.checkoutUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setInputMessage(`💳 Segue o link seguro para garantir seu acesso com cartão ou parcelamento:\n\n${product.checkoutUrl}\n\nQualquer dúvida no preenchimento é só me chamar!`);
                  }}
                  style={{
                    fontSize: '0.72rem',
                    padding: '4px 10px',
                    borderRadius: '14px',
                    background: 'rgba(6, 182, 212, 0.12)',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    color: '#22d3ee',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Inserir link do checkout no campo de texto"
                >
                  <span>💳 Enviar Checkout</span>
                </button>
              )}

              {deliverables && deliverables.length > 0 && deliverables.slice(0, 2).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setInputMessage(`[ENVIAR_ARQUIVO: ${d.tag}]`);
                  }}
                  style={{
                    fontSize: '0.72rem',
                    padding: '4px 10px',
                    borderRadius: '14px',
                    background: 'rgba(168, 85, 247, 0.12)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    color: '#c084fc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title={`Despachar entregável ${d.name}`}
                >
                  <span>📎 {d.name.slice(0, 16)}</span>
                </button>
              ))}
            </div>

            {/* Offline Alert if WhatsApp not connected */}
            {whatsappStatus && whatsappStatus.status !== 'connected' && (
              <div style={{
                padding: '6px 20px',
                background: 'rgba(239, 68, 68, 0.12)',
                borderTop: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#fca5a5',
                fontSize: '0.74rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ShieldAlert size={14} color="#f87171" />
                <span>WhatsApp desconectado. As mensagens manuais serão apenas salvas no painel e não serão entregues no WhatsApp enquanto o status não estiver conectado.</span>
              </div>
            )}

            {/* Input Bar */}
            <form onSubmit={handleSend} style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border-subtle)',
              background: 'rgba(11, 17, 32, 0.5)',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-end'
            }}>
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                placeholder="Digite sua resposta manual... (Enter para enviar, Shift+Enter para quebra de linha)"
                className="input-field"
                rows={Math.min(5, Math.max(1, (inputMessage.match(/\n/g) || []).length + 1))}
                style={{
                  flex: 1,
                  padding: '11px 14px',
                  resize: 'none',
                  minHeight: '44px',
                  maxHeight: '120px',
                  fontFamily: 'inherit',
                  fontSize: '0.88rem',
                  lineHeight: '1.4'
                }}
                disabled={isSending}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isSending}
                className="btn-primary"
                style={{
                  padding: '11px 20px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap'
                }}
              >
                {isSending ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Enviar</span>
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#64748b' }}>
            <p>Selecione uma conversa à esquerda para visualizar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
