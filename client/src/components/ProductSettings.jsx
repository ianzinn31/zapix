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
  Coins,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Eye,
  X
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
    country: 'Estados Unidos',
    flag: '🇺🇸',
    currencyCode: 'USD',
    currencySymbol: '$',
    paymentMethodType: 'checkout',
    paymentInstructions: 'Direct checkout link via Stripe / Hotmart Global',
    voiceAccentId: 'en_US_native_01',
    defaultTicketBasic: 15,
    defaultTicketComplete: 27,
    tag: 'USD / Global',
    description: 'Mercado global em inglês. Moeda em Dólar (USD) e links diretos de checkout internacional.'
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

export const LOCALIZATION_COUNTRIES = [
  {
    country: 'México',
    flag: '🇲🇽',
    currencyCode: 'MXN',
    currencySymbol: '$',
    slangTone: 'peques, padrísimo, chido, oye, pantallas',
    description: 'Espanhol mexicano nativo para vendas via SPEI (XPag).'
  },
  {
    country: 'Colômbia',
    flag: '🇨🇴',
    currencyCode: 'COP',
    currencySymbol: '$',
    slangTone: 'parce, chévere, de una, a la orden',
    description: 'Espanhol colombiano acolhedor para Nequi e Bre-B.'
  },
  {
    country: 'Argentina',
    flag: '🇦🇷',
    currencyCode: 'ARS',
    currencySymbol: '$',
    slangTone: 'mirá, posta, nenes, dale, re lindo',
    description: 'Espanhol rioplatense com voseo sutil para CBU e Alias.'
  },
  {
    country: 'Bolívia',
    flag: '🇧🇴',
    currencyCode: 'BOB',
    currencySymbol: 'Bs',
    slangTone: 'chicos, caserito, al tiro, dale',
    description: 'Espanhol boliviano direto para pagamentos via QR Simple.'
  },
  {
    country: 'Paraguai',
    flag: '🇵🇾',
    currencyCode: 'PYG',
    currencySymbol: 'Gs',
    slangTone: 'purete, tranquilidad, amigo/a',
    description: 'Espanhol paraguaio cordial para Alias bancário.'
  },
  {
    country: 'Estados Unidos',
    flag: '🇺🇸',
    currencyCode: 'USD',
    currencySymbol: '$',
    slangTone: 'kiddos, screen time, fun learning',
    description: 'American English natural para vendas internacionais em dólar.'
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
    xpagClientId: product?.xpagClientId || product?.xpagApiKey || '',
    xpagClientSecret: product?.xpagClientSecret || '',
    xpagEnvironment: product?.xpagEnvironment || 'production',
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

  // XPag Live Testing & Balance States
  const [testingXpag, setTestingXpag] = useState(false);
  const [xpagTestResult, setXpagTestResult] = useState(null);
  const [xpagBalances, setXpagBalances] = useState(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [copiedXpagWebhook, setCopiedXpagWebhook] = useState(false);

  // Offer Localization States
  const [localizedOffers, setLocalizedOffers] = useState(product?.localizedOffers || {});
  const [localizingCountry, setLocalizingCountry] = useState(null);
  const [localizationStatus, setLocalizationStatus] = useState(null);
  const [editingModalCountry, setEditingModalCountry] = useState(null);
  const [modalOfferData, setModalOfferData] = useState(null);
  const [baseOfferBackup, setBaseOfferBackup] = useState(null);

  const handleTestXpagConnection = async () => {
    setTestingXpag(true);
    setXpagTestResult(null);
    try {
      const res = await fetch('/api/xpag/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: formData.xpagClientId || formData.xpagApiKey,
          clientSecret: formData.xpagClientSecret,
          environment: formData.xpagEnvironment
        })
      });
      const data = await res.json();
      setXpagTestResult(data);
      if (data.balances) {
        setXpagBalances(data.balances);
      }
    } catch (err) {
      setXpagTestResult({ success: false, message: err.message });
    } finally {
      setTestingXpag(false);
    }
  };

  const handleFetchXpagBalances = async () => {
    setLoadingBalances(true);
    try {
      const res = await fetch('/api/xpag/balance');
      const data = await res.json();
      if (data.balances) {
        setXpagBalances(data.balances);
      }
    } catch (_) {}
    setLoadingBalances(false);
  };

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
        xpagClientId: product.xpagClientId || product.xpagApiKey || '',
        xpagClientSecret: product.xpagClientSecret || '',
        xpagEnvironment: product.xpagEnvironment || 'production',
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
        defaultAudioPitchText: product.defaultAudioPitchText || '',
        localizedOffers: product.localizedOffers || {}
      });
      if (product.localizedOffers) {
        setLocalizedOffers(product.localizedOffers);
      }
    }

    // Refresh localized offers from backend cache
    fetch('/api/product/localized-offers')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          setLocalizedOffers((prev) => ({ ...data, ...prev }));
        }
      })
      .catch(() => {});
  }, [product]);

  const handleSelectCountry = (preset) => {
    // If coming from Brasil, backup base offer in memory
    if (formData.targetCountry === 'Brasil' && preset.country !== 'Brasil') {
      setBaseOfferBackup({
        name: formData.name,
        niche: formData.niche,
        targetAudience: formData.targetAudience,
        mainPainPoints: [...formData.mainPainPoints],
        mainBenefits: [...formData.mainBenefits],
        objections: [...formData.objections],
        defaultAudioPitchText: formData.defaultAudioPitchText,
        ticketBasic: formData.ticketBasic,
        ticketComplete: formData.ticketComplete
      });
    }

    const existingLocalized = localizedOffers[preset.country];

    setFormData((prev) => {
      const isDefaultPrice = !prev.ticketBasic || prev.ticketBasic === 15 || prev.ticketBasic === 0;
      const isDefaultComplete = !prev.ticketComplete || prev.ticketComplete === 37 || prev.ticketComplete === 0;

      // Returning to Brasil with backup
      if (preset.country === 'Brasil' && baseOfferBackup) {
        return {
          ...prev,
          targetCountry: 'Brasil',
          currencyCode: 'BRL',
          currencySymbol: 'R$',
          currency: 'BRL',
          paymentMethodType: 'pix',
          paymentInstructions: 'Enviar o comprovante aqui no WhatsApp para liberação imediata do acesso.',
          voiceAccentId: 'pt_BR_native_01',
          ...baseOfferBackup
        };
      }

      return {
        ...prev,
        targetCountry: preset.country,
        currencyCode: existingLocalized?.currencyCode || preset.currencyCode,
        currencySymbol: existingLocalized?.currencySymbol || preset.currencySymbol,
        currency: existingLocalized?.currencyCode || preset.currencyCode,
        paymentMethodType: preset.paymentMethodType,
        paymentInstructions: preset.paymentInstructions,
        voiceAccentId: preset.voiceAccentId,
        ticketBasic: existingLocalized?.ticketBasic ?? (isDefaultPrice ? preset.defaultTicketBasic : prev.ticketBasic),
        ticketComplete: existingLocalized?.ticketComplete ?? (isDefaultComplete ? preset.defaultTicketComplete : prev.ticketComplete),
        price: existingLocalized?.ticketBasic ?? (isDefaultPrice ? preset.defaultTicketBasic : prev.price)
      };
    });
  };

  const handleRestoreBaseOffer = () => {
    const brasilPreset = COUNTRY_PRESETS.find((p) => p.country === 'Brasil');
    if (brasilPreset) {
      handleSelectCountry(brasilPreset);
      setLocalizationStatus({
        type: 'info',
        text: 'Oferta base em Português (Brasil 🇧🇷) restaurada no formulário.'
      });
      setTimeout(() => setLocalizationStatus(null), 3000);
    }
  };

  // One-by-one AI Offer Localizer
  const handleLocalizeCountry = async (targetCountry) => {
    if (localizingCountry) return; // Enforce one at a time to prevent server/API rate-limit lock

    if (!formData.name && !formData.niche) {
      setLocalizationStatus({
        type: 'error',
        text: 'Por favor, preencha pelo menos o Nome e o Nicho da oferta base em português antes de localizar com IA.'
      });
      return;
    }

    setLocalizingCountry(targetCountry);
    setLocalizationStatus({
      type: 'info',
      text: `Traduzindo e adaptando culturalmente a oferta e funil para ${targetCountry} com IA... Aguarde alguns instantes.`
    });

    try {
      const res = await fetch('/api/product/localize-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetCountry,
          baseProduct: {
            name: formData.name,
            niche: formData.niche,
            targetAudience: formData.targetAudience,
            price: formData.price,
            ticketBasic: formData.ticketBasic,
            ticketComplete: formData.ticketComplete,
            currency: formData.currency,
            currencyCode: formData.currencyCode,
            currencySymbol: formData.currencySymbol,
            guaranteeDays: formData.guaranteeDays,
            mainPainPoints: formData.mainPainPoints,
            mainBenefits: formData.mainBenefits,
            objections: formData.objections,
            defaultAudioPitchText: formData.defaultAudioPitchText
          }
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro na resposta do servidor');
      }

      const updatedMap = {
        ...localizedOffers,
        [targetCountry]: data.localized
      };
      setLocalizedOffers(updatedMap);
      setFormData((prev) => ({
        ...prev,
        localizedOffers: updatedMap
      }));

      // Immediately save to parent settings
      onSave({
        product: {
          ...formData,
          localizedOffers: updatedMap
        }
      });

      setLocalizationStatus({
        type: 'success',
        text: `✨ Oferta localizada com sucesso para ${targetCountry}! Gírias nativas, moeda (${data.localized.currencyCode}) e roteiro de áudio salvos e prontos para o atendimento no WhatsApp.`
      });
      setTimeout(() => {
        setLocalizationStatus(null);
      }, 6000);
    } catch (err) {
      console.error('[Localization Error]:', err);
      setLocalizationStatus({
        type: 'error',
        text: `Falha ao localizar oferta para ${targetCountry}: ${err.message}`
      });
    } finally {
      setLocalizingCountry(null);
    }
  };

  const handleOpenEditModal = (countryName) => {
    const offer = localizedOffers[countryName];
    if (!offer) return;
    setEditingModalCountry(countryName);
    setModalOfferData({
      ...offer,
      mainPainPoints: Array.isArray(offer.mainPainPoints) ? [...offer.mainPainPoints] : [],
      mainBenefits: Array.isArray(offer.mainBenefits) ? [...offer.mainBenefits] : [],
      objections: Array.isArray(offer.objections) ? [...offer.objections] : []
    });
  };

  const handleSaveModalOffer = () => {
    if (!editingModalCountry || !modalOfferData) return;
    const updatedMap = {
      ...localizedOffers,
      [editingModalCountry]: {
        ...modalOfferData,
        updatedAt: Date.now()
      }
    };
    setLocalizedOffers(updatedMap);
    setFormData((prev) => ({ ...prev, localizedOffers: updatedMap }));
    onSave({
      product: {
        ...formData,
        localizedOffers: updatedMap
      }
    });
    setEditingModalCountry(null);
    setModalOfferData(null);
    setLocalizationStatus({
      type: 'success',
      text: `Alterações da oferta localizada de ${editingModalCountry} salvas com sucesso!`
    });
    setTimeout(() => setLocalizationStatus(null), 4000);
  };

  const handleApplyToMainForm = (countryName) => {
    const offer = localizedOffers[countryName];
    if (!offer) return;
    const preset = COUNTRY_PRESETS.find((p) => p.country === countryName);
    setFormData((prev) => ({
      ...prev,
      name: offer.name || prev.name,
      niche: offer.niche || prev.niche,
      targetAudience: offer.targetAudience || prev.targetAudience,
      ticketBasic: offer.ticketBasic || prev.ticketBasic,
      ticketComplete: offer.ticketComplete || prev.ticketComplete,
      price: offer.ticketBasic || prev.price,
      currencyCode: offer.currencyCode || preset?.currencyCode || prev.currencyCode,
      currencySymbol: offer.currencySymbol || preset?.currencySymbol || prev.currencySymbol,
      targetCountry: countryName,
      mainPainPoints: Array.isArray(offer.mainPainPoints) ? offer.mainPainPoints : prev.mainPainPoints,
      mainBenefits: Array.isArray(offer.mainBenefits) ? offer.mainBenefits : prev.mainBenefits,
      objections: Array.isArray(offer.objections) ? offer.objections : prev.objections,
      defaultAudioPitchText: offer.defaultAudioPitchText || prev.defaultAudioPitchText,
      voiceAccentId: preset?.voiceAccentId || prev.voiceAccentId
    }));
    setEditingModalCountry(null);
    setLocalizationStatus({
      type: 'success',
      text: `Oferta localizada de ${countryName} carregada no formulário de edição!`
    });
    setTimeout(() => setLocalizationStatus(null), 4000);
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
    onSave({
      product: {
        ...formData,
        localizedOffers
      }
    });
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

          {formData.targetCountry !== 'Brasil' && (
            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ fontSize: '0.78rem', color: '#e2e8f0' }}>
                🌎 <strong>Visualizando região {formData.targetCountry}:</strong> {localizedOffers[formData.targetCountry] ? 'Adaptação cultural pronta para a IA!' : 'Ainda não localizada.'}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {localizedOffers[formData.targetCountry] && (
                  <button
                    type="button"
                    onClick={() => handleApplyToMainForm(formData.targetCountry)}
                    className="btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                  >
                    📥 Carregar cópia de {formData.targetCountry}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRestoreBaseOffer}
                  className="btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '4px 10px', color: '#34d399', borderColor: 'rgba(52, 211, 153, 0.4)' }}
                >
                  ↩️ Restaurar Oferta Base (Brasil 🇧🇷)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* LOCALIZADOR GLOBAL DE OFERTA COM IA (1 POR VEZ) */}
        <div style={{
          background: 'radial-gradient(ellipse at top left, rgba(99, 102, 241, 0.15), rgba(15, 23, 42, 0.85))',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          borderRadius: '14px',
          padding: '22px',
          marginBottom: '26px',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                padding: '10px',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                borderRadius: '10px',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Sparkles size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Localizador Global de Oferta com IA</span>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.25)', color: '#c7d2fe', border: '1px solid rgba(165, 180, 252, 0.3)' }}>
                    Adaptação Cultural & Gírias Nativas
                  </span>
                </h4>
                <p style={{ fontSize: '0.78rem', color: '#cbd5e1', margin: '3px 0 0 0' }}>
                  Preencha sua oferta em português abaixo. Clique no botão de cada país para a IA traduzir todo o funil, dores, quebra de objeções e áudios com as gírias locais (um por vez para estabilidade total).
                </p>
              </div>
            </div>

            {/* Overall Count badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Progresso Global:
              </span>
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '8px',
                background: Object.keys(localizedOffers).length > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: Object.keys(localizedOffers).length > 0 ? '#34d399' : '#94a3b8',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {Object.keys(localizedOffers).length} de {LOCALIZATION_COUNTRIES.length} países prontos
              </span>
            </div>
          </div>

          {/* Localization Status Banner */}
          {localizationStatus && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              background: localizationStatus.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : localizationStatus.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.18)',
              border: `1px solid ${localizationStatus.type === 'error' ? '#ef4444' : localizationStatus.type === 'success' ? '#10b981' : '#818cf8'}`,
              color: localizationStatus.type === 'error' ? '#fca5a5' : localizationStatus.type === 'success' ? '#6ee7b7' : '#c7d2fe',
              fontSize: '0.82rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {localizationStatus.type === 'info' && <RefreshCw size={16} className="animate-spin" />}
                {localizationStatus.type === 'success' && <CheckCircle2 size={16} />}
                {localizationStatus.type === 'error' && <AlertCircle size={16} />}
                <span>{localizationStatus.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setLocalizationStatus(null)}
                style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.7 }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Country Localization Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {LOCALIZATION_COUNTRIES.map((item) => {
              const localized = localizedOffers[item.country];
              const isLocalizingThis = localizingCountry === item.country;
              const isBusyOther = Boolean(localizingCountry && !isLocalizingThis);

              return (
                <div
                  key={item.country}
                  style={{
                    background: localized ? 'rgba(15, 23, 42, 0.75)' : 'rgba(15, 23, 42, 0.45)',
                    border: localized ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  {/* Top info */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.4rem' }}>{item.flag}</span>
                        <div>
                          <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc' }}>
                            {item.country}
                          </span>
                          <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: '#94a3b8' }}>
                            ({item.currencyCode} {item.currencySymbol})
                          </span>
                        </div>
                      </div>

                      {localized ? (
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#34d399',
                          border: '1px solid rgba(52, 211, 153, 0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Check size={11} />
                          Pronto
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '0.68rem',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: '#94a3b8',
                          border: '1px solid rgba(255, 255, 255, 0.08)'
                        }}>
                          Pendente
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: '0.73rem', color: '#cbd5e1', marginBottom: '6px', lineHeight: 1.3 }}>
                      {item.description}
                    </p>

                    <div style={{
                      fontSize: '0.7rem',
                      color: '#a5b4fc',
                      background: 'rgba(99, 102, 241, 0.08)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      lineHeight: 1.3
                    }}>
                      💬 <strong>Gírias:</strong> <em>{item.slangTone}</em>
                    </div>

                    {/* Quick Preview of Localized Name / Ticket */}
                    {localized && (
                      <div style={{
                        marginTop: '8px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'rgba(16, 185, 129, 0.06)',
                        border: '1px solid rgba(16, 185, 129, 0.15)',
                        fontSize: '0.72rem',
                        color: '#6ee7b7'
                      }}>
                        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          🏷️ {localized.name || 'Nome adaptado'}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.68rem', marginTop: '2px' }}>
                          Ticket: {item.currencySymbol} {localized.ticketBasic} | VIP: {item.currencySymbol} {localized.ticketComplete}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    {localized ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item.country)}
                          className="btn-secondary"
                          style={{
                            flex: 1,
                            fontSize: '0.75rem',
                            padding: '6px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <Eye size={13} />
                          <span>Ver / Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLocalizeCountry(item.country)}
                          disabled={isBusyOther || isLocalizingThis}
                          className="btn-secondary"
                          title="Regerar adaptação com IA"
                          style={{
                            fontSize: '0.75rem',
                            padding: '6px 10px',
                            opacity: (isBusyOther || isLocalizingThis) ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <RefreshCw size={13} className={isLocalizingThis ? 'animate-spin' : ''} />
                          <span>{isLocalizingThis ? 'IA...' : 'Regerar'}</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleLocalizeCountry(item.country)}
                        disabled={isBusyOther || isLocalizingThis}
                        className="btn-primary"
                        style={{
                          width: '100%',
                          fontSize: '0.78rem',
                          padding: '7px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          opacity: (isBusyOther || isLocalizingThis) ? 0.5 : 1
                        }}
                      >
                        {isLocalizingThis ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Traduzindo com IA...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            <span>✨ Localizar com IA</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
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
              {/* MÉXICO & GLOBAL - XPAG / SPEI */}
              {formData.targetCountry === 'México' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Zap size={17} />
                      🇲🇽 XPag Global - Gateway Nativo (SPEI / PIX / USDT)
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                      ⚡ Aprovação Automática em Tempo Real
                    </span>
                  </div>

                  <div style={{ padding: '12px 14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '14px', fontSize: '0.78rem', color: '#a7f3d0', lineHeight: 1.5 }}>
                    🌐 <strong>Como funciona a integração oficial da XPag:</strong> O Zapix gera dinamicamente uma CLABE interbancária exclusiva (SPEI) para cada cliente no México (ou código PIX no Brasil). O cliente transfere em qualquer aplicativo bancário (STP, BBVA, Santander, etc.) e o Webhook da XPag aprova e dispara os arquivos automaticamente no WhatsApp, sem exigir comprovante manual!
                  </div>

                  {/* Ambiente XPag: Produção vs Sandbox */}
                  <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>Ambiente da API:</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#e2e8f0', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="xpagEnvironment"
                        value="production"
                        checked={formData.xpagEnvironment !== 'sandbox'}
                        onChange={() => handleChange('xpagEnvironment', 'production')}
                      />
                      <span style={{ color: '#34d399', fontWeight: 600 }}>🟢 Produção (api.xpag.global)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#e2e8f0', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="xpagEnvironment"
                        value="sandbox"
                        checked={formData.xpagEnvironment === 'sandbox'}
                        onChange={() => handleChange('xpagEnvironment', 'sandbox')}
                      />
                      <span style={{ color: '#fbbf24', fontWeight: 600 }}>🟡 Sandbox (Testes)</span>
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        X-Client-Id da XPag
                      </label>
                      <input
                        type="text"
                        value={formData.xpagClientId || formData.xpagApiKey || ''}
                        onChange={(e) => {
                          handleChange('xpagClientId', e.target.value);
                          handleChange('xpagApiKey', e.target.value);
                        }}
                        className="input-field"
                        placeholder={formData.xpagEnvironment === 'sandbox' ? 'xpagsandbox_00000000' : 'xpag_client_...'}
                        style={{ fontFamily: 'monospace', fontSize: '0.84rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        X-Client-Secret da XPag
                      </label>
                      <input
                        type="password"
                        value={formData.xpagClientSecret || ''}
                        onChange={(e) => handleChange('xpagClientSecret', e.target.value)}
                        className="input-field"
                        placeholder="••••••••••••••••••••••••"
                        style={{ fontFamily: 'monospace', fontSize: '0.84rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                      Instruções de Pagamento SPEI (Exibido pela IA nos fechamentos)
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

                  {/* Ações de Teste e Balanço */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '14px' }}>
                    <button
                      type="button"
                      onClick={handleTestXpagConnection}
                      disabled={testingXpag}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        color: '#34d399',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <RefreshCw size={13} className={testingXpag ? 'animate-spin' : ''} />
                      <span>{testingXpag ? 'Testando Conexão...' : 'Testar Conexão com a XPag'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleFetchXpagBalances}
                      disabled={loadingBalances}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        background: 'rgba(6, 182, 212, 0.15)',
                        border: '1px solid rgba(6, 182, 212, 0.4)',
                        color: '#22d3ee',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Coins size={13} className={loadingBalances ? 'animate-spin' : ''} />
                      <span>{loadingBalances ? 'Consultando...' : 'Consultar Saldo XPag'}</span>
                    </button>
                  </div>

                  {/* Resultado do Teste */}
                  {xpagTestResult && (
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      marginBottom: '14px',
                      fontSize: '0.78rem',
                      background: xpagTestResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: xpagTestResult.success ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                      color: xpagTestResult.success ? '#34d399' : '#f87171',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {xpagTestResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      <span>{xpagTestResult.message}</span>
                    </div>
                  )}

                  {/* Saldos da Carteira */}
                  {xpagBalances && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: '10px',
                      marginBottom: '14px',
                      padding: '12px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>🇲🇽 Saldo MXN</span>
                        <strong style={{ fontSize: '1rem', color: '#34d399' }}>
                          $ {Number(xpagBalances.MXN?.available || 0).toFixed(2)}
                        </strong>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>🇧🇷 Saldo BRL</span>
                        <strong style={{ fontSize: '1rem', color: '#22d3ee' }}>
                          R$ {Number(xpagBalances.BRL?.available || 0).toFixed(2)}
                        </strong>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>💵 Saldo USDT</span>
                        <strong style={{ fontSize: '1rem', color: '#a78bfa' }}>
                          $ {Number(xpagBalances.USDT?.available || 0).toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* Webhook URL com Copiar */}
                  <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1' }}>
                        Webhook Oficial de Notificação da XPag:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/webhooks/xpag`);
                          setCopiedXpagWebhook(true);
                          setTimeout(() => setCopiedXpagWebhook(false), 2000);
                        }}
                        style={{
                          fontSize: '0.72rem',
                          background: copiedXpagWebhook ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                          border: 'none',
                          color: copiedXpagWebhook ? '#34d399' : '#cbd5e1',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {copiedXpagWebhook ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedXpagWebhook ? 'Copiado!' : 'Copiar URL'}</span>
                      </button>
                    </div>
                    <code style={{ fontSize: '0.75rem', color: '#60a5fa', wordBreak: 'break-all' }}>
                      {`${window.location.origin}/webhooks/xpag`}
                    </code>
                    <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '6px' }}>
                      Cole esta URL no painel da XPag em <em>Configurações / Webhooks</em>. Todas as aprovações SPEI e PIX confirmam automaticamente o lead e liberam o acesso no WhatsApp!
                    </p>
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

        {/* Instruções & Diretrizes de Abordagem / Áudio (Sem Roteiro Fixo - 100% Sob Medida) */}
        <div style={{
          background: 'rgba(6, 182, 212, 0.04)',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          borderRadius: '12px',
          padding: '18px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 700, color: '#22d3ee', margin: 0 }}>
              <Mic size={18} />
              <span>Instruções & Diretrizes de Abordagem / Áudio para a IA</span>
            </label>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '10px',
              background: 'rgba(34, 211, 238, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(34, 211, 238, 0.3)'
            }}>
              Zero Roteiro Engessado • 100% Adaptado ao Lead
            </span>
          </div>

          <p style={{ fontSize: '0.76rem', color: '#94a3b8', marginBottom: '10px', lineHeight: 1.4 }}>
            Monte aqui as instruções do que você quer que a IA transmita na abordagem. A IA <strong>NÃO</strong> vai repetir um script engessado: ela vai ouvir a história do cliente, identificar a dor DELE e gerar mensagens e áudios sob medida na hora para convencer o lead de que ela está 100% focada em resolver o caso particular dele.
          </p>

          <textarea
            value={formData.defaultAudioPitchText}
            onChange={(e) => handleChange('defaultAudioPitchText', e.target.value)}
            className="input-field"
            rows={4}
            placeholder="Ex: Acolha o cliente com muito carinho e entusiasmo. Pergunte a idade do pequeno se ainda não souber. Conecte com a dificuldade que a mãe mencionou sobre telas ou desânimo escolar. Destaque que as atividades são ilustradas e fáceis de aplicar em 15 minutos por dia, gerando resultados desde as primeiras semanas. Quando fizer sentido, proponha começar hoje mesmo."
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

      {/* MODAL: VISUALIZAR E EDITAR CÓPIA LOCALIZADA */}
      {editingModalCountry && modalOfferData && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '860px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(30, 41, 59, 0.5)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.8rem' }}>
                  {COUNTRY_PRESETS.find((p) => p.country === editingModalCountry)?.flag || '🌎'}
                </span>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    Oferta & Funil Adaptado: {editingModalCountry}
                  </h3>
                  <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                    Textos, gírias nativas e moeda oficial ({modalOfferData.currencyCode || 'USD'}) prontos para o WhatsApp
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setEditingModalCountry(null); setModalOfferData(null); }}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#cbd5e1',
                  padding: '6px',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Name and Niche */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Nome do Produto Localizado
                  </label>
                  <input
                    type="text"
                    value={modalOfferData.name || ''}
                    onChange={(e) => setModalOfferData({ ...modalOfferData, name: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Nicho no Idioma Local
                  </label>
                  <input
                    type="text"
                    value={modalOfferData.niche || ''}
                    onChange={(e) => setModalOfferData({ ...modalOfferData, niche: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Pricing */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Ticket Básico ({modalOfferData.currencySymbol || '$'} {modalOfferData.currencyCode || ''})
                  </label>
                  <input
                    type="number"
                    value={modalOfferData.ticketBasic ?? 0}
                    onChange={(e) => setModalOfferData({ ...modalOfferData, ticketBasic: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Ticket Completo / VIP ({modalOfferData.currencySymbol || '$'} {modalOfferData.currencyCode || ''})
                  </label>
                  <input
                    type="number"
                    value={modalOfferData.ticketComplete ?? 0}
                    onChange={(e) => setModalOfferData({ ...modalOfferData, ticketComplete: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Target Audience */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Público-Alvo com Vocabulário e Cultura de {editingModalCountry}
                </label>
                <textarea
                  rows={2}
                  value={modalOfferData.targetAudience || ''}
                  onChange={(e) => setModalOfferData({ ...modalOfferData, targetAudience: e.target.value })}
                  className="input-field"
                />
              </div>

              {/* Localized Audio Pitch Script */}
              {/* Diretrizes de Abordagem e Áudio Localizadas */}
              <div style={{
                background: 'rgba(6, 182, 212, 0.05)',
                border: '1px solid rgba(6, 182, 212, 0.2)',
                borderRadius: '10px',
                padding: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', fontWeight: 700, color: '#22d3ee', margin: 0 }}>
                    <Mic size={15} />
                    <span>Diretrizes de Abordagem & Áudio para {editingModalCountry} (Com Gírias Nativas)</span>
                  </label>
                  <span style={{ fontSize: '0.68rem', color: '#38bdf8' }}>
                    Áudios gerados sob medida ao caso do lead
                  </span>
                </div>
                <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '8px', lineHeight: 1.3 }}>
                  Orientações culturais para a IA usar como guia. A IA formula áudios e mensagens únicos para cada cliente na gíria local de {editingModalCountry}, sem roteiros pré-fabricados.
                </p>
                <textarea
                  rows={3}
                  value={modalOfferData.defaultAudioPitchText || ''}
                  onChange={(e) => setModalOfferData({ ...modalOfferData, defaultAudioPitchText: e.target.value })}
                  className="input-field"
                />
              </div>

              {/* Dores Principais */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#fca5a5', marginBottom: '6px' }}>
                  Dores Principais Adaptadas
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(modalOfferData.mainPainPoints || []).map((pain, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={pain}
                        onChange={(e) => {
                          const newArr = [...modalOfferData.mainPainPoints];
                          newArr[idx] = e.target.value;
                          setModalOfferData({ ...modalOfferData, mainPainPoints: newArr });
                        }}
                        className="input-field"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newArr = modalOfferData.mainPainPoints.filter((_, i) => i !== idx);
                          setModalOfferData({ ...modalOfferData, mainPainPoints: newArr });
                        }}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '8px', padding: '0 10px', cursor: 'pointer' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setModalOfferData({
                        ...modalOfferData,
                        mainPainPoints: [...(modalOfferData.mainPainPoints || []), '']
                      });
                    }}
                    className="btn-secondary"
                    style={{ fontSize: '0.74rem', width: 'fit-content' }}
                  >
                    <Plus size={14} /> Adicionar Dor
                  </button>
                </div>
              </div>

              {/* Benefícios Principais */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#6ee7b7', marginBottom: '6px' }}>
                  Benefícios e Transformação Adaptados
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(modalOfferData.mainBenefits || []).map((ben, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={ben}
                        onChange={(e) => {
                          const newArr = [...modalOfferData.mainBenefits];
                          newArr[idx] = e.target.value;
                          setModalOfferData({ ...modalOfferData, mainBenefits: newArr });
                        }}
                        className="input-field"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newArr = modalOfferData.mainBenefits.filter((_, i) => i !== idx);
                          setModalOfferData({ ...modalOfferData, mainBenefits: newArr });
                        }}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '8px', padding: '0 10px', cursor: 'pointer' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setModalOfferData({
                        ...modalOfferData,
                        mainBenefits: [...(modalOfferData.mainBenefits || []), '']
                      });
                    }}
                    className="btn-secondary"
                    style={{ fontSize: '0.74rem', width: 'fit-content' }}
                  >
                    <Plus size={14} /> Adicionar Benefício
                  </button>
                </div>
              </div>

              {/* Objeções */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8', marginBottom: '6px' }}>
                  Quebra de Objeções (Gatilhos e Respostas com Modismos Locais)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(modalOfferData.objections || []).map((obj, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '8px' }}>
                      <input
                        type="text"
                        value={obj.trigger || ''}
                        placeholder="Gatilho"
                        onChange={(e) => {
                          const newArr = [...modalOfferData.objections];
                          newArr[idx] = { ...newArr[idx], trigger: e.target.value };
                          setModalOfferData({ ...modalOfferData, objections: newArr });
                        }}
                        className="input-field"
                      />
                      <input
                        type="text"
                        value={obj.response || ''}
                        placeholder="Resposta persuasiva com gírias"
                        onChange={(e) => {
                          const newArr = [...modalOfferData.objections];
                          newArr[idx] = { ...newArr[idx], response: e.target.value };
                          setModalOfferData({ ...modalOfferData, objections: newArr });
                        }}
                        className="input-field"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newArr = modalOfferData.objections.filter((_, i) => i !== idx);
                          setModalOfferData({ ...modalOfferData, objections: newArr });
                        }}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '8px', padding: '0 10px', cursor: 'pointer' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setModalOfferData({
                        ...modalOfferData,
                        objections: [...(modalOfferData.objections || []), { trigger: '', response: '' }]
                      });
                    }}
                    className="btn-secondary"
                    style={{ fontSize: '0.74rem', width: 'fit-content' }}
                  >
                    <Plus size={14} /> Adicionar Objeção
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(30, 41, 59, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => handleApplyToMainForm(editingModalCountry)}
                className="btn-secondary"
                style={{ fontSize: '0.8rem' }}
              >
                <span>📥 Carregar esta cópia no formulário principal</span>
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setEditingModalCountry(null); setModalOfferData(null); }}
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem' }}
                >
                  <span>Fechar</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalOffer}
                  className="btn-primary"
                  style={{ fontSize: '0.8rem' }}
                >
                  <Save size={15} />
                  <span>Salvar Ajustes de {editingModalCountry}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
