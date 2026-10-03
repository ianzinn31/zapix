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
  Layers,
  Globe,
  Coins
} from 'lucide-react';

export const COUNTRY_PRESETS = [
  {
    country: 'México',
    flag: '🇲🇽',
    currencyCode: 'MXN',
    currencySymbol: '$',
    paymentMethodType: 'XPag_AutoCode',
    paymentInstructions: 'Código de pago automático SPEI',
    voiceAccentId: 'es_MX_native_01',
    defaultTicketBasic: 150,
    defaultTicketComplete: 250,
    tag: 'XPag / SPEI (Auto)',
    description: 'Chave SPEI automática gerada via XPag. Aprovação em tempo real sem foto manual de comprovante.'
  },
  {
    country: 'Colômbia',
    flag: '🇨🇴',
    currencyCode: 'COP',
    currencySymbol: '$',
    paymentMethodType: 'Nequi_BreB',
    paymentInstructions: 'Transferencia bancaria local Nequi / Bre-B',
    voiceAccentId: 'es_CO_native_01',
    defaultTicketBasic: 45000,
    defaultTicketComplete: 75000,
    tag: 'Nequi / Bre-B',
    description: 'Transferência bancária via Nequi ou Bre-B com validação do comprovante.'
  },
  {
    country: 'Bolívia',
    flag: '🇧🇴',
    currencyCode: 'BOB',
    currencySymbol: 'Bs',
    paymentMethodType: 'QR_Bolivia',
    paymentInstructions: 'Pago mediante QR Simple o transferencia bancaria',
    voiceAccentId: 'es_BO_native_01',
    defaultTicketBasic: 70,
    defaultTicketComplete: 120,
    tag: 'QR Simple / Banco',
    description: 'Imagem do QR Code Simple ou transferência bancária local (BRA/BF).'
  },
  {
    country: 'Paraguai',
    flag: '🇵🇾',
    currencyCode: 'PYG',
    currencySymbol: 'Gs',
    paymentMethodType: 'Alias_Paraguay',
    paymentInstructions: 'Transferencia directa vía Alias bancario',
    voiceAccentId: 'es_PY_native_01',
    defaultTicketBasic: 120000,
    defaultTicketComplete: 200000,
    tag: 'Alias (ueno/Atlas)',
    description: 'Chave Alias direta nos bancos locais (ueno, Atlas, Itaú, Familiar).'
  },
  {
    country: 'Argentina',
    flag: '🇦🇷',
    currencyCode: 'ARS',
    currencySymbol: '$',
    paymentMethodType: 'Alias_Paraguay',
    paymentInstructions: 'Transferencia directa vía Alias / CBU',
    voiceAccentId: 'es_AR_native_01',
    defaultTicketBasic: 15000,
    defaultTicketComplete: 25000,
    tag: 'Alias / CBU',
    description: 'Transferência bancária via chave Alias ou CBU.'
  },
  {
    country: 'Brasil',
    flag: '🇧🇷',
    currencyCode: 'BRL',
    currencySymbol: 'R$',
    paymentMethodType: 'pix',
    paymentInstructions: 'Enviar o comprovante aqui no WhatsApp para liberação imediata do acesso.',
    voiceAccentId: 'pt_BR_native_01',
    defaultTicketBasic: 15,
    defaultTicketComplete: 37,
    tag: 'PIX Direto',
    description: 'Chave PIX direta na conversa com análise de comprovante por visão computacional.'
  }
];

export default function ProductSettings({ product, onSave }) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    niche: product?.niche || '',
    targetAudience: product?.targetAudience || '',
    price: product?.price ?? '',
    ticketBasic: product?.ticketBasic ?? product?.price ?? 15,
    ticketComplete: product?.ticketComplete ?? 37,
    targetCountry: product?.targetCountry || 'Brasil',
    currency: product?.currency || 'BRL',
    currencyCode: product?.currencyCode || 'BRL',
    currencySymbol: product?.currencySymbol || 'R$',
    paymentMethod: product?.paymentMethod || 'both', // 'pix' | 'both' | 'checkout'
    paymentMethodType: product?.paymentMethodType || 'pix', // 'XPag_AutoCode' | 'Nequi_BreB' | 'QR_Bolivia' | 'Alias_Paraguay' | 'pix'
    paymentInstructions: product?.paymentInstructions || '',
    voiceAccentId: product?.voiceAccentId || 'pt_BR_native_01',
    // Regional gateway credentials
    xpagApiKey: product?.xpagApiKey || '',
    xpagInstructions: product?.xpagInstructions || 'Código de pago automático SPEI',
    nequiNumber: product?.nequiNumber || '',
    nequiBeneficiary: product?.nequiBeneficiary || '',
    nequiInstructions: product?.nequiInstructions || 'Transferencia directa Nequi / Bre-B',
    boliviaQrUrl: product?.boliviaQrUrl || '',
    boliviaBankName: product?.boliviaBankName || '',
    boliviaAccountNumber: product?.boliviaAccountNumber || '',
    boliviaBeneficiary: product?.boliviaBeneficiary || '',
    boliviaInstructions: product?.boliviaInstructions || 'Pago mediante QR Simple o transferencia bancaria',
    aliasKey: product?.aliasKey || '',
    aliasBank: product?.aliasBank || '',
    aliasBeneficiary: product?.aliasBeneficiary || '',
    aliasInstructions: product?.aliasInstructions || 'Transferencia directa vía Alias',
    deliveryStrategy: product?.deliveryStrategy || 'require_payment', // 'require_payment' | 'deliver_first' | 'per_deliverable'
    checkoutUrl: product?.checkoutUrl || '',
    pixKey: product?.pixKey || '',
    pixKeyType: product?.pixKeyType || 'aleatoria', // 'aleatoria' | 'cpf' | 'cnpj' | 'email' | 'telefone'
    pixBeneficiary: product?.pixBeneficiary || '',
    pixInstructions: product?.pixInstructions || 'Enviar o comprovante aqui no WhatsApp para liberação imediata do acesso.',
    sendPixButton: product?.sendPixButton !== false,
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
        ticketBasic: product.ticketBasic ?? product.price ?? 15,
        ticketComplete: product.ticketComplete ?? 37,
        targetCountry: product.targetCountry || 'Brasil',
        currency: product.currency || 'BRL',
        currencyCode: product.currencyCode || 'BRL',
        currencySymbol: product.currencySymbol || 'R$',
        paymentMethod: product.paymentMethod || (product.pixKey ? 'both' : 'checkout'),
        paymentMethodType: product.paymentMethodType || 'pix',
        paymentInstructions: product.paymentInstructions || '',
        voiceAccentId: product.voiceAccentId || 'pt_BR_native_01',
        xpagApiKey: product.xpagApiKey || '',
        xpagInstructions: product.xpagInstructions || 'Código de pago automático SPEI',
        nequiNumber: product.nequiNumber || '',
        nequiBeneficiary: product.nequiBeneficiary || '',
        nequiInstructions: product.nequiInstructions || 'Transferencia directa Nequi / Bre-B',
        boliviaQrUrl: product.boliviaQrUrl || '',
        boliviaBankName: product.boliviaBankName || '',
        boliviaAccountNumber: product.boliviaAccountNumber || '',
        boliviaBeneficiary: product.boliviaBeneficiary || '',
        boliviaInstructions: product.boliviaInstructions || 'Pago mediante QR Simple o transferencia bancaria',
        aliasKey: product.aliasKey || '',
        aliasBank: product.aliasBank || '',
        aliasBeneficiary: product.aliasBeneficiary || '',
        aliasInstructions: product.aliasInstructions || 'Transferencia directa vía Alias',
        deliveryStrategy: product.deliveryStrategy || 'require_payment',
        checkoutUrl: product.checkoutUrl || '',
        pixKey: product.pixKey || '',
        pixKeyType: product.pixKeyType || 'aleatoria',
        pixBeneficiary: product.pixBeneficiary || '',
        pixInstructions: product.pixInstructions || 'Enviar o comprovante aqui no WhatsApp para liberação imediata do acesso.',
        sendPixButton: product.sendPixButton !== false,
        guaranteeDays: product.guaranteeDays || 7,
        mainPainPoints: product.mainPainPoints || [],
        mainBenefits: product.mainBenefits || [],
        objections: product.objections || [],
        defaultAudioPitchText: product.defaultAudioPitchText || ''
      });
    }
  }, [product]);

  const handleSelectCountry = (preset) => {
    setFormData((prev) => {
      const isDefaultPrice = !prev.ticketBasic || prev.ticketBasic === 15 || prev.ticketBasic === 0;
      const isDefaultComplete = !prev.ticketComplete || prev.ticketComplete === 37 || prev.ticketComplete === 0;
      return {
        ...prev,
        targetCountry: preset.country,
        currencyCode: preset.currencyCode,
        currencySymbol: preset.currencySymbol,
        currency: preset.currencyCode,
        paymentMethodType: preset.paymentMethodType,
        paymentInstructions: preset.paymentInstructions,
        voiceAccentId: preset.voiceAccentId,
        ticketBasic: isDefaultPrice ? preset.defaultTicketBasic : prev.ticketBasic,
        ticketComplete: isDefaultComplete ? preset.defaultTicketComplete : prev.ticketComplete,
        price: isDefaultPrice ? preset.defaultTicketBasic : prev.price
      };
    });
  };

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

        {/* REGIONAL / LATAM & BRAZIL SELECTOR */}
        <div style={{
          background: 'rgba(99, 102, 241, 0.05)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '12px',
          padding: '18px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={20} color="#818cf8" />
              <div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Mercado Alvo & Região Internacional (América Latina / Brasil)
                </h4>
                <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                  A IA chaveia automaticamente idioma nativo, gírias locais, moedas e meios de pagamento da região
                </p>
              </div>
            </div>
            <span style={{
              fontSize: '0.74rem',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: '20px',
              background: formData.targetCountry === 'Brasil' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.2)',
              color: formData.targetCountry === 'Brasil' ? '#34d399' : '#a5b4fc',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              {formData.targetCountry === 'Brasil' ? '🇧🇷 Português Brasileiro (PIX)' : `🌎 Espanhol Nativo (${formData.targetCountry} - ${formData.currencyCode})`}
            </span>
          </div>

          {/* 1-Click Country Presets */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
            {COUNTRY_PRESETS.map((preset) => {
              const isSelected = formData.targetCountry === preset.country;
              return (
                <div
                  key={preset.country}
                  onClick={() => handleSelectCountry(preset)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                    border: isSelected ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '1.2rem' }}>{preset.flag}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isSelected ? '#a5b4fc' : '#94a3b8' }}>
                      {preset.currencyCode}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isSelected ? '#ffffff' : '#e2e8f0' }}>
                    {preset.country}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', lineHeight: 1.2 }}>
                    {preset.tag}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '6px', fontSize: '0.75rem', color: '#cbd5e1' }}>
            {COUNTRY_PRESETS.find(p => p.country === formData.targetCountry)?.description}
          </div>
        </div>

        {/* Basic Info Fields & Dual Tickets */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px', marginBottom: '24px' }}>
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
              Ticket Básico ({formData.currencySymbol} {formData.currencyCode})
            </label>
            <input
              type="number"
              step="any"
              value={formData.ticketBasic}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                handleChange('ticketBasic', val);
                handleChange('price', val);
              }}
              className="input-field"
              placeholder="Ex: 150"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Ticket Completo / VIP ({formData.currencySymbol} {formData.currencyCode})
            </label>
            <input
              type="number"
              step="any"
              value={formData.ticketComplete}
              onChange={(e) => handleChange('ticketComplete', parseFloat(e.target.value) || 0)}
              className="input-field"
              placeholder="Ex: 250"
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

          {/* Regional Payment Fields (Visible when 'pix' or 'both') */}
          {(formData.paymentMethod === 'pix' || formData.paymentMethod === 'both') && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.04)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: formData.paymentMethod === 'both' ? '16px' : '0'
            }}>
              {/* MÉXICO - XPAG / SPEI */}
              {formData.targetCountry === 'México' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Zap size={16} />
                      🇲🇽 Configuração XPag / SPEI (México)
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                      Aprovação Automática
                    </span>
                  </div>

                  <div style={{ padding: '10px 12px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '14px', fontSize: '0.75rem', color: '#a7f3d0', lineHeight: 1.4 }}>
                    ⚡ <strong>Fluxo Nativo XPag / SPEI:</strong> O cliente recebe o código SPEI único na conversa. A confirmação de aprovação é recebida automaticamente via Webhook, liberando os materiais sem a necessidade de foto manual de comprovante.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Token / API Key da XPag
                      </label>
                      <input
                        type="text"
                        value={formData.xpagApiKey}
                        onChange={(e) => handleChange('xpagApiKey', e.target.value)}
                        className="input-field"
                        placeholder="Insira sua API Key ou Token da XPag"
                        style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Instruções de Pagamento SPEI (Exibido pela IA)
                      </label>
                      <input
                        type="text"
                        value={formData.xpagInstructions}
                        onChange={(e) => handleChange('xpagInstructions', e.target.value)}
                        className="input-field"
                        placeholder="Ex: Código de pago automático SPEI"
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* COLÔMBIA - NEQUI / BRE-B */}
              {formData.targetCountry === 'Colômbia' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Key size={16} />
                      🇨🇴 Dados de Pagamento Nequi / Bre-B (Colômbia)
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Número Nequi / Celular
                      </label>
                      <input
                        type="text"
                        value={formData.nequiNumber}
                        onChange={(e) => handleChange('nequiNumber', e.target.value)}
                        className="input-field"
                        placeholder="Ex: 300 123 4567"
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Titular / Beneficiário da Conta Nequi
                      </label>
                      <input
                        type="text"
                        value={formData.nequiBeneficiary}
                        onChange={(e) => handleChange('nequiBeneficiary', e.target.value)}
                        className="input-field"
                        placeholder="Nome do titular"
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Instruções Nequi
                      </label>
                      <input
                        type="text"
                        value={formData.nequiInstructions}
                        onChange={(e) => handleChange('nequiInstructions', e.target.value)}
                        className="input-field"
                        placeholder="Ex: Transferencia bancaria directa Nequi / Bre-B"
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* BOLÍVIA - QR SIMPLE / BANCO */}
              {formData.targetCountry === 'Bolívia' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <QrCode size={16} />
                      🇧🇴 QR Code Simple / Banco (Bolívia)
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        URL da Imagem do QR Code Simple
                      </label>
                      <input
                        type="url"
                        value={formData.boliviaQrUrl}
                        onChange={(e) => handleChange('boliviaQrUrl', e.target.value)}
                        className="input-field"
                        placeholder="https://...link-da-imagem-do-qr.png"
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Nome do Banco
                      </label>
                      <input
                        type="text"
                        value={formData.boliviaBankName}
                        onChange={(e) => handleChange('boliviaBankName', e.target.value)}
                        className="input-field"
                        placeholder="Ex: Banco Unión, Banco FIE, BCP"
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Número da Conta Bancária
                      </label>
                      <input
                        type="text"
                        value={formData.boliviaAccountNumber}
                        onChange={(e) => handleChange('boliviaAccountNumber', e.target.value)}
                        className="input-field"
                        placeholder="Número da conta"
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Titular / Beneficiário
                      </label>
                      <input
                        type="text"
                        value={formData.boliviaBeneficiary}
                        onChange={(e) => handleChange('boliviaBeneficiary', e.target.value)}
                        className="input-field"
                        placeholder="Nome do titular"
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* PARAGUAI & ARGENTINA - ALIAS BANCÁRIO */}
              {(formData.targetCountry === 'Paraguai' || formData.targetCountry === 'Argentina') && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Key size={16} />
                      {formData.targetCountry === 'Paraguai' ? '🇵🇾' : '🇦🇷'} Transferência Direta via Alias ({formData.targetCountry})
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Chave Alias / CBU
                      </label>
                      <input
                        type="text"
                        value={formData.aliasKey}
                        onChange={(e) => handleChange('aliasKey', e.target.value)}
                        className="input-field"
                        placeholder="Ex: ueno.alias / cbu.cuenta"
                        style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Banco / Instituição Financeira
                      </label>
                      <input
                        type="text"
                        value={formData.aliasBank}
                        onChange={(e) => handleChange('aliasBank', e.target.value)}
                        className="input-field"
                        placeholder="Ex: ueno, Atlas, Itaú, Banco Familiar"
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Titular / Beneficiário da Conta
                      </label>
                      <input
                        type="text"
                        value={formData.aliasBeneficiary}
                        onChange={(e) => handleChange('aliasBeneficiary', e.target.value)}
                        className="input-field"
                        placeholder="Nome do titular"
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* BRASIL - PIX DIRETO */}
              {formData.targetCountry === 'Brasil' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Key size={15} />
                      🇧🇷 Dados da Chave PIX (Brasil)
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

                  <div style={{ marginTop: '14px', padding: '12px 14px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🔘 Botão Nativo de Copiar PIX (1-Clique WhatsApp)</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                        Envia um botão interativo nativo no WhatsApp para copiar a chave diretamente no celular.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.sendPixButton !== false}
                      onChange={(e) => handleChange('sendPixButton', e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3b82f6' }}
                    />
                  </div>
                </div>
              )}
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

        {/* Clone de Voz & Sotaque Regional (Fish Audio) */}
        <div style={{
          background: 'rgba(236, 72, 153, 0.04)',
          border: '1px solid rgba(236, 72, 153, 0.2)',
          borderRadius: '12px',
          padding: '18px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mic size={18} color="#f472b6" />
              <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Sotaque & Identidade Vocal da Região (Fish Audio)
              </h4>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#f472b6', background: 'rgba(236, 72, 153, 0.12)', padding: '2px 8px', borderRadius: '4px' }}>
              LatAm & Brasil TTS
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '12px', lineHeight: 1.4 }}>
            Para máxima taxa de conversão no WhatsApp, os áudios enviados ao lead são sintetizados com o sotaque regional nativo de {formData.targetCountry}.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                ID do Sotaque / Clone de Voz
              </label>
              <input
                type="text"
                value={formData.voiceAccentId}
                onChange={(e) => handleChange('voiceAccentId', e.target.value)}
                className="input-field"
                placeholder="Ex: es_MX_native_01 ou ID do Fish Audio"
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Atalhos Rápidos de Sotaque
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {COUNTRY_PRESETS.map((p) => (
                  <button
                    key={p.country}
                    type="button"
                    onClick={() => handleChange('voiceAccentId', p.voiceAccentId)}
                    className="btn-secondary"
                    style={{
                      fontSize: '0.72rem',
                      padding: '4px 8px',
                      background: formData.voiceAccentId === p.voiceAccentId ? 'rgba(236, 72, 153, 0.2)' : undefined,
                      borderColor: formData.voiceAccentId === p.voiceAccentId ? '#f472b6' : undefined
                    }}
                  >
                    <span>{p.flag} {p.voiceAccentId}</span>
                  </button>
                ))}
              </div>
            </div>
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
