import React, { useState, useEffect } from 'react';
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
  List
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
    customPromptInstructions: aiSettings?.customPromptInstructions || ''
  });

  const [showPrimaryKey, setShowPrimaryKey] = useState(false);
  const [showFallbackKey, setShowFallbackKey] = useState(false);
  const [showTertiaryKey, setShowTertiaryKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

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

        {/* Custom Instructions */}
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
            Instruções Customizadas Adicionais (System Prompt Booster)
          </label>
          <textarea
            value={formData.customPromptInstructions}
            onChange={(e) => setFormData({ ...formData, customPromptInstructions: e.target.value })}
            className="input-field"
            rows={4}
            placeholder="Ex: Trate o cliente sempre pelo primeiro nome. Nunca mencione termos concorrentes. Se perguntar sobre suporte, diga que respondemos em menos de 15 minutos..."
          />
        </div>
      </div>
    </form>
  );
}
