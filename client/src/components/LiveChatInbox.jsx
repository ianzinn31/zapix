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
  ShieldAlert
} from 'lucide-react';

export default function LiveChatInbox({ 
  leads, 
  selectedLeadPhone, 
  onSelectLead, 
  messages, 
  onSendMessage, 
  onToggleAi, 
  onChangeLeadStage,
  product,
  deliverables
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const audioRefs = useRef({});
  const messagesEndRef = useRef(null);

  // Filter leads by search term
  const filteredLeads = leads.filter((lead) => {
    const term = searchTerm.toLowerCase();
    const phone = (lead.phone || '').toLowerCase();
    const name = (lead.name || '').toLowerCase();
    return phone.includes(term) || name.includes(term);
  });

  const activeLead = leads.find((l) => l.phone === selectedLeadPhone) || filteredLeads[0];

  // Auto scroll to bottom of chat when new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedLeadPhone]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeLead) return;
    onSendMessage(activeLead.phone, inputMessage.trim(), 'text');
    setInputMessage('');
  };

  const handleSendQuickAudioPitch = () => {
    if (!activeLead) return;
    const text = product?.defaultAudioPitchText || 'Olá! Gravei esse áudio para te explicar como funciona o nosso método de vendas com IA.';
    onSendMessage(activeLead.phone, `[AUDIO: ${text}]`, 'text');
  };

  const handleSendCheckoutLink = () => {
    if (!activeLead || !product?.checkoutUrl) return;
    const text = `Aqui está o link oficial com a condição especial que te falei:\n👉 ${product.checkoutUrl}\n\nAssim que você concluir a inscrição, me avisa aqui que libero seus bônus imediatos!`;
    onSendMessage(activeLead.phone, text, 'text');
  };

  const handleSendDeliverable = (tag) => {
    if (!activeLead) return;
    onSendMessage(activeLead.phone, `[ENVIAR_ARQUIVO: ${tag}]`, 'text');
  };

  const togglePlayAudio = (msgId, audioUrl) => {
    if (playingAudioId === msgId) {
      audioRefs.current[msgId]?.pause();
      setPlayingAudioId(null);
    } else {
      if (playingAudioId && audioRefs.current[playingAudioId]) {
        audioRefs.current[playingAudioId].pause();
      }
      if (!audioRefs.current[msgId]) {
        audioRefs.current[msgId] = new Audio(audioUrl);
        audioRefs.current[msgId].onended = () => setPlayingAudioId(null);
      }
      audioRefs.current[msgId].play();
      setPlayingAudioId(msgId);
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '320px 1fr',
      height: 'calc(100vh - 180px)',
      minHeight: '600px',
      gap: '16px'
    }}>
      {/* Sidebar: Leads List */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Search header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              Conversas ({leads.length})
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
              Live Sync
            </span>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '11px' }} />
            <input
              type="text"
              placeholder="Buscar por telefone ou nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '36px', fontSize: '0.82rem' }}
            />
          </div>
        </div>

        {/* Contact items list */}
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
                    padding: '14px 16px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #10b981' : '3px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                          {lead.name || lead.phone}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          +{lead.phone}
                        </div>
                      </div>
                    </div>

                    <span className={`badge badge-${(lead.stage || 'novo').toLowerCase()}`} style={{ fontSize: '0.65rem' }}>
                      {lead.stage || 'NOVO'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <span style={{
                      fontSize: '0.78rem',
                      color: isSelected ? '#cbd5e1' : '#94a3b8',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '190px'
                    }}>
                      {lead.lastMessage || 'Conversa iniciada'}
                    </span>

                    <span style={{
                      fontSize: '0.65rem',
                      padding: '2px 5px',
                      borderRadius: '4px',
                      background: lead.aiActive !== false ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                      color: lead.aiActive !== false ? '#34d399' : '#fb7185',
                      fontWeight: 600
                    }}>
                      {lead.aiActive !== false ? 'IA ON' : 'IA OFF'}
                    </span>
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
              padding: '14px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(11, 17, 32, 0.4)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#f8fafc' }}>
                      {activeLead.name || activeLead.phone}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      ({activeLead.phone})
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

              {/* Right Controls: AI Switch & Quick Action */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: activeLead.aiActive !== false ? '#34d399' : '#94a3b8', fontWeight: 600 }}>
                    {activeLead.aiActive !== false ? 'IA Automática Ativa' : 'Pausado p/ Atendimento Humano'}
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
              </div>
            </div>

            {/* Quick Action Bar */}
            <div style={{
              padding: '8px 20px',
              background: 'rgba(15, 23, 42, 0.4)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto'
            }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Gatilhos Rápidos:
              </span>

              <button
                onClick={handleSendQuickAudioPitch}
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', color: '#22d3ee' }}
              >
                <Mic size={13} />
                <span>Enviar Áudio de Pitch</span>
              </button>

              <button
                onClick={handleSendCheckoutLink}
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', color: '#f472b6' }}
              >
                <DollarSign size={13} />
                <span>Enviar Checkout {product?.price ? `(R$ ${Number(product.price).toFixed(2)})` : ''}</span>
              </button>

              {deliverables && deliverables.map((deliv) => (
                <button
                  key={deliv.id}
                  onClick={() => handleSendDeliverable(deliv.tag)}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px' }}
                  title={`Disparar entregável ${deliv.name}`}
                >
                  {deliv.type === 'pdf' ? <FileText size={13} color="#60a5fa" /> : <ImageIcon size={13} color="#fbbf24" />}
                  <span>Enviar {deliv.name}</span>
                </button>
              ))}
            </div>

            {/* Message Stream */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {messages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: '#64748b' }}>
                  <Bot size={36} color="#334155" style={{ margin: '0 auto 10px' }} />
                  <p style={{ fontSize: '0.9rem' }}>Nenhuma mensagem nesta conversa ainda.</p>
                  <p style={{ fontSize: '0.75rem' }}>Envie uma mensagem abaixo para iniciar o atendimento ou aguarde mensagens no WhatsApp.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.fromMe;
                  const isAudio = msg.type === 'audio' || (msg.text && msg.text.startsWith('🎵 [Áudio]'));
                  const isDeliverable = msg.type === 'pdf' || msg.type === 'image' || msg.type === 'document';

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        justifyContent: isMe ? 'flex-end' : 'flex-start',
                        gap: '8px'
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '75%',
                          padding: isAudio ? '12px 16px' : '10px 14px',
                          borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                          background: isMe
                            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(6, 182, 212, 0.2) 100%)'
                            : 'rgba(30, 41, 59, 0.8)',
                          border: isMe
                            ? '1px solid rgba(16, 185, 129, 0.3)'
                            : '1px solid rgba(255, 255, 255, 0.08)',
                          color: '#f8fafc',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                        }}
                      >
                        {/* Header badge inside bubble */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: isMe ? '#34d399' : '#94a3b8' }}>
                            {isMe ? '🤖 IA Zapix / Você' : activeLead.name || 'Lead WhatsApp'}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                            {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Audio Message Player (Fish Audio PTT) */}
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
                            <div style={{
                              padding: '10px',
                              background: 'rgba(255, 255, 255, 0.08)',
                              borderRadius: '8px',
                              color: msg.type === 'pdf' ? '#f43f5e' : '#fbbf24'
                            }}>
                              {msg.type === 'pdf' ? <FileText size={24} /> : <ImageIcon size={24} />}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                {msg.text}
                              </div>
                              {msg.mediaUrl && (
                                <a
                                  href={msg.mediaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize: '0.75rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}
                                >
                                  <span>Visualizar Entregável</span>
                                  <ExternalLink size={12} />
                                </a>
                              )}
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

            {/* Input Bar */}
            <form onSubmit={handleSend} style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border-subtle)',
              background: 'rgba(11, 17, 32, 0.5)',
              display: 'flex',
              gap: '10px',
              alignItems: 'center'
            }}>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Digite uma mensagem para responder pelo sistema (sem abrir o WhatsApp)..."
                className="input-field"
                style={{ flex: 1, padding: '12px 16px' }}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim()}
                className="btn-primary"
                style={{ padding: '12px 20px' }}
              >
                <Send size={16} />
                <span>Enviar</span>
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
