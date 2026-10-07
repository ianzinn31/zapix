import React, { useState } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Upload, 
  Trash2, 
  Copy, 
  Check, 
  ExternalLink, 
  Plus,
  FileCheck,
  ShieldCheck,
  Gift,
  Layers,
  ArrowRightLeft,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

export default function DeliverablesManager({ 
  deliverables = [], 
  deliveryStrategy = 'require_payment', 
  orderMode = 'top_down',
  onUpdateOrderMode,
  onReorder,
  onUpload, 
  onUpdate, 
  onDelete 
}) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [requirePayment, setRequirePayment] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedTag, setCopiedTag] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!name) {
        setName(selected.name.replace(/\.[^/.]+$/, ''));
      }
      if (!tag) {
        setTag(selected.name.replace(/\.[^/.]+$/, '').toUpperCase().replace(/[^A-Z0-9_]/g, '_'));
      }
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    formData.append('tag', tag);
    formData.append('description', description);
    formData.append('requirePayment', requirePayment);

    try {
      await onUpload(formData);
      setFile(null);
      setName('');
      setTag('');
      setDescription('');
      setRequirePayment(true);
    } catch (err) {
      alert(`Erro no upload: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedTag(id);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  const handleMoveUp = (index) => {
    if (index <= 0) return;
    const newItems = [...deliverables];
    const temp = newItems[index - 1];
    newItems[index - 1] = newItems[index];
    newItems[index] = temp;
    if (onReorder) onReorder(newItems);
  };

  const handleMoveDown = (index) => {
    if (index >= deliverables.length - 1) return;
    const newItems = [...deliverables];
    const temp = newItems[index + 1];
    newItems[index + 1] = newItems[index];
    newItems[index] = temp;
    if (onReorder) onReorder(newItems);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Global Strategy Notice */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        background: deliveryStrategy === 'deliver_first' 
          ? 'rgba(245, 158, 11, 0.12)' 
          : deliveryStrategy === 'per_deliverable' 
          ? 'rgba(99, 102, 241, 0.12)' 
          : 'rgba(16, 185, 129, 0.12)',
        border: `1px solid ${
          deliveryStrategy === 'deliver_first' ? '#f59e0b' : deliveryStrategy === 'per_deliverable' ? '#6366f1' : '#10b981'
        }`,
        borderRadius: '12px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {deliveryStrategy === 'deliver_first' ? (
            <Gift size={24} color="#fbbf24" />
          ) : deliveryStrategy === 'per_deliverable' ? (
            <Layers size={24} color="#818cf8" />
          ) : (
            <ShieldCheck size={24} color="#34d399" />
          )}
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc' }}>
              Modo da Operação:{' '}
              {deliveryStrategy === 'deliver_first'
                ? '🎁 Entregar Antes e Cobrar Depois (Isca de Valor)'
                : deliveryStrategy === 'per_deliverable'
                ? '⚙️ Personalizado por Entregável (Híbrido)'
                : '🔒 Cobrar Primeiro, Entregar Depois (Padrão Antifraude)'}
            </div>
            <p style={{ fontSize: '0.76rem', color: '#cbd5e1', margin: 0, marginTop: '2px' }}>
              {deliveryStrategy === 'deliver_first'
                ? 'A IA tem autorização para enviar os materiais antes da cobrança para encantar o lead, cobrando a oferta em seguida.'
                : deliveryStrategy === 'per_deliverable'
                ? 'Arquivos configurados como Amostra/Isca podem ser enviados antes; os marcados como Pagos exigem PIX aprovado.'
                : 'A IA só libera materiais após o PIX imediato ser validado e aprovado pelo perito antifraude.'}
            </p>
          </div>
        </div>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
          (Altere na aba Produto)
        </span>
      </div>

      {/* Upload Form Card */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.15)', borderRadius: '10px', color: '#60a5fa' }}>
            <Upload size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
              Upload de Entregáveis (PDF & Imagens)
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Suba arquivos de amostra grátis, ebooks completos ou provas sociais para a IA disparar no WhatsApp.
            </p>
          </div>
        </div>

        <form onSubmit={handleUploadSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Selecionar Arquivo (PDF, PNG, JPG)
            </label>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileChange}
              className="input-field"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Nome de Exibição
            </label>
            <input
              type="text"
              placeholder="Ex: Amostra 10 Receitas Rápidas"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Tag de Disparo da IA (Sem espaços)
            </label>
            <input
              type="text"
              placeholder="Ex: AMOSTRA ou EBOOK_COMPLETO"
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
              className="input-field"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Descrição / Legenda para a IA
            </label>
            <input
              type="text"
              placeholder="Ex: Degustação gratuita de 3 páginas para encantar o lead"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
            />
          </div>

          {/* Regra de Liberação do Entregável */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Regra de Liberação deste Arquivo
            </label>
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: requirePayment ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                border: requirePayment ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              onClick={() => setRequirePayment(!requirePayment)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {requirePayment ? <ShieldCheck size={20} color="#34d399" /> : <Gift size={20} color="#fbbf24" />}
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: requirePayment ? '#34d399' : '#fbbf24' }}>
                    {requirePayment ? '🔒 Exigir Pagamento Aprovado (Produto Pago)' : '🎁 Liberar Antes de Pagar (Amostra Grátis / Isca)'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    {requirePayment 
                      ? 'A IA só envia este arquivo após o PIX imediato ser validado e aprovado.' 
                      : 'A IA tem autorização para enviar este material antes do lead pagar para gerar encantamento.'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  border: 'none',
                  background: requirePayment ? '#10b981' : '#f59e0b',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                {requirePayment ? 'Exige PIX' : 'Liberado Antes'}
              </button>
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              type="submit"
              disabled={isUploading || !file}
              className="btn-primary"
            >
              <Plus size={16} />
              <span>{isUploading ? 'Enviando...' : 'Adicionar Entregável'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Deliverables List Card */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Arquivos Cadastrados ({deliverables.length})
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0, marginTop: '2px' }}>
              Use as setas para definir qual arquivo é enviado primeiro para o WhatsApp.
            </p>
          </div>

          {/* WhatsApp View / Dispatch Sequence Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', paddingLeft: '8px', fontWeight: 600 }}>
              Sequência no WhatsApp:
            </span>
            <button
              type="button"
              onClick={() => onUpdateOrderMode && onUpdateOrderMode('top_down')}
              style={{
                padding: '6px 10px',
                borderRadius: '7px',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: orderMode === 'top_down' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                border: orderMode === 'top_down' ? '1px solid #3b82f6' : 'none',
                color: orderMode === 'top_down' ? '#60a5fa' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="O 1º arquivo é disparado primeiro e fica no topo da conversa do cliente"
            >
              <span>⬆️ Top-Down (1º no topo)</span>
            </button>
            <button
              type="button"
              onClick={() => onUpdateOrderMode && onUpdateOrderMode('bottom_up')}
              style={{
                padding: '6px 10px',
                borderRadius: '7px',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: orderMode === 'bottom_up' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                border: orderMode === 'bottom_up' ? '1px solid #f59e0b' : 'none',
                color: orderMode === 'bottom_up' ? '#fbbf24' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="O 1º arquivo é disparado por último e fica colado logo acima do texto final de fechamento"
            >
              <span>⬇️ Bottom-Up (1º no fechamento)</span>
            </button>
          </div>
        </div>

        {deliverables.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '30px' }}>
            Nenhum entregável cadastrado. Suba um PDF ou imagem acima.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {deliverables.map((item, index) => {
              const isPdf = item.type === 'pdf';
              const triggerTag = isPdf ? `[ENVIAR_ARQUIVO: ${item.tag}]` : `[ENVIAR_IMAGEM: ${item.tag}]`;
              const isPaid = item.requirePayment !== false;

              return (
                <div
                  key={item.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        padding: '10px',
                        background: isPdf ? 'rgba(244, 63, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                        borderRadius: '8px',
                        color: isPdf ? '#fb7185' : '#fbbf24'
                      }}>
                        {isPdf ? <FileText size={22} /> : <ImageIcon size={22} />}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(59, 130, 246, 0.2)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59, 130, 246, 0.4)'
                          }}>
                            #{index + 1}
                          </span>
                          <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                            {item.name}
                          </h4>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {item.type.toUpperCase()} • {item.size ? `${Math.round(item.size / 1024)} KB` : 'Anexo'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {/* Move Up / Down Buttons */}
                      <button
                        type="button"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          color: index === 0 ? '#475569' : '#cbd5e1',
                          padding: '4px 6px',
                          cursor: index === 0 ? 'not-allowed' : 'pointer'
                        }}
                        title="Subir prioridade (enviar antes)"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === deliverables.length - 1}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          color: index === deliverables.length - 1 ? '#475569' : '#cbd5e1',
                          padding: '4px 6px',
                          cursor: index === deliverables.length - 1 ? 'not-allowed' : 'pointer'
                        }}
                        title="Descer prioridade (enviar depois)"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        className="btn-outline-danger"
                        title="Excluir entregável"
                        style={{ padding: '5px 7px' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {item.description && (
                    <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      {item.description}
                    </p>
                  )}

                  {/* Tag copy box */}
                  <div style={{
                    background: '#090d16',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}>
                    <code style={{ fontSize: '0.75rem', color: '#38bdf8' }}>
                      {triggerTag}
                    </code>
                    <button
                      onClick={() => copyToClipboard(triggerTag, item.id)}
                      style={{ background: 'none', border: 'none', color: copiedTag === item.id ? '#10b981' : '#94a3b8', cursor: 'pointer' }}
                      title="Copiar tag para usar no prompt ou chat"
                    >
                      {copiedTag === item.id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>

                  {/* Payment Requirement Badge & Toggle Button */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    paddingTop: '10px'
                  }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '5px',
                      background: isPaid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: isPaid ? '#34d399' : '#fbbf24',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {isPaid ? <ShieldCheck size={13} /> : <Gift size={13} />}
                      {isPaid ? 'Exige Pagamento' : 'Libera Antes (Isca)'}
                    </span>

                    {onUpdate && (
                      <button
                        type="button"
                        onClick={() => onUpdate(item.id, { requirePayment: !isPaid })}
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px',
                          color: '#cbd5e1',
                          fontSize: '0.72rem',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Alternar entre exigir pagamento ou liberar antes"
                      >
                        <ArrowRightLeft size={12} />
                        <span>Mudar para {isPaid ? 'Liberar Antes' : 'Exigir PIX'}</span>
                      </button>
                    )}
                  </div>

                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '0.75rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span>Visualizar arquivo original</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
