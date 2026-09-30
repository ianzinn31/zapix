import React, { useState } from 'react';
import { 
  Package, 
  DollarSign, 
  Link as LinkIcon, 
  Shield, 
  HelpCircle, 
  Plus, 
  Trash2, 
  Save, 
  Mic,
  CheckCircle2
} from 'lucide-react';

export default function ProductSettings({ product, onSave }) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    niche: product?.niche || '',
    targetAudience: product?.targetAudience || '',
    price: product?.price ?? '',
    currency: product?.currency || 'BRL',
    checkoutUrl: product?.checkoutUrl || '',
    guaranteeDays: product?.guaranteeDays || 7,
    mainPainPoints: product?.mainPainPoints || [],
    mainBenefits: product?.mainBenefits || [],
    objections: product?.objections || [],
    defaultAudioPitchText: product?.defaultAudioPitchText || ''
  });

  const [newPainPoint, setNewPainPoint] = useState('');
  const [newBenefit, setNewBenefit] = useState('');
  const [newObjectionTrigger, setNewObjectionTrigger] = useState('');
  const [newObjectionResponse, setNewObjectionResponse] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddPainPoint = () => {
    if (!newPainPoint.trim()) return;
    setFormData((prev) => ({
      ...prev,
      mainPainPoints: [...prev.mainPainPoints, newPainPoint.trim()]
    }));
    setNewPainPoint('');
  };

  const handleRemovePainPoint = (index) => {
    setFormData((prev) => ({
      ...prev,
      mainPainPoints: prev.mainPainPoints.filter((_, i) => i !== index)
    }));
  };

  const handleAddBenefit = () => {
    if (!newBenefit.trim()) return;
    setFormData((prev) => ({
      ...prev,
      mainBenefits: [...prev.mainBenefits, newBenefit.trim()]
    }));
    setNewBenefit('');
  };

  const handleRemoveBenefit = (index) => {
    setFormData((prev) => ({
      ...prev,
      mainBenefits: prev.mainBenefits.filter((_, i) => i !== index)
    }));
  };

  const handleAddObjection = () => {
    if (!newObjectionTrigger.trim() || !newObjectionResponse.trim()) return;
    setFormData((prev) => ({
      ...prev,
      objections: [
        ...prev.objections,
        { trigger: newObjectionTrigger.trim(), response: newObjectionResponse.trim() }
      ]
    }));
    setNewObjectionTrigger('');
    setNewObjectionResponse('');
  };

  const handleRemoveObjection = (index) => {
    setFormData((prev) => ({
      ...prev,
      objections: prev.objections.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ product: formData });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div className="flex items-center gap-3">
            <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '10px', color: '#10b981' }}>
              <Package size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                Oferta & Infoproduto Ativo
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                A IA usará esses dados para apresentar o produto, convencer o lead e enviar o checkout.
              </p>
            </div>
          </div>

          <button type="submit" className="btn-primary">
            {savedSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
            <span>{savedSuccess ? 'Salvo com Sucesso!' : 'Salvar Alterações'}</span>
          </button>
        </div>

        {/* Basic Info Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Nome do Infoproduto / Treinamento
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="input-field"
              placeholder="Ex: Método Renda Automática com IA"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Nicho de Mercado
            </label>
            <input
              type="text"
              value={formData.niche}
              onChange={(e) => handleChange('niche', e.target.value)}
              className="input-field"
              placeholder="Ex: Marketing Digital, Finanças, Emagrecimento"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Preço da Oferta (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => handleChange('price', parseFloat(e.target.value))}
              className="input-field"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Link de Checkout (Kiwify, Hotmart, PerfectPay, Cakto)
            </label>
            <input
              type="url"
              value={formData.checkoutUrl}
              onChange={(e) => handleChange('checkoutUrl', e.target.value)}
              className="input-field"
              placeholder="https://pay.kiwify.com.br/..."
              required
            />
          </div>
        </div>

        {/* Target Audience & Guarantee */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Público-Alvo e Perfil do Lead
            </label>
            <textarea
              value={formData.targetAudience}
              onChange={(e) => handleChange('targetAudience', e.target.value)}
              className="input-field"
              rows={2}
              placeholder="Descreva quem é a pessoa que compra..."
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Garantia Incondicional (Dias)
            </label>
            <input
              type="number"
              value={formData.guaranteeDays}
              onChange={(e) => handleChange('guaranteeDays', parseInt(e.target.value))}
              className="input-field"
            />
          </div>
        </div>

        {/* Script de Áudio de Pitch Fish Audio */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: '#22d3ee', marginBottom: '6px' }}>
            <Mic size={15} />
            <span>Roteiro do Áudio de Pitch (Gerado com voz humana via Fish Audio)</span>
          </label>
          <textarea
            value={formData.defaultAudioPitchText}
            onChange={(e) => handleChange('defaultAudioPitchText', e.target.value)}
            className="input-field"
            rows={3}
            placeholder="Texto exato que a IA falará com a voz do Fish Audio para fechar o lead..."
          />
          <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
            Dica: Use tom natural, coloquial e empático, como se estivesse mandando um áudio rápido no WhatsApp para um amigo.
          </p>
        </div>

        {/* Dores & Benefícios */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          {/* Dores do Lead */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fb7185', marginBottom: '10px' }}>
              Dores Principais do Lead
            </h4>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                value={newPainPoint}
                onChange={(e) => setNewPainPoint(e.target.value)}
                placeholder="Ex: Falta de tempo livre..."
                className="input-field"
                style={{ fontSize: '0.82rem' }}
              />
              <button type="button" onClick={handleAddPainPoint} className="btn-secondary" style={{ padding: '0 12px' }}>
                <Plus size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {formData.mainPainPoints.map((pain, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', fontSize: '0.8rem' }}>
                  <span>• {pain}</span>
                  <button type="button" onClick={() => handleRemovePainPoint(idx)} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Benefícios */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#34d399', marginBottom: '10px' }}>
              Benefícios & Soluções do Método
            </h4>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                value={newBenefit}
                onChange={(e) => setNewBenefit(e.target.value)}
                placeholder="Ex: Modelos prontos para copiar e colar..."
                className="input-field"
                style={{ fontSize: '0.82rem' }}
              />
              <button type="button" onClick={handleAddBenefit} className="btn-secondary" style={{ padding: '0 12px' }}>
                <Plus size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {formData.mainBenefits.map((benefit, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', fontSize: '0.8rem' }}>
                  <span>✓ {benefit}</span>
                  <button type="button" onClick={() => handleRemoveBenefit(idx)} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tratamento de Objeções */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginBottom: '12px' }}>
            Respostas para Objeções Comuns (Preço, Tempo, Desconfiança)
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '10px', marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="Palavra-chave (ex: dinheiro)"
              value={newObjectionTrigger}
              onChange={(e) => setNewObjectionTrigger(e.target.value)}
              className="input-field"
              style={{ fontSize: '0.82rem' }}
            />
            <input
              type="text"
              placeholder="Resposta persuasiva da IA..."
              value={newObjectionResponse}
              onChange={(e) => setNewObjectionResponse(e.target.value)}
              className="input-field"
              style={{ fontSize: '0.82rem' }}
            />
            <button type="button" onClick={handleAddObjection} className="btn-secondary" style={{ padding: '0 16px' }}>
              <Plus size={16} />
              <span>Adicionar</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {formData.objections.map((obj, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase' }}>
                    Gatilho: "{obj.trigger}"
                  </span>
                  <p style={{ fontSize: '0.84rem', color: '#cbd5e1', marginTop: '3px' }}>
                    {obj.response}
                  </p>
                </div>
                <button type="button" onClick={() => handleRemoveObjection(idx)} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', marginLeft: '12px', marginTop: '2px' }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </form>
  );
}
