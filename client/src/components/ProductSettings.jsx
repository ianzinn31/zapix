import React, { useState, useEffect } from 'react';
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
  CheckCircle2,
  QrCode,
  CreditCard,
  Zap,
  Key,
  Copy,
  Check,
  Gift,
  Layers
} from 'lucide-react';

export default function ProductSettings({ product, onSave }) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    niche: product?.niche || '',
    targetAudience: product?.targetAudience || '',
    price: product?.price ?? '',
    currency: product?.currency || 'BRL',
    paymentMethod: product?.paymentMethod || 'both', // 'pix' | 'both' | 'checkout'
    deliveryStrategy: product?.deliveryStrategy || 'require_payment', // 'require_payment' | 'deliver_first' | 'per_deliverable'
    checkoutUrl: product?.checkoutUrl || '',
    pixKey: product?.pixKey || '',
    pixKeyType: product?.pixKeyType || 'aleatoria', // 'aleatoria' | 'cpf' | 'cnpj' | 'email' | 'telefone'
    pixBeneficiary: product?.pixBeneficiary || '',
    pixInstructions: product?.pixInstructions || 'Enviar o comprovante aqui no WhatsApp para liberação imediata do acesso.',
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
  const [copiedPix, setCopiedPix] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        niche: product.niche || '',
        targetAudience: product.targetAudience || '',
        price: product.price ?? '',
        currency: product.currency || 'BRL',
        paymentMethod: product.paymentMethod || (product.pixKey ? 'both' : 'checkout'),
        deliveryStrategy: product.deliveryStrategy || 'require_payment',
        checkoutUrl: product.checkoutUrl || '',
        pixKey: product.pixKey || '',
        pixKeyType: product.pixKeyType || 'aleatoria',
        pixBeneficiary: product.pixBeneficiary || '',
        pixInstructions: product.pixInstructions || 'Enviar o comprovante aqui no WhatsApp para liberação imediata do acesso.',
        guaranteeDays: product.guaranteeDays || 7,
        mainPainPoints: product.mainPainPoints || [],
        mainBenefits: product.mainBenefits || [],
        objections: product.objections || [],
        defaultAudioPitchText: product.defaultAudioPitchText || ''
      });
    }
  }, [product]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCopyPix = () => {
    if (!formData.pixKey) return;
    navigator.clipboard.writeText(formData.pixKey);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
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
                A IA usará esses dados para apresentar o produto, convencer o lead e enviar o pagamento (PIX ou Checkout).
              </p>
            </div>
          </div>

          <button type="submit" className="btn-primary">
            {savedSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
            <span>{savedSuccess ? 'Salvo com Sucesso!' : 'Salvar Alterações'}</span>
          </button>
        </div>

        {/* Basic Info Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
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
              placeholder="Ex: Marketing Digital, Finanças, Culinária"
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
              onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
              className="input-field"
              placeholder="Ex: 37.90"
              required
            />
          </div>
        </div>

        {/* PAYMENT METHOD / PIX OR CHECKOUT CONFIGURATION */}
        <div style={{
          background: 'rgba(6, 182, 212, 0.03)',
          border: '1px solid rgba(6, 182, 212, 0.2)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <QrCode size={20} color="#22d3ee" />
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                Forma de Cobrança & Fechamento da Venda
              </h4>
            </div>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              A IA adapta a abordagem conforme o formato configurado
            </span>
          </div>

          {/* Mode Selector Radio Pills */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            <div
              onClick={() => handleChange('paymentMethod', 'pix')}
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: formData.paymentMethod === 'pix' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                border: formData.paymentMethod === 'pix' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Key size={16} color={formData.paymentMethod === 'pix' ? '#34d399' : '#94a3b8'} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: formData.paymentMethod === 'pix' ? '#34d399' : '#f8fafc' }}>
                  Apenas PIX Direto
                </span>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                A IA envia a chave PIX no chat e pede o comprovante para liberação.
              </p>
            </div>

            <div
              onClick={() => handleChange('paymentMethod', 'both')}
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: formData.paymentMethod === 'both' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                border: formData.paymentMethod === 'both' ? '1px solid #06b6d4' : '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Zap size={16} color={formData.paymentMethod === 'both' ? '#22d3ee' : '#94a3b8'} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: formData.paymentMethod === 'both' ? '#22d3ee' : '#f8fafc' }}>
                  PIX Direto + Link de Checkout
                </span>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Recomendado: PIX à vista ou Cartão/Parcelado no link conforme o lead preferir.
              </p>
            </div>

            <div
              onClick={() => handleChange('paymentMethod', 'checkout')}
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: formData.paymentMethod === 'checkout' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                border: formData.paymentMethod === 'checkout' ? '1px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <CreditCard size={16} color={formData.paymentMethod === 'checkout' ? '#c084fc' : '#94a3b8'} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: formData.paymentMethod === 'checkout' ? '#c084fc' : '#f8fafc' }}>
                  Apenas Link de Checkout
                </span>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                A IA conduz para a página externa (Kiwify, Hotmart, PerfectPay, Cakto).
              </p>
            </div>
          </div>

          {/* PIX Fields (Visible when 'pix' or 'both') */}
          {(formData.paymentMethod === 'pix' || formData.paymentMethod === 'both') && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.04)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: formData.paymentMethod === 'both' ? '16px' : '0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={15} />
                  Dados da Chave PIX
                </span>
                {formData.pixKey && (
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                  >
                    {copiedPix ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    <span>{copiedPix ? 'Copiada!' : 'Copiar Chave'}</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Chave PIX
                  </label>
                  <input
                    type="text"
                    value={formData.pixKey}
                    onChange={(e) => handleChange('pixKey', e.target.value)}
                    className="input-field"
                    placeholder="Cole sua chave (CPF, CNPJ, E-mail, Celular ou Aleatória)"
                    required={formData.paymentMethod === 'pix'}
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Tipo de Chave
                  </label>
                  <select
                    value={formData.pixKeyType}
                    onChange={(e) => handleChange('pixKeyType', e.target.value)}
                    className="input-field"
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="aleatoria">Chave Aleatória (EVP)</option>
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="email">E-mail</option>
                    <option value="telefone">Telefone / Celular</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Nome do Titular / Beneficiário da Conta
                  </label>
                  <input
                    type="text"
                    value={formData.pixBeneficiary}
                    onChange={(e) => handleChange('pixBeneficiary', e.target.value)}
                    className="input-field"
                    placeholder="Ex: João da Silva / Nome da Empresa"
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Instruções de Fechamento com PIX
                </label>
                <input
                  type="text"
                  value={formData.pixInstructions}
                  onChange={(e) => handleChange('pixInstructions', e.target.value)}
                  className="input-field"
                  placeholder="Ex: Enviar o comprovante aqui no WhatsApp para envio imediato do material."
                  style={{ fontSize: '0.85rem' }}
                />
              </div>
            </div>
          )}

          {/* Checkout URL Field (Visible when 'checkout' or 'both') */}
          {(formData.paymentMethod === 'checkout' || formData.paymentMethod === 'both') && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Link de Checkout (Kiwify, Hotmart, PerfectPay, Cakto)
              </label>
              <input
                type="url"
                value={formData.checkoutUrl}
                onChange={(e) => handleChange('checkoutUrl', e.target.value)}
                className="input-field"
                placeholder="https://pay.kiwify.com.br/... ou https://ggcheckout.app/..."
                required={formData.paymentMethod === 'checkout'}
              />
            </div>
          )}
        </div>

        {/* ESTRATÉGIA DE LIBERAÇÃO DE ENTREGÁVEIS (ARQUIVOS / PDF) */}
        <div style={{
          background: 'rgba(99, 102, 241, 0.03)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={20} color="#818cf8" />
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                Estratégia de Envio dos Entregáveis (PDF / Imagens)
              </h4>
            </div>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              Defina quando os materiais são enviados ao cliente
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            {/* Option 1: Cobrar Primeiro */}
            <div
              onClick={() => handleChange('deliveryStrategy', 'require_payment')}
              style={{
                padding: '14px',
                borderRadius: '10px',
                background: formData.deliveryStrategy === 'require_payment' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                border: formData.deliveryStrategy === 'require_payment' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Shield size={18} color={formData.deliveryStrategy === 'require_payment' ? '#34d399' : '#94a3b8'} />
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: formData.deliveryStrategy === 'require_payment' ? '#34d399' : '#f8fafc' }}>
                  Cobrar Primeiro (Antifraude)
                </span>
              </div>
              <p style={{ fontSize: '0.74rem', color: '#94a3b8', lineHeight: '1.4' }}>
                A IA só envia os arquivos após o PIX ser validado e aprovado. Agendamentos e comprovantes falsos são barrados automaticamente.
              </p>
            </div>

            {/* Option 2: Entregar Antes, Cobrar Depois */}
            <div
              onClick={() => handleChange('deliveryStrategy', 'deliver_first')}
              style={{
                padding: '14px',
                borderRadius: '10px',
                background: formData.deliveryStrategy === 'deliver_first' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                border: formData.deliveryStrategy === 'deliver_first' ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Gift size={18} color={formData.deliveryStrategy === 'deliver_first' ? '#fbbf24' : '#94a3b8'} />
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: formData.deliveryStrategy === 'deliver_first' ? '#fbbf24' : '#f8fafc' }}>
                  Entregar Antes, Cobrar Depois
                </span>
              </div>
              <p style={{ fontSize: '0.74rem', color: '#94a3b8', lineHeight: '1.4' }}>
                Ideal para operações com Isca/Amostra: a IA envia o material antes para encantar e gerar valor, conduzindo a cobrança e fechamento em seguida.
              </p>
            </div>

            {/* Option 3: Personalizado por Entregável */}
            <div
              onClick={() => handleChange('deliveryStrategy', 'per_deliverable')}
              style={{
                padding: '14px',
                borderRadius: '10px',
                background: formData.deliveryStrategy === 'per_deliverable' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                border: formData.deliveryStrategy === 'per_deliverable' ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Layers size={18} color={formData.deliveryStrategy === 'per_deliverable' ? '#818cf8' : '#94a3b8'} />
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: formData.deliveryStrategy === 'per_deliverable' ? '#818cf8' : '#f8fafc' }}>
                  Por Entregável (Híbrido)
                </span>
              </div>
              <p style={{ fontSize: '0.74rem', color: '#94a3b8', lineHeight: '1.4' }}>
                Você decide arquivo por arquivo na aba Entregáveis: alguns podem ser liberados antes como isca, e outros apenas após pagamento.
              </p>
            </div>
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
              onChange={(e) => handleChange('guaranteeDays', parseInt(e.target.value) || 7)}
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
            placeholder="Ex: Opa! Tudo bem? Vi que você tem interesse no método. Gravei esse áudio pra te explicar rapidinho como funciona..."
          />
        </div>

        {/* Dores Principais (Pain Points) */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginBottom: '12px' }}>
            Dores Principais do Lead (Para a IA explorar na conversa)
          </h4>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <input
              type="text"
              value={newPainPoint}
              onChange={(e) => setNewPainPoint(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPainPoint())}
              className="input-field"
              placeholder="Ex: Tenta vender na internet e não consegue retorno..."
            />
            <button
              type="button"
              onClick={handleAddPainPoint}
              className="btn-secondary"
            >
              <Plus size={16} />
              <span>Adicionar</span>
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {formData.mainPainPoints.map((pain, index) => (
              <span
                key={index}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '20px',
                  color: '#fca5a5',
                  fontSize: '0.8rem'
                }}
              >
                <span>{pain}</span>
                <Trash2
                  size={13}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleRemovePainPoint(index)}
                />
              </span>
            ))}
          </div>
        </div>

        {/* Benefícios Principais (Benefits) */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginBottom: '12px' }}>
            Principais Benefícios e Transformação do Infoproduto
          </h4>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <input
              type="text"
              value={newBenefit}
              onChange={(e) => setNewBenefit(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBenefit())}
              className="input-field"
              placeholder="Ex: Acesso vitalício com suporte individual..."
            />
            <button
              type="button"
              onClick={handleAddBenefit}
              className="btn-secondary"
            >
              <Plus size={16} />
              <span>Adicionar</span>
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {formData.mainBenefits.map((benefit, index) => (
              <span
                key={index}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '20px',
                  color: '#6ee7b7',
                  fontSize: '0.8rem'
                }}
              >
                <span>{benefit}</span>
                <Trash2
                  size={13}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleRemoveBenefit(index)}
                />
              </span>
            ))}
          </div>
        </div>

        {/* Quebra de Objeções (Objections) */}
        <div>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginBottom: '12px' }}>
            Quebra de Objeções (Scripts para a IA contornar dúvidas)
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '10px', marginBottom: '12px' }}>
            <input
              type="text"
              value={newObjectionTrigger}
              onChange={(e) => setNewObjectionTrigger(e.target.value)}
              className="input-field"
              placeholder="Gatilho (ex: Tá caro)"
            />
            <input
              type="text"
              value={newObjectionResponse}
              onChange={(e) => setNewObjectionResponse(e.target.value)}
              className="input-field"
              placeholder="Resposta / Argumento da IA..."
            />
            <button
              type="button"
              onClick={handleAddObjection}
              className="btn-secondary"
            >
              <Plus size={16} />
              <span>Adicionar</span>
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {formData.objections.map((obj, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px'
                }}
              >
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8' }}>
                    "{obj.trigger}":{' '}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                    {obj.response}
                  </span>
                </div>
                <Trash2
                  size={14}
                  style={{ cursor: 'pointer', color: '#ef4444' }}
                  onClick={() => handleRemoveObjection(index)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </form>
  );
}
