import React, { useState, useEffect, useRef } from 'react';
import { 
  Cpu, 
  ShieldCheck, 
  AlertTriangle, 
  Key, 
  Sliders, 
  Save, 
  CheckCircle2, 
  Eye, 
  EyeOff,
  Zap,
  RefreshCw,
  Globe,
  Search,
  Filter,
  Sparkles,
  Edit3,
  List,
  Code,
  FileCode,
  Terminal,
  Send,
  HelpCircle,
  Check,
  Copy,
  RotateCcw,
  FileText,
  Layers,
  Settings2,
  Play,
  Volume2,
  X
} from 'lucide-react';

export default function AiConfig({ aiSettings, onSave }) {
  const [formData, setFormData] = useState({
    primaryModel: aiSettings?.primaryModel || 'gemini-3.8-flash',
    primaryApiKey: aiSettings?.primaryApiKey || '',
    fallbackModel: aiSettings?.fallbackModel || 'z-ai/glm-5.3-flash',
    fallbackApiKey: aiSettings?.fallbackApiKey || '',
    tertiaryModel: aiSettings?.tertiaryModel || 'nvidia/nemotron-3.5-lightning:free',
    tertiaryApiKey: aiSettings?.tertiaryApiKey || '',
    temperature: aiSettings?.temperature ?? 0.7,
    maxTokens: aiSettings?.maxTokens || 1500,
    customPromptInstructions: aiSettings?.customPromptInstructions || '',
    systemPrompts: {
      mode: aiSettings?.systemPrompts?.mode || 'smart_engine',
      pt: aiSettings?.systemPrompts?.pt || '',
      es: aiSettings?.systemPrompts?.es || '',
      en: aiSettings?.systemPrompts?.en || '',
      countries: aiSettings?.systemPrompts?.countries || {}
    }
  });

  const [showPrimaryKey, setShowPrimaryKey] = useState(false);
  const [showFallbackKey, setShowFallbackKey] = useState(false);
  const [showTertiaryKey, setShowTertiaryKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // System Prompt & Multi-Language Management State
  const [activePromptTab, setActivePromptTab] = useState('pt');
  const [selectedExtraCountry, setSelectedExtraCountry] = useState('Bolívia');
  const [defaultsData, setDefaultsData] = useState(null);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const promptTextareaRef = useRef(null);

  // Live Prompt Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewCountry, setPreviewCountry] = useState('Brasil');

  // Live Test Playground State
  const [testPlaygroundOpen, setTestPlaygroundOpen] = useState(false);
  const [testLeadMessage, setTestLeadMessage] = useState('Oi! Como funciona o material de vocês? Qual o valor?');
  const [testingCustomPrompt, setTestingCustomPrompt] = useState(false);
  const [testPromptReply, setTestPromptReply] = useState(null);

  // Sync formData when props change
  useEffect(() => {
    if (aiSettings) {
      setFormData((prev) => ({
        ...prev,
        primaryModel: aiSettings.primaryModel || prev.primaryModel,
        primaryApiKey: aiSettings.primaryApiKey !== undefined ? aiSettings.primaryApiKey : prev.primaryApiKey,
        fallbackModel: aiSettings.fallbackModel || prev.fallbackModel,
        fallbackApiKey: aiSettings.fallbackApiKey !== undefined ? aiSettings.fallbackApiKey : prev.fallbackApiKey,
        tertiaryModel: aiSettings.tertiaryModel || prev.tertiaryModel,
        tertiaryApiKey: aiSettings.tertiaryApiKey !== undefined ? aiSettings.tertiaryApiKey : prev.tertiaryApiKey,
        temperature: aiSettings.temperature !== undefined ? aiSettings.temperature : prev.temperature,
        maxTokens: aiSettings.maxTokens || prev.maxTokens,
        customPromptInstructions: aiSettings.customPromptInstructions !== undefined ? aiSettings.customPromptInstructions : prev.customPromptInstructions,
        systemPrompts: {
          mode: aiSettings.systemPrompts?.mode || prev.systemPrompts?.mode || 'smart_engine',
          pt: aiSettings.systemPrompts?.pt !== undefined ? aiSettings.systemPrompts.pt : (prev.systemPrompts?.pt || ''),
          es: aiSettings.systemPrompts?.es !== undefined ? aiSettings.systemPrompts.es : (prev.systemPrompts?.es || ''),
          en: aiSettings.systemPrompts?.en !== undefined ? aiSettings.systemPrompts.en : (prev.systemPrompts?.en || ''),
          countries: {
            ...(prev.systemPrompts?.countries || {}),
            ...(aiSettings.systemPrompts?.countries || {})
          }
        }
      }));
    }
  }, [aiSettings]);

  // Fetch prompt defaults and dynamic variable definitions
  useEffect(() => {
    fetch('/api/ai/prompts/defaults')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setDefaultsData(data);
        }
      })
      .catch((err) => console.warn('Erro ao carregar defaults de prompts:', err));
  }, []);

  // Helper to get currently active prompt text
  const getCurrentPromptText = () => {
    const sp = formData.systemPrompts || {};
    if (activePromptTab === 'pt') return sp.pt || '';
    if (activePromptTab === 'es') return sp.es || '';
    if (activePromptTab === 'en') return sp.en || '';
    if (activePromptTab === 'es-MX') return sp.countries?.['México'] || '';
    if (activePromptTab === 'es-CO') return sp.countries?.['Colômbia'] || '';
    if (activePromptTab === 'es-AR') return sp.countries?.['Argentina'] || '';
    if (activePromptTab === 'other-country') return sp.countries?.[selectedExtraCountry] || '';
    return '';
  };

  // Helper to update currently active prompt text
  const handleUpdateCurrentPromptText = (text) => {
    setFormData((prev) => {
      const sp = { ...(prev.systemPrompts || {}) };
      const countries = { ...(sp.countries || {}) };

      if (activePromptTab === 'pt') sp.pt = text;
      else if (activePromptTab === 'es') sp.es = text;
      else if (activePromptTab === 'en') sp.en = text;
      else if (activePromptTab === 'es-MX') countries['México'] = text;
      else if (activePromptTab === 'es-CO') countries['Colômbia'] = text;
      else if (activePromptTab === 'es-AR') countries['Argentina'] = text;
      else if (activePromptTab === 'other-country') countries[selectedExtraCountry] = text;

      sp.countries = countries;
      return { ...prev, systemPrompts: sp };
    });
  };

  // Helper to load Battle-Tested Boss Template for current tab
  const handleLoadBossTemplate = () => {
    if (!defaultsData?.templates) return;
    const t = defaultsData.templates;
    let templateToLoad = '';

    if (activePromptTab === 'pt') templateToLoad = t.pt;
    else if (activePromptTab === 'es') templateToLoad = t.es;
    else if (activePromptTab === 'en') templateToLoad = t.en;
    else if (activePromptTab === 'es-MX') templateToLoad = t.countries?.['México'] || t.es;
    else if (activePromptTab === 'es-CO') templateToLoad = t.countries?.['Colômbia'] || t.es;
    else if (activePromptTab === 'es-AR') templateToLoad = t.countries?.['Argentina'] || t.es;
    else if (activePromptTab === 'other-country') templateToLoad = t.countries?.[selectedExtraCountry] || t.es;

    if (templateToLoad) {
      handleUpdateCurrentPromptText(templateToLoad);
    }
  };

  // Helper to insert a variable chip at cursor position
  const handleInsertVariable = (tag) => {
    const textarea = promptTextareaRef.current;
    const currentVal = getCurrentPromptText();
    if (!textarea) {
      handleUpdateCurrentPromptText(currentVal + (currentVal ? ' ' : '') + tag);
      return;
    }

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const nextVal = currentVal.substring(0, start) + tag + currentVal.substring(end);
    handleUpdateCurrentPromptText(nextVal);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  // Helper to open real-time preview modal
  const handleOpenPreview = async (countryOverride = null) => {
    const targetCtry = countryOverride || (
      activePromptTab === 'pt' ? 'Brasil' :
      activePromptTab === 'es-MX' ? 'México' :
      activePromptTab === 'es-CO' ? 'Colômbia' :
      activePromptTab === 'es-AR' ? 'Argentina' :
      activePromptTab === 'en' ? 'Estados Unidos' :
      activePromptTab === 'other-country' ? selectedExtraCountry :
      'Brasil'
    );
    setPreviewCountry(targetCtry);
    setPreviewLoading(true);
    setPreviewModalOpen(true);

    try {
      const res = await fetch('/api/ai/prompts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: targetCtry,
          language: targetCtry === 'Brasil' ? 'pt' : (targetCtry === 'Estados Unidos' ? 'en' : 'es'),
          customTemplate: getCurrentPromptText() || null
        })
      });
      const data = await res.json();
      if (data.success) {
        setPreviewData(data);
      }
    } catch (err) {
      console.warn('Erro ao gerar preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Helper to test custom prompt live with AI
  const handleTestCustomPrompt = async () => {
    setTestingCustomPrompt(true);
    setTestPromptReply(null);
    try {
      const currentPrompt = getCurrentPromptText();
      const targetCtry = (
        activePromptTab === 'pt' ? 'Brasil' :
        activePromptTab === 'es-MX' ? 'México' :
        activePromptTab === 'es-CO' ? 'Colômbia' :
        activePromptTab === 'es-AR' ? 'Argentina' :
        activePromptTab === 'en' ? 'Estados Unidos' :
        activePromptTab === 'other-country' ? selectedExtraCountry :
        'Brasil'
      );

      let promptToSend = currentPrompt;
      if (currentPrompt) {
        const previewRes = await fetch('/api/ai/prompts/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country: targetCtry,
            language: targetCtry === 'Brasil' ? 'pt' : (targetCtry === 'Estados Unidos' ? 'en' : 'es'),
            customTemplate: currentPrompt
          })
        });
        const previewJson = await previewRes.json();
        if (previewJson.finalPrompt) {
          promptToSend = previewJson.finalPrompt;
        }
      }

      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          model: formData.primaryModel || 'gemini-3.8-flash',
          apiKey: formData.primaryApiKey,
          customSystemPrompt: promptToSend,
          testMessage: testLeadMessage,
          country: targetCtry,
          language: targetCtry === 'Brasil' ? 'pt' : (targetCtry === 'Estados Unidos' ? 'en' : 'es')
        })
      });
      const data = await res.json();
      setTestPromptReply(data);
    } catch (err) {
      setTestPromptReply({ success: false, error: err.message });
    } finally {
      setTestingCustomPrompt(false);
    }
  };

  // Dynamic models state
  const defaultGoogleModels = [
    { id: 'gemini-3.8-flash', name: 'gemini-3.8-flash (Google Gemini 3.8 Flash - Boss das Vendas 🏆)' },
    { id: 'gemini-3.7-flash', name: 'gemini-3.7-flash (Google Gemini 3.7 Flash - Resposta Instantânea ⚡)' },
    { id: 'gemini-3.5-flash', name: 'gemini-3.5-flash (Google Gemini 3.5 Flash)' },
    { id: 'gemini-flash-latest', name: 'gemini-flash-latest (Google Gemini Flash Latest)' },
    { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash (Google Gemini 2.5 Flash)' },
    { id: 'gemini-2.5-pro', name: 'gemini-2.5-pro (Google Gemini 2.5 Pro - Contexto Longo)' }
  ];

  const defaultNimModels = [
    { id: 'z-ai/glm-5.3-flash', name: 'z-ai/glm-5.3-flash (NVIDIA NIM - Rápido & Conversacional ⚡)', org: 'z-ai' },
    { id: 'z-ai/glm-5.3', name: 'z-ai/glm-5.3 (NVIDIA NIM - 128k Raciocínio Avançado)', org: 'z-ai' },
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'nvidia/llama-3.1-nemotron-70b-instruct', org: 'nvidia' },
    { id: 'meta/llama-3.2-11b-vision-instruct', name: 'meta/llama-3.2-11b-vision-instruct', org: 'meta' },
    { id: 'google/diffusiongemma-26b-a4b-it', name: 'google/diffusiongemma-26b-a4b-it', org: 'google' }
  ];

  const defaultOpenRouterModels = [
    { id: 'nvidia/nemotron-3.5-lightning:free', name: 'NVIDIA: Nemotron 3.5 Lightning (free)', isFree: true },
    { id: 'google/gemma-4-31b-it:free', name: 'Google: Gemma 4 31B (free)', isFree: true },
    { id: 'qwen/qwen3.8-27b:free', name: 'Qwen: Qwen3.8 27B (free)', isFree: true },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Meta Llama 3.3 70B Instruct (free)', isFree: true }
  ];

  const [googleModels, setGoogleModels] = useState(defaultGoogleModels);
  const [nimModels, setNimModels] = useState(defaultNimModels);
  const [openRouterModels, setOpenRouterModels] = useState(defaultOpenRouterModels);

  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingNim, setLoadingNim] = useState(false);
  const [loadingOpenRouter, setLoadingOpenRouter] = useState(false);

  const [googleError, setGoogleError] = useState(null);
  const [nimError, setNimError] = useState(null);
  const [openRouterError, setOpenRouterError] = useState(null);

  // Live Connection Test States
  const [testingPrimary, setTestingPrimary] = useState(false);
  const [primaryTestResult, setPrimaryTestResult] = useState(null);
  const [testingFallback, setTestingFallback] = useState(false);
  const [fallbackTestResult, setFallbackTestResult] = useState(null);
  const [testingTertiary, setTestingTertiary] = useState(false);
  const [tertiaryTestResult, setTertiaryTestResult] = useState(null);

  // Search and manual toggles
  const [primarySearch, setPrimarySearch] = useState('');
  const [primaryManualMode, setPrimaryManualMode] = useState(false);

  const [fallbackSearch, setFallbackSearch] = useState('');
  const [fallbackManualMode, setFallbackManualMode] = useState(false);

  const [tertiarySearch, setTertiarySearch] = useState('');
  const [tertiaryOnlyFree, setTertiaryOnlyFree] = useState(true);
  const [tertiaryManualMode, setTertiaryManualMode] = useState(false);

  // Fetch Google Gemini models
  const fetchGoogleModels = async (keyOverride = null) => {
    setLoadingGoogle(true);
    setGoogleError(null);
    try {
      const key = (keyOverride || formData.primaryApiKey || '').trim();
      const url = key ? `/api/ai/models/google?apiKey=${encodeURIComponent(key)}` : '/api/ai/models/google';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao carregar modelos do Google');
      }
      if (data.models && data.models.length > 0) {
        setGoogleModels(data.models);
      }
    } catch (err) {
      console.warn('Erro ao buscar modelos Google:', err.message);
      setGoogleError(err.message);
    } finally {
      setLoadingGoogle(false);
    }
  };

  // Fetch NVIDIA NIM models from backend
  const fetchNimModels = async (keyOverride = null) => {
    setLoadingNim(true);
    setNimError(null);
    try {
      const key = (keyOverride || formData.fallbackApiKey || '').trim();
      const url = key ? `/api/ai/models/nim?apiKey=${encodeURIComponent(key)}` : '/api/ai/models/nim';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao carregar modelos da NVIDIA NIM');
      }
      if (data.models && data.models.length > 0) {
        setNimModels(data.models);
      }
    } catch (err) {
      console.warn('Erro ao buscar modelos NIM:', err.message);
      setNimError(err.message);
    } finally {
      setLoadingNim(false);
    }
  };

  // Fetch OpenRouter models from backend
  const fetchOpenRouterModels = async (keyOverride = null) => {
    setLoadingOpenRouter(true);
    setOpenRouterError(null);
    try {
      const key = (keyOverride || formData.tertiaryApiKey || '').trim();
      const url = key ? `/api/ai/models/openrouter?apiKey=${encodeURIComponent(key)}` : '/api/ai/models/openrouter';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao carregar modelos do OpenRouter');
      }
      if (data.models && data.models.length > 0) {
        setOpenRouterModels(data.models);
      }
    } catch (err) {
      console.warn('Erro ao buscar modelos OpenRouter:', err.message);
      setOpenRouterError(err.message);
    } finally {
      setLoadingOpenRouter(false);
    }
  };

  // Live Test Trigger
  const handleTestAi = async (provider, model, apiKey, setResult, setLoading) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, apiKey })
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Sync on mount
  useEffect(() => {
    fetchGoogleModels();
    fetchNimModels();
    fetchOpenRouterModels();
  }, []);

  const handleSyncAll = () => {
    fetchGoogleModels();
    fetchNimModels();
    fetchOpenRouterModels();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ai: formData });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Filtered lists
  const filteredPrimaryGoogle = googleModels.filter((m) => {
    if (!primarySearch.trim()) return true;
    const q = primarySearch.toLowerCase();
    return (m.id || '').toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q);
  });

  const filteredFallbackNim = nimModels.filter((m) => {
    if (!fallbackSearch.trim()) return true;
    const q = fallbackSearch.toLowerCase();
    return (m.id || '').toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q);
  });

  const filteredOpenRouter = openRouterModels.filter((m) => {
    if (tertiaryOnlyFree && !m.isFree) return false;
    if (!tertiarySearch.trim()) return true;
    const q = tertiarySearch.toLowerCase();
    return (m.id || '').toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q);
  });

  const freeCount = openRouterModels.filter((m) => m.isFree).length;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="glass-card" style={{ padding: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
          <div className="flex items-center gap-3">
            <div style={{ padding: '10px', background: 'rgba(139, 92, 246, 0.15)', borderRadius: '10px', color: '#c084fc' }}>
              <Cpu size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                Cérebro de IA: Google Gemini 3.8 + NVIDIA NIM + OpenRouter
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Modelo 1 Direto do Google AI Studio (Boss das Vendas), com contingência automática da NVIDIA NIM e OpenRouter.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={loadingGoogle || loadingNim || loadingOpenRouter}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 14px' }}
              title="Buscar lista atualizada de modelos diretamente das APIs da Google, NVIDIA e OpenRouter"
            >
              <RefreshCw size={15} className={loadingGoogle || loadingNim || loadingOpenRouter ? 'animate-spin' : ''} />
              <span>{loadingGoogle || loadingNim || loadingOpenRouter ? 'Puxando Modelos...' : 'Sincronizar APIs'}</span>
            </button>

            <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {savedSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
              <span>{savedSuccess ? 'Salvo!' : 'Salvar Modelos'}</span>
            </button>
          </div>
        </div>

        {/* Status Callout */}
        <div style={{
          padding: '14px 18px',
          borderRadius: '12px',
          background: aiSettings?.isFallbackActive ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.1)',
          border: aiSettings?.isFallbackActive ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {aiSettings?.isFallbackActive ? (
              <AlertTriangle size={20} color="#fbbf24" />
            ) : (
              <ShieldCheck size={20} color="#34d399" />
            )}
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: aiSettings?.isFallbackActive ? '#fbbf24' : '#34d399' }}>
                {aiSettings?.isFallbackActive
                  ? 'Fallback Acionado: Operando em Modo Contingência'
                  : 'Sistema Estável: Operando com Modelo Primário'}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                {aiSettings?.isFallbackActive
                  ? `Motivo: ${aiSettings.lastFallbackReason || 'Limite de tempo ou instabilidade na rota primária'}`
                  : 'Cascata de segurança ativa: se o Primário demorar mais de 3 min, o Secundário assume; se ambos falharem, o 3º Fallback OpenRouter atende.'}
              </p>
            </div>
          </div>

          {aiSettings?.isFallbackActive && (
            <button
              type="button"
              onClick={() => onSave({ ai: { isFallbackActive: false } })}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '6px 12px' }}
            >
              Resetar para Primário
            </button>
          )}
        </div>

        {/* 3-Column Cascade Grid: Primary, Fallback 2, Fallback 3 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          
          {/* 1. Primary Model Card - Google Gemini Direto */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid rgba(139, 92, 246, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} color="#c084fc" />
                <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#f8fafc' }}>
                  1. Primário (Google Gemini Direto 🏆)
                </h4>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="badge badge-conversa">Google AI Studio</span>
                <button
                  type="button"
                  onClick={() => fetchGoogleModels(formData.primaryApiKey)}
                  disabled={loadingGoogle}
                  title="Atualizar modelos do Google Gemini"
                  style={{ background: 'none', border: 'none', color: '#c084fc', cursor: 'pointer', padding: '2px' }}
                >
                  <RefreshCw size={14} className={loadingGoogle ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>
                  Modelo Primário de Vendas ({googleModels.length} no Google)
                </label>
                <button
                  type="button"
                  onClick={() => setPrimaryManualMode(!primaryManualMode)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {primaryManualMode ? <List size={12} /> : <Edit3 size={12} />}
                  <span>{primaryManualMode ? 'Lista Google' : 'Digitar ID'}</span>
                </button>
              </div>

              {primaryManualMode ? (
                <input
                  type="text"
                  value={formData.primaryModel}
                  onChange={(e) => setFormData({ ...formData, primaryModel: e.target.value })}
                  placeholder="Ex: gemini-3.8-flash"
                  className="input-field"
                  style={{ fontSize: '0.84rem' }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
                    <input
                      type="text"
                      value={primarySearch}
                      onChange={(e) => setPrimarySearch(e.target.value)}
                      placeholder="Filtrar Gemini (ex: 3.8, 2.5, flash)..."
                      className="input-field"
                      style={{ paddingLeft: '32px', fontSize: '0.78rem', height: '34px', background: 'rgba(0,0,0,0.2)' }}
                    />
                  </div>

                  <select
                    value={formData.primaryModel}
                    onChange={(e) => setFormData({ ...formData, primaryModel: e.target.value })}
                    className="input-field"
                    style={{ fontSize: '0.84rem' }}
                  >
                    {!googleModels.some((m) => m.id === formData.primaryModel) && (
                      <option value={formData.primaryModel}>
                        📌 {formData.primaryModel} (Atual)
                      </option>
                    )}
                    {filteredPrimaryGoogle.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {googleError && (
                <p style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '4px' }}>
                  ⚠️ {googleError}
                </p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Google AI Studio API Key (Chave Direta)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPrimaryKey ? 'text' : 'password'}
                  value={formData.primaryApiKey}
                  onChange={(e) => setFormData({ ...formData, primaryApiKey: e.target.value })}
                  placeholder="AIzaSy... (Chave Google AI Studio)"
                  className="input-field"
                  style={{ paddingRight: '40px', fontSize: '0.84rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPrimaryKey(!showPrimaryKey)}
                  style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                >
                  {showPrimaryKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                Obtenha gratuitamente em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: '#c084fc' }}>aistudio.google.com/apikey</a> (100% Direto Google, sem intermediários).
              </p>
            </div>

            {/* Test Button Card 1 */}
            <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
              <button
                type="button"
                onClick={() => handleTestAi('google', formData.primaryModel, formData.primaryApiKey, setPrimaryTestResult, setTestingPrimary)}
                disabled={testingPrimary}
                className="btn-secondary"
                style={{
                  width: '100%',
                  fontSize: '0.78rem',
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  borderColor: 'rgba(139, 92, 246, 0.4)'
                }}
              >
                <Zap size={13} className={testingPrimary ? 'animate-spin' : ''} />
                <span>{testingPrimary ? 'Testando Conexão...' : '⚡ Testar Google Gemini'}</span>
              </button>

              {primaryTestResult && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  background: primaryTestResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${primaryTestResult.success ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                  color: primaryTestResult.success ? '#34d399' : '#f87171',
                  wordBreak: 'break-word'
                }}>
                  {primaryTestResult.success ? (
                    <div>
                      <strong>✓ OK ({primaryTestResult.latencyMs}ms):</strong> {primaryTestResult.reply}
                    </div>
                  ) : (
                    <div>
                      <strong>❌ Erro ({primaryTestResult.status || 'Falha'}):</strong> {primaryTestResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. Secondary / Fallback Model Card - NVIDIA NIM */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#fbbf24" />
                <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#f8fafc' }}>
                  2. Fallback 2 (NVIDIA NIM)
                </h4>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="badge badge-pitch">Contingência 1</span>
                <button
                  type="button"
                  onClick={() => fetchNimModels(formData.fallbackApiKey)}
                  disabled={loadingNim}
                  title="Atualizar modelos da NVIDIA NIM"
                  style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', padding: '2px' }}
                >
                  <RefreshCw size={14} className={loadingNim ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>
                  Modelo Fallback 2 ({nimModels.length} na API)
                </label>
                <button
                  type="button"
                  onClick={() => setFallbackManualMode(!fallbackManualMode)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {fallbackManualMode ? <List size={12} /> : <Edit3 size={12} />}
                  <span>{fallbackManualMode ? 'Lista da API' : 'Digitar ID'}</span>
                </button>
              </div>

              {fallbackManualMode ? (
                <input
                  type="text"
                  value={formData.fallbackModel}
                  onChange={(e) => setFormData({ ...formData, fallbackModel: e.target.value })}
                  placeholder="Ex: z-ai/glm-5.3-flash"
                  className="input-field"
                  style={{ fontSize: '0.84rem' }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
                    <input
                      type="text"
                      value={fallbackSearch}
                      onChange={(e) => setFallbackSearch(e.target.value)}
                      placeholder="Filtrar (ex: glm, llama, mistral)..."
                      className="input-field"
                      style={{ paddingLeft: '32px', fontSize: '0.78rem', height: '34px', background: 'rgba(0,0,0,0.2)' }}
                    />
                  </div>

                  <select
                    value={formData.fallbackModel}
                    onChange={(e) => setFormData({ ...formData, fallbackModel: e.target.value })}
                    className="input-field"
                    style={{ fontSize: '0.84rem' }}
                  >
                    {!nimModels.some((m) => m.id === formData.fallbackModel) && (
                      <option value={formData.fallbackModel}>
                        📌 {formData.fallbackModel} (Atual)
                      </option>
                    )}
                    {filteredFallbackNim.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {nimError && (
                <p style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '4px' }}>
                  ⚠️ {nimError}
                </p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                NVIDIA NIM API Key (2ª Chave)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showFallbackKey ? 'text' : 'password'}
                  value={formData.fallbackApiKey}
                  onChange={(e) => setFormData({ ...formData, fallbackApiKey: e.target.value })}
                  placeholder="nvapi-yyyyyyyyyyyyyyyyyyyyyyyy"
                  className="input-field"
                  style={{ paddingRight: '40px', fontSize: '0.84rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowFallbackKey(!showFallbackKey)}
                  style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                >
                  {showFallbackKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                Chave nvapi-... obtida em <a href="https://build.nvidia.com" target="_blank" rel="noreferrer" style={{ color: '#fbbf24' }}>build.nvidia.com</a>.
              </p>
            </div>

            {/* Test Button Card 2 */}
            <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
              <button
                type="button"
                onClick={() => handleTestAi('nim', formData.fallbackModel, formData.fallbackApiKey, setFallbackTestResult, setTestingFallback)}
                disabled={testingFallback}
                className="btn-secondary"
                style={{
                  width: '100%',
                  fontSize: '0.78rem',
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  borderColor: 'rgba(245, 158, 11, 0.4)'
                }}
              >
                <Zap size={13} className={testingFallback ? 'animate-spin' : ''} />
                <span>{testingFallback ? 'Testando Conexão...' : '⚡ Testar NVIDIA NIM'}</span>
              </button>

              {fallbackTestResult && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  background: fallbackTestResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${fallbackTestResult.success ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                  color: fallbackTestResult.success ? '#34d399' : '#f87171',
                  wordBreak: 'break-word'
                }}>
                  {fallbackTestResult.success ? (
                    <div>
                      <strong>✓ OK ({fallbackTestResult.latencyMs}ms):</strong> {fallbackTestResult.reply}
                    </div>
                  ) : (
                    <div>
                      <strong>❌ Erro ({fallbackTestResult.status || 'Falha'}):</strong> {fallbackTestResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3. Tertiary / OpenRouter Fallback Model Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={18} color="#34d399" />
                <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#f8fafc' }}>
                  3. Fallback 3 (OpenRouter)
                </h4>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="badge badge-meta">Contingência 2</span>
                <button
                  type="button"
                  onClick={() => fetchOpenRouterModels(formData.tertiaryApiKey)}
                  disabled={loadingOpenRouter}
                  title="Atualizar modelos do OpenRouter"
                  style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', padding: '2px' }}
                >
                  <RefreshCw size={14} className={loadingOpenRouter ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>
                  Modelo OpenRouter ({openRouterModels.length} disponíveis)
                </label>
                <button
                  type="button"
                  onClick={() => setTertiaryManualMode(!tertiaryManualMode)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {tertiaryManualMode ? <List size={12} /> : <Edit3 size={12} />}
                  <span>{tertiaryManualMode ? 'Lista da API' : 'Digitar ID'}</span>
                </button>
              </div>

              {tertiaryManualMode ? (
                <input
                  type="text"
                  value={formData.tertiaryModel}
                  onChange={(e) => setFormData({ ...formData, tertiaryModel: e.target.value })}
                  placeholder="Ex: nvidia/nemotron-3.5-lightning:free"
                  className="input-field"
                  style={{ fontSize: '0.84rem' }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
                      <input
                        type="text"
                        value={tertiarySearch}
                        onChange={(e) => setTertiarySearch(e.target.value)}
                        placeholder="Filtrar (ex: nemotron, llama, gemma)..."
                        className="input-field"
                        style={{ paddingLeft: '32px', fontSize: '0.78rem', height: '34px', background: 'rgba(0,0,0,0.2)' }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setTertiaryOnlyFree(!tertiaryOnlyFree)}
                      style={{
                        padding: '0 10px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: tertiaryOnlyFree ? '#10b981' : 'rgba(255,255,255,0.15)',
                        background: tertiaryOnlyFree ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0,0,0,0.2)',
                        color: tertiaryOnlyFree ? '#34d399' : '#94a3b8',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                      title="Alternar entre ver apenas modelos 100% gratuitos ou todos os 460+ modelos do OpenRouter"
                    >
                      {tertiaryOnlyFree ? `✓ Gratuitos (${freeCount})` : 'Todos (460+)'}
                    </button>
                  </div>

                  <select
                    value={formData.tertiaryModel}
                    onChange={(e) => setFormData({ ...formData, tertiaryModel: e.target.value })}
                    className="input-field"
                    style={{ fontSize: '0.84rem' }}
                  >
                    {!openRouterModels.some((m) => m.id === formData.tertiaryModel) && (
                      <option value={formData.tertiaryModel}>
                        📌 {formData.tertiaryModel} (Atual)
                      </option>
                    )}
                    {filteredOpenRouter.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.isFree ? '🎁 [Gratuito] ' : ''}{m.name || m.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {openRouterError && (
                <p style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '4px' }}>
                  ⚠️ {openRouterError}
                </p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                OpenRouter API Key (Terciária)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showTertiaryKey ? 'text' : 'password'}
                  value={formData.tertiaryApiKey}
                  onChange={(e) => setFormData({ ...formData, tertiaryApiKey: e.target.value })}
                  placeholder="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="input-field"
                  style={{ paddingRight: '40px', fontSize: '0.84rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowTertiaryKey(!showTertiaryKey)}
                  style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                >
                  {showTertiaryKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                Obtenha em <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ color: '#34d399' }}>openrouter.ai/keys</a> (com modelos 100% gratuitos)
              </p>
            </div>

            {/* Test Button Card 3 */}
            <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
              <button
                type="button"
                onClick={() => handleTestAi('openrouter', formData.tertiaryModel, formData.tertiaryApiKey, setTertiaryTestResult, setTestingTertiary)}
                disabled={testingTertiary}
                className="btn-secondary"
                style={{
                  width: '100%',
                  fontSize: '0.78rem',
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  borderColor: 'rgba(16, 185, 129, 0.4)'
                }}
              >
                <Zap size={13} className={testingTertiary ? 'animate-spin' : ''} />
                <span>{testingTertiary ? 'Testando Conexão...' : '⚡ Testar OpenRouter'}</span>
              </button>

              {tertiaryTestResult && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  background: tertiaryTestResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${tertiaryTestResult.success ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                  color: tertiaryTestResult.success ? '#34d399' : '#f87171',
                  wordBreak: 'break-word'
                }}>
                  {tertiaryTestResult.success ? (
                    <div>
                      <strong>✓ OK ({tertiaryTestResult.latencyMs}ms):</strong> {tertiaryTestResult.reply}
                    </div>
                  ) : (
                    <div>
                      <strong>❌ Erro ({tertiaryTestResult.status || 'Falha'}):</strong> {tertiaryTestResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hyperparameters: Temperature & Max Tokens */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1' }}>
                Temperatura / Criatividade Persuasiva: {formData.temperature}
              </label>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {formData.temperature < 0.5 ? 'Objetivo' : formData.temperature > 0.8 ? 'Criativo' : 'Equilibrado'}
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Tamanho Máximo da Resposta (Tokens): {formData.maxTokens}
            </label>
            <input
              type="number"
              min="100"
              max="1500"
              step="50"
              value={formData.maxTokens}
              onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
              className="input-field"
            />
          </div>
        </div>

        {/* === CONTROLE TOTAL DO SYSTEM PROMPT & COMPORTAMENTOS === */}
        <div style={{
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          {/* Section Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981'
              }}>
                <Terminal size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Controle Total do System Prompt & Comportamentos dos Modelos
                  <span style={{
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: formData.systemPrompts?.mode === 'custom' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                    color: formData.systemPrompts?.mode === 'custom' ? '#38bdf8' : '#34d399',
                    border: `1px solid ${formData.systemPrompts?.mode === 'custom' ? 'rgba(56, 189, 248, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`
                  }}>
                    {formData.systemPrompts?.mode === 'custom' ? 'MODO CUSTOMIZADO ATIVO' : 'MOTOR INTELIGENTE BOSS ATIVO'}
                  </span>
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '2px 0 0' }}>
                  Controle exatamente o que é enviado para o Google Gemini e NVIDIA NIM, com suporte para múltiplas línguas, ofertas regionais e variáveis dinâmicas.
                </p>
              </div>
            </div>
          </div>

          {/* Mode Switcher Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '12px',
            marginBottom: '20px'
          }}>
            {/* Card 1: Smart Engine */}
            <div
              onClick={() => setFormData((prev) => ({
                ...prev,
                systemPrompts: { ...prev.systemPrompts, mode: 'smart_engine' }
              }))}
              style={{
                padding: '14px 16px',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: formData.systemPrompts?.mode === 'smart_engine' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(15, 23, 42, 0.6)',
                border: formData.systemPrompts?.mode === 'smart_engine' ? '1.5px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: formData.systemPrompts?.mode === 'smart_engine' ? '0 0 20px rgba(16, 185, 129, 0.15)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} color={formData.systemPrompts?.mode === 'smart_engine' ? '#10b981' : '#64748b'} />
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: formData.systemPrompts?.mode === 'smart_engine' ? '#34d399' : '#e2e8f0' }}>
                    Modo Inteligente Automático (Motor Boss)
                  </span>
                </div>
                <input
                  type="radio"
                  checked={formData.systemPrompts?.mode === 'smart_engine'}
                  onChange={() => {}}
                  style={{ accentColor: '#10b981' }}
                />
              </div>
              <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                O motor nativo do Zapix gera automaticamente os prompts otimizados de alta persuasão, adaptando moedas, tickets e regras por país do lead.
              </p>
            </div>

            {/* Card 2: Custom Control */}
            <div
              onClick={() => setFormData((prev) => ({
                ...prev,
                systemPrompts: { ...prev.systemPrompts, mode: 'custom' }
              }))}
              style={{
                padding: '14px 16px',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: formData.systemPrompts?.mode === 'custom' ? 'rgba(56, 189, 248, 0.1)' : 'rgba(15, 23, 42, 0.6)',
                border: formData.systemPrompts?.mode === 'custom' ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: formData.systemPrompts?.mode === 'custom' ? '0 0 20px rgba(56, 189, 248, 0.15)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Code size={16} color={formData.systemPrompts?.mode === 'custom' ? '#38bdf8' : '#64748b'} />
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: formData.systemPrompts?.mode === 'custom' ? '#38bdf8' : '#e2e8f0' }}>
                    Modo Controle Total (Customizado) 🚀
                  </span>
                </div>
                <input
                  type="radio"
                  checked={formData.systemPrompts?.mode === 'custom'}
                  onChange={() => {}}
                  style={{ accentColor: '#38bdf8' }}
                />
              </div>
              <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                O modelo recebe <strong>EXATAMENTE</strong> o System Prompt definido por você nas abas abaixo, com total liberdade sobre a persona e estratégia.
              </p>
            </div>
          </div>

          {/* Language / Country Selector Tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
            marginBottom: '14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '10px'
          }}>
            {[
              { id: 'pt', label: 'Brasil (Português)', flag: '🇧🇷' },
              { id: 'es-MX', label: 'México (ES)', flag: '🇲🇽' },
              { id: 'es-CO', label: 'Colômbia (ES)', flag: '🇨🇴' },
              { id: 'es-AR', label: 'Argentina (ES)', flag: '🇦🇷' },
              { id: 'es', label: 'LatAm Geral (ES Neutro)', flag: '🌎' },
              { id: 'en', label: 'Global (Inglês)', flag: '🇺🇸' },
              { id: 'other-country', label: 'Mais Países...', flag: '🌐' }
            ].map((tab) => {
              const isActive = activePromptTab === tab.id;
              // Check if has custom content
              let hasContent = false;
              const sp = formData.systemPrompts || {};
              if (tab.id === 'pt') hasContent = Boolean(sp.pt?.trim());
              else if (tab.id === 'es') hasContent = Boolean(sp.es?.trim());
              else if (tab.id === 'en') hasContent = Boolean(sp.en?.trim());
              else if (tab.id === 'es-MX') hasContent = Boolean(sp.countries?.['México']?.trim());
              else if (tab.id === 'es-CO') hasContent = Boolean(sp.countries?.['Colômbia']?.trim());
              else if (tab.id === 'es-AR') hasContent = Boolean(sp.countries?.['Argentina']?.trim());
              else if (tab.id === 'other-country') hasContent = Boolean(sp.countries?.[selectedExtraCountry]?.trim());

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivePromptTab(tab.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: isActive ? 600 : 500,
                    background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${isActive ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                    color: isActive ? '#38bdf8' : '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s'
                  }}
                >
                  <span>{tab.flag}</span>
                  <span>{tab.label}</span>
                  {hasContent && (
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#10b981',
                      display: 'inline-block'
                    }} />
                  )}
                </button>
              );
            })}

            {/* Extra country selector if activePromptTab is 'other-country' */}
            {activePromptTab === 'other-country' && (
              <select
                value={selectedExtraCountry}
                onChange={(e) => setSelectedExtraCountry(e.target.value)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  background: '#0f172a',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#e2e8f0',
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                <option value="Bolívia">🇧🇴 Bolívia</option>
                <option value="Paraguai">🇵🇾 Paraguai</option>
                <option value="Peru">🇵🇪 Peru</option>
                <option value="Chile">🇨🇱 Chile</option>
                <option value="Estados Unidos">🇺🇸 Estados Unidos</option>
              </select>
            )}
          </div>

          {/* Prompt Editor Card Container */}
          <div style={{
            background: 'rgba(10, 15, 29, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            {/* Editor Action Toolbar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              marginBottom: '12px',
              paddingBottom: '10px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Load Boss Template */}
                <button
                  type="button"
                  onClick={handleLoadBossTemplate}
                  className="btn-secondary"
                  style={{
                    fontSize: '0.75rem',
                    padding: '5px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderColor: 'rgba(16, 185, 129, 0.4)',
                    color: '#34d399'
                  }}
                  title="Carregar roteiro mestre de vendas otimizado para esta língua"
                >
                  <Sparkles size={13} />
                  <span>📥 Carregar Template Boss das Vendas 🏆</span>
                </button>

                {/* Preview Compiled Prompt */}
                <button
                  type="button"
                  onClick={() => handleOpenPreview()}
                  className="btn-secondary"
                  style={{
                    fontSize: '0.75rem',
                    padding: '5px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderColor: 'rgba(56, 189, 248, 0.4)',
                    color: '#38bdf8'
                  }}
                  title="Ver o prompt final completo com todas as variáveis preenchidas"
                >
                  <Eye size={13} />
                  <span>👁️ Pré-visualizar Prompt Final</span>
                </button>

                {/* Live Test Drawer Toggle */}
                <button
                  type="button"
                  onClick={() => setTestPlaygroundOpen(!testPlaygroundOpen)}
                  className="btn-secondary"
                  style={{
                    fontSize: '0.75rem',
                    padding: '5px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderColor: testPlaygroundOpen ? '#10b981' : 'rgba(245, 158, 11, 0.4)',
                    color: testPlaygroundOpen ? '#34d399' : '#fbbf24',
                    background: testPlaygroundOpen ? 'rgba(16, 185, 129, 0.15)' : 'transparent'
                  }}
                  title="Testar a resposta da IA ao vivo com este prompt"
                >
                  <Zap size={13} />
                  <span>{testPlaygroundOpen ? 'Fechar Teste ao Vivo' : '⚡ Testar Prompt com IA ao Vivo'}</span>
                </button>

                {/* Clear */}
                {getCurrentPromptText() && (
                  <button
                    type="button"
                    onClick={() => handleUpdateCurrentPromptText('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      padding: '4px 6px'
                    }}
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Word & Token Counters */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.74rem', color: '#64748b' }}>
                <span>Palavras: <strong style={{ color: '#cbd5e1' }}>{getCurrentPromptText().trim() ? getCurrentPromptText().trim().split(/\s+/).length : 0}</strong></span>
                <span>Caracteres: <strong style={{ color: '#cbd5e1' }}>{getCurrentPromptText().length}</strong></span>
                <span>Tokens est.: <strong style={{ color: '#38bdf8' }}>~{Math.ceil(getCurrentPromptText().length / 4)}</strong></span>
              </div>
            </div>

            {/* Quick-Insert Dynamic Variables (Clickable Chips) */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8' }}>
                  Variáveis Dinâmicas (clique para inserir no prompt onde estiver o cursor):
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  { tag: '{{NOME_PRODUTO}}', label: 'Nome Produto', color: '#10b981' },
                  { tag: '{{VALOR_BASICO}}', label: 'Preço Básico', color: '#10b981' },
                  { tag: '{{VALOR_COMPLETO}}', label: 'Preço Completo', color: '#10b981' },
                  { tag: '{{MOEDA}}', label: 'Moeda', color: '#38bdf8' },
                  { tag: '{{PAIS}}', label: 'País', color: '#38bdf8' },
                  { tag: '{{METODO_PAGAMENTO}}', label: 'Método Pagamento', color: '#a855f7' },
                  { tag: '{{PAGAMENTO_INFO}}', label: 'Dados de Pagamento', color: '#a855f7' },
                  { tag: '{{ENTREGAVEIS}}', label: 'Entregáveis (PDF/Foto)', color: '#ec4899' },
                  { tag: '{{TAGS_ARQUIVOS}}', label: 'Tags de Arquivos', color: '#ec4899' },
                  { tag: '{{DIRETRIZ_AUDIO}}', label: 'Diretriz de Áudio', color: '#f59e0b' },
                  { tag: '{{DIRETRIZ_ENTREGA}}', label: 'Diretriz de Entrega', color: '#f59e0b' },
                  { tag: '{{HISTORICO_MEMORIA}}', label: 'Regras de Memória', color: '#6366f1' },
                  { tag: '{{DIRETRIZ_CONTEXTO}}', label: 'Contexto Atual', color: '#6366f1' },
                  { tag: '{{DORES}}', label: 'Dores', color: '#64748b' },
                  { tag: '{{BENEFICIOS}}', label: 'Benefícios', color: '#64748b' },
                  { tag: '{{OBJECOES}}', label: 'Objeções', color: '#64748b' },
                  { tag: '{{DIAS_GARANTIA}}', label: 'Garantia', color: '#64748b' }
                ].map((v) => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => handleInsertVariable(v.tag)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid rgba(255, 255, 255, 0.08)`,
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontSize: '0.70rem',
                      fontFamily: 'monospace',
                      color: v.color,
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.borderColor = v.color;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    }}
                  >
                    + {v.tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Textarea */}
            <div>
              <textarea
                ref={promptTextareaRef}
                value={getCurrentPromptText()}
                onChange={(e) => handleUpdateCurrentPromptText(e.target.value)}
                placeholder={`Se deixado em branco, o Zapix usará o motor inteligente Boss das Vendas padrão para este país/idioma.\n\nEscreva seu System Prompt completo aqui, ou clique no botão acima "Carregar Template Boss das Vendas 🏆" para iniciar com um roteiro validado pronto para personalizar!`}
                style={{
                  width: '100%',
                  minHeight: '380px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.82rem',
                  lineHeight: '1.5',
                  padding: '14px',
                  background: '#070b14',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Syntax Tips Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              marginTop: '8px',
              fontSize: '0.72rem',
              color: '#64748b'
            }}>
              <div>
                💡 <strong>Dica de Formato:</strong> Use <code style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '1px 5px', borderRadius: '4px' }}>[AUDIO: texto falado]</code> para notas de voz e <code style={{ color: '#ec4899', background: 'rgba(236, 72, 153, 0.1)', padding: '1px 5px', borderRadius: '4px' }}>[ENVIAR_ARQUIVO: TAG]</code> para envio de PDFs/fotos.
              </div>
              <div style={{ color: '#94a3b8' }}>
                Suporta sintaxe dupla <code style={{ color: '#38bdf8' }}>{'{{TAG}}'}</code> ou simples <code style={{ color: '#38bdf8' }}>{'{TAG}'}</code>.
              </div>
            </div>

            {/* Live Testing Playground (Expandable) */}
            {testPlaygroundOpen && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={16} color="#10b981" />
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#34d399' }}>
                      Playground de Teste em Tempo Real com IA
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      (Modelo: {formData.primaryModel})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTestPlaygroundOpen(false)}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Quick lead message presets */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.70rem', color: '#64748b', alignSelf: 'center' }}>Perguntas rápidas:</span>
                  {[
                    'Oi, quanto custa o material?',
                    'Como funciona o método de vocês?',
                    'Tem atividades para 4 anos?',
                    'Como faço para pagar agora?',
                    'Pode me mandar um áudio explicando?'
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTestLeadMessage(preset)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#cbd5e1',
                        fontSize: '0.70rem',
                        cursor: 'pointer'
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {/* Lead message input */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={testLeadMessage}
                    onChange={(e) => setTestLeadMessage(e.target.value)}
                    placeholder="Digite a mensagem que o lead enviaria no WhatsApp..."
                    className="input-field"
                    style={{ flex: 1, fontSize: '0.82rem' }}
                  />
                  <button
                    type="button"
                    onClick={handleTestCustomPrompt}
                    disabled={testingCustomPrompt}
                    className="btn-primary"
                    style={{
                      fontSize: '0.80rem',
                      padding: '8px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Send size={14} className={testingCustomPrompt ? 'animate-spin' : ''} />
                    <span>{testingCustomPrompt ? 'Testando...' : '🚀 Testar Resposta'}</span>
                  </button>
                </div>

                {/* Test Output Box */}
                {testPromptReply && (
                  <div style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: testPromptReply.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${testPromptReply.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    color: testPromptReply.success ? '#e2e8f0' : '#f87171',
                    fontSize: '0.82rem'
                  }}>
                    {testPromptReply.success ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '6px' }}>
                          <span style={{ color: '#34d399', fontWeight: 600, fontSize: '0.74rem' }}>
                            ✓ Resposta Gerada pelo Modelo ({testPromptReply.latencyMs}ms):
                          </span>
                          <span style={{ color: '#64748b', fontSize: '0.70rem' }}>
                            {testPromptReply.modelUsed}
                          </span>
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.45' }}>
                          {testPromptReply.reply || testPromptReply.response}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <strong>❌ Erro ao testar prompt:</strong> {testPromptReply.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Custom Instructions Booster (Global) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
            Instruções Customizadas Globais Adicionais (System Prompt Booster)
          </label>
          <textarea
            value={formData.customPromptInstructions}
            onChange={(e) => setFormData({ ...formData, customPromptInstructions: e.target.value })}
            className="input-field"
            rows={3}
            placeholder="Ex: Trate o cliente sempre pelo primeiro nome. Nunca mencione termos concorrentes. Se perguntar sobre suporte, diga que respondemos em menos de 15 minutos..."
          />
        </div>

        {/* Live Preview Modal */}
        {previewModalOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: '#0a0f1d',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '14px',
              maxWidth: '920px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Eye size={18} color="#38bdf8" />
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#f8fafc' }}>
                    Pré-visualização do System Prompt Final (O que é enviado ao Modelo)
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Country Selector in Preview */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Simular País:</span>
                    <select
                      value={previewCountry}
                      onChange={(e) => handleOpenPreview(e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: '#0f172a',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#e2e8f0',
                        fontSize: '0.74rem',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="Brasil">🇧🇷 Brasil (BRL / R$)</option>
                      <option value="México">🇲🇽 México (MXN / $)</option>
                      <option value="Colômbia">🇨🇴 Colômbia (COP / $)</option>
                      <option value="Argentina">🇦🇷 Argentina (ARS / $)</option>
                      <option value="Bolívia">🇧🇴 Bolívia (BOB / Bs)</option>
                      <option value="Paraguai">🇵🇾 Paraguai (PYG / Gs)</option>
                      <option value="Estados Unidos">🇺🇸 Estados Unidos (USD / $)</option>
                    </select>
                  </div>

                  {/* Copy Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (previewData?.finalPrompt) {
                        navigator.clipboard.writeText(previewData.finalPrompt);
                        setCopiedPreview(true);
                        setTimeout(() => setCopiedPreview(false), 2000);
                      }
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: copiedPreview ? '#34d399' : '#cbd5e1',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {copiedPreview ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedPreview ? 'Copiado!' : 'Copiar'}</span>
                  </button>

                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={() => setPreviewModalOpen(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                {previewLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
                    <p style={{ margin: 0, fontSize: '0.84rem' }}>Renderizando e interpolando variáveis do prompt...</p>
                  </div>
                ) : previewData ? (
                  <div>
                    {/* Prompt Stats Bar */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      marginBottom: '14px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      fontSize: '0.75rem',
                      color: '#94a3b8'
                    }}>
                      <span>País Simulado: <strong style={{ color: '#38bdf8' }}>{previewData.country}</strong></span>
                      <span>Idioma: <strong style={{ color: '#38bdf8' }}>{previewData.language}</strong></span>
                      <span>Palavras: <strong style={{ color: '#cbd5e1' }}>{previewData.wordCount}</strong></span>
                      <span>Caracteres: <strong style={{ color: '#cbd5e1' }}>{previewData.charCount}</strong></span>
                      <span>Tokens Estimados: <strong style={{ color: '#10b981' }}>~{previewData.estimatedTokens}</strong></span>
                    </div>

                    {/* Compiled Prompt Code Viewer */}
                    <div style={{
                      background: '#040711',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '14px',
                      maxHeight: '400px',
                      overflowY: 'auto',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: '0.80rem',
                      lineHeight: '1.5',
                      color: '#e2e8f0',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {previewData.finalPrompt}
                    </div>

                    {/* Resolved Variables Table */}
                    {previewData.variables && (
                      <div style={{ marginTop: '16px' }}>
                        <h4 style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Variáveis Resolvidas Nesta Oferta:
                        </h4>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                          gap: '6px',
                          maxHeight: '160px',
                          overflowY: 'auto'
                        }}>
                          {Object.entries(previewData.variables).map(([k, v]) => (
                            <div
                              key={k}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                fontSize: '0.72rem'
                              }}
                            >
                              <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{`{{${k}}}`}: </span>
                              <span style={{ color: '#cbd5e1' }}>{String(v).slice(0, 50)}{String(v).length > 50 ? '...' : ''}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    Nenhum dado de pré-visualização disponível.
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '12px 20px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'flex-end'
              }}>
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="btn-secondary"
                  style={{ fontSize: '0.80rem', padding: '6px 16px' }}
                >
                  Fechar Visualização
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
