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
  FileCheck
} from 'lucide-react';

export default function DeliverablesManager({ deliverables, onUpload, onDelete }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
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

    try {
      await onUpload(formData);
      setFile(null);
      setName('');
      setTag('');
      setDescription('');
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
              Suba arquivos de prova social, ebooks e materiais para a IA disparar automaticamente no WhatsApp.
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
              placeholder="Ex: Guia Rápido dos Primeiros R$ 10k"
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
              placeholder="Ex: GUIA_AMOSTRA ou PROVA_SOCIAL"
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
              className="input-field"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Descrição / Legenda
            </label>
            <input
              type="text"
              placeholder="Ex: Print comprovando alunos faturando"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
            />
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
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '16px' }}>
          Arquivos Cadastrados ({deliverables.length})
        </h3>

        {deliverables.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '30px' }}>
            Nenhum entregável cadastrado. Suba um PDF ou imagem acima.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {deliverables.map((item) => {
              const isPdf = item.type === 'pdf';
              const triggerTag = isPdf ? `[ENVIAR_ARQUIVO: ${item.tag}]` : `[ENVIAR_IMAGEM: ${item.tag}]`;

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
                    gap: '12px'
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
                        <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f8fafc' }}>
                          {item.name}
                        </h4>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {item.type.toUpperCase()} • {item.size ? `${Math.round(item.size / 1024)} KB` : 'Anexo'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onDelete(item.id)}
                      className="btn-outline-danger"
                      title="Excluir entregável"
                    >
                      <Trash2 size={14} />
                    </button>
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
