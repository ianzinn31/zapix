import React, { useState, useEffect } from 'react';
import { 
  Mic, 
  Play, 
  Pause, 
  Save, 
  CheckCircle2, 
  Sparkles, 
  Wand2, 
  Eye, 
  EyeOff, 
  Zap, 
  Volume2, 
  Copy, 
  Check, 
  HelpCircle, 
  Radio,
  Headphones,
  ExternalLink,
  AlertCircle,
  Globe,
  Plus,
  Trash2,
  Search,
  Filter
} from 'lucide-react';

export default function FishAudioConfig({ fishSettings, transcriptionSettings, onSave, onTestAudio }) {
  // Default presets for regional voices
  const defaultRegionalVoices = {
    'pt-BR': {
      country: 'Brasil',
      language: 'Português (Brasil)',
      flag: '🇧🇷',
      ddi: '55',
      voiceId: '7f92f8afb8ec43bf81429cc1c9199cb1',
      sampleText: 'Oi, tudo bem? Aqui é do time de atendimento, tô passando pra te mandar as atividades!',
      description: 'Voz brasileira nativa, tom acolhedor e consultivo.'
    },
    'es-MX': {
      country: 'México',
      language: 'Español (México)',
      flag: '🇲🇽',
      ddi: '52',
      voiceId: '',
      sampleText: '¡Hola! ¿Cómo estás? Te comparto con mucho gusto el material completo para que lo revises.',
      description: 'Acento mexicano nativo, entonación cálida y cercana.'
    },
    'es-CO': {
      country: 'Colômbia',
      language: 'Español (Colombia)',
      flag: '🇨🇴',
      ddi: '57',
      voiceId: '',
      sampleText: '¡Hola! Qué gusto saludarte. Con todo gusto te comparto el material para que empiecen hoy mismo.',
      description: 'Acento colombiano suave, amable y respetuoso.'
    },
    'es-AR': {
      country: 'Argentina',
      language: 'Español (Argentina)',
      flag: '🇦🇷',
      ddi: '54',
      voiceId: '',
      sampleText: '¡Hola! ¿Cómo estás? Te paso con mucho gusto el material para que lo veas ahora mismo.',
      description: 'Acento argentino/porteño, fluido y empático.'
    },
    'es-BO': {
      country: 'Bolívia',
      language: 'Español (Bolivia)',
      flag: '🇧🇴',
      ddi: '591',
      voiceId: '',
      sampleText: '¡Hola! Qué alegría saludarte. Te paso toda la información y el material para comenzar.',
      description: 'Acento boliviano andino/oriental, formal y cálido.'
    },
    'es-PY': {
      country: 'Paraguai',
      language: 'Español (Paraguay)',
      flag: '🇵🇾',
      ddi: '595',
      voiceId: '',
      sampleText: '¡Hola! Un gusto saludarte. Te envío los materiales completos para que puedas aprovecharlos.',
      description: 'Acento paraguayo servicial y cordial.'
    },
    'es-PE': {
      country: 'Peru',
      language: 'Español (Perú)',
      flag: '🇵🇪',
      ddi: '51',
      voiceId: '',
      sampleText: '¡Hola! Qué gusto saludarte. Te comparto las actividades completas para comenzar.',
      description: 'Español peruano neutro, claro e confiável.'
    },
    'es-CL': {
      country: 'Chile',
      language: 'Español (Chile)',
      flag: '🇨🇱',
      ddi: '56',
      voiceId: '',
      sampleText: '¡Hola! ¿Cómo estás? Te comparto altiro el material para que lo puedas revisar.',
      description: 'Español chileno dinámico y cercano.'
    },
    'es-419': {
      country: 'LatAm Geral (Neutro)',
      language: 'Español Neutro (Latinoamérica)',
      flag: '🌎',
      ddi: '',
      voiceId: '',
      sampleText: '¡Hola! Un gran saludo. Te comparto el material completo con todo cariño para ti.',
      description: 'Español neutro latinoamericano universal para cualquier país hispano.'
    },
    'en-US': {
      country: 'Estados Unidos / Global',
      language: 'English (US)',
      flag: '🇺🇸',
      ddi: '1',
      voiceId: '',
      sampleText: 'Hi there! Great to connect with you. Here are the complete activities for you to get started.',
      description: 'Native English speaker, friendly and engaging tone.'
    }
  };

  // Fish Audio (TTS) state
  const [formData, setFormData] = useState({
    apiKey: fishSettings?.apiKey || '',
    model: fishSettings?.model || 'fish-audio/s2.1-pro-free:free',
    voiceId: fishSettings?.voiceId || '7f92f8afb8ec43bf81429cc1c9199cb1',
    enabled: fishSettings?.enabled ?? true,
    autoAudioMode: fishSettings?.autoAudioMode || 'hybrid_high_conversion',
    speed: fishSettings?.speed || 0.85
  });

  // Regional Voices Map per Country & Language
  const [regionalVoices, setRegionalVoices] = useState(
    fishSettings?.regionalVoices ? { ...defaultRegionalVoices, ...fishSettings.regionalVoices } : defaultRegionalVoices
  );

  // Groq Whisper (STT) state
  const [transcriptionData, setTranscriptionData] = useState({
    apiKey: transcriptionSettings?.apiKey || '',
    model: transcriptionSettings?.model || 'whisper-large-v3',
    language: transcriptionSettings?.language || 'pt',
    enabled: transcriptionSettings?.enabled ?? true
  });

  const [showFishKey, setShowFishKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [testText, setTestText] = useState('Oi, tudo bem? Te mandei o material completo pra você já aproveitar com o seu filho!');
  const [selectedTestVoiceKey, setSelectedTestVoiceKey] = useState('pt-BR');
  const [isGenerating, setIsGenerating] = useState(false);
  const [testAudioResult, setTestAudioResult] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedVoiceId, setCopiedVoiceId] = useState(false);

  // Card specific audio testing state
  const [testingCardKey, setTestingCardKey] = useState(null);

  // Search & Filter state for regional voices
  const [voiceSearch, setVoiceSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('all'); // all | latam | brazil | global | configured

  // Custom Country Modal / Form state
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [customForm, setCustomForm] = useState({
    key: '',
    country: '',
    language: '',
    flag: '🌎',
    ddi: '',
    voiceId: '',
    description: '',
    sampleText: ''
  });

  // Groq test state
  const [testingGroq, setTestingGroq] = useState(false);
  const [groqTestResult, setGroqTestResult] = useState(null);

  useEffect(() => {
    if (fishSettings) {
      setFormData({
        apiKey: fishSettings.apiKey || '',
        model: fishSettings.model || 'fish-audio/s2.1-pro-free:free',
        voiceId: fishSettings.voiceId || '7f92f8afb8ec43bf81429cc1c9199cb1',
        enabled: fishSettings.enabled ?? true,
        autoAudioMode: fishSettings.autoAudioMode || 'hybrid_high_conversion',
        speed: fishSettings.speed || 0.85
      });
      setRegionalVoices({
        ...defaultRegionalVoices,
        ...(fishSettings.regionalVoices || {})
      });
    }
  }, [fishSettings]);

  useEffect(() => {
    if (transcriptionSettings) {
      setTranscriptionData({
        apiKey: transcriptionSettings.apiKey || '',
        model: transcriptionSettings.model || 'whisper-large-v3',
        language: transcriptionSettings.language || 'pt',
        enabled: transcriptionSettings.enabled ?? true
      });
    }
  }, [transcriptionSettings]);

  const availableFishModels = [
    { id: 'fish-audio/s2.1-pro-free:free', name: 'fish-audio/s2.1-pro-free:free (OpenRouter Gratuito)', tag: 'Free' },
    { id: 'fish-audio/s2.1-pro', name: 'fish-audio/s2.1-pro (OpenRouter Produção Alta Fidelidade)', tag: 'Pro' }
  ];

  const availableGroqModels = [
    { id: 'whisper-large-v3', name: 'whisper-large-v3 (Maior precisão em PT-BR, ES e gírias)', tag: 'Recomendado' },
    { id: 'whisper-large-v3-turbo', name: 'whisper-large-v3-turbo (Ultra-rápido ~150ms)', tag: 'Turbo' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ 
      fishAudio: {
        ...formData,
        regionalVoices
      },
      transcription: transcriptionData
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleTestGroq = async () => {
    setTestingGroq(true);
    setGroqTestResult(null);
    try {
      const res = await fetch('/api/transcription/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: transcriptionData.apiKey })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao validar chave Groq');
      }
      setGroqTestResult({ success: true, message: data.message });
    } catch (err) {
      setGroqTestResult({ success: false, message: err.message });
    } finally {
      setTestingGroq(false);
    }
  };

  const handleTestAudio = async () => {
    if (!testText.trim()) return;
    setIsGenerating(true);
    try {
      const targetVoice = selectedTestVoiceKey === 'default'
        ? formData.voiceId
        : (regionalVoices[selectedTestVoiceKey]?.voiceId || formData.voiceId);

      const result = await onTestAudio(testText.trim(), targetVoice, formData.model, {
        regionalKey: selectedTestVoiceKey,
        country: regionalVoices[selectedTestVoiceKey]?.country
      });

      setTestAudioResult(result);
      if (audioElement) {
        audioElement.pause();
      }
      const audio = new Audio(result.audioUrl);
      audio.onended = () => setIsPlaying(false);
      setAudioElement(audio);
    } catch (err) {
      alert(`Erro ao gerar áudio: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Test individual voice directly from a country card
  const handleTestCardVoice = async (key, voice) => {
    const textToSay = voice.sampleText || 'Hola, ¿cómo estás? Te comparto el material completo.';
    const voiceToUse = (voice.voiceId && voice.voiceId.trim()) ? voice.voiceId.trim() : formData.voiceId;
    
    setTestingCardKey(key);
    try {
      const result = await onTestAudio(textToSay, voiceToUse, formData.model, {
        regionalKey: key,
        country: voice.country
      });

      setTestAudioResult(result);
      if (audioElement) {
        audioElement.pause();
      }
      const audio = new Audio(result.audioUrl);
      audio.onended = () => {
        setIsPlaying(false);
        setTestingCardKey(null);
      };
      setAudioElement(audio);
      audio.play();
      setIsPlaying(true);
    } catch (err) {
      alert(`Erro ao testar voz de ${voice.country}: ${err.message}`);
      setTestingCardKey(null);
    }
  };

  const togglePlay = () => {
    if (!audioElement) return;
    if (isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
    } else {
      audioElement.play();
      setIsPlaying(true);
    }
  };

  const handleCopyVoiceId = () => {
    if (!formData.voiceId) return;
    navigator.clipboard.writeText(formData.voiceId);
    setCopiedVoiceId(true);
    setTimeout(() => setCopiedVoiceId(false), 2000);
  };

  const handleUpdateRegionalVoice = (key, field, value) => {
    setRegionalVoices(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  const handleAddCustomCountry = (e) => {
    e.preventDefault();
    if (!customForm.country.trim()) {
      alert('Informe o nome do país');
      return;
    }
    const cleanKey = (customForm.key || `custom_${Date.now()}`).trim().replace(/\s+/g, '_');
    setRegionalVoices(prev => ({
      ...prev,
      [cleanKey]: {
        country: customForm.country.trim(),
        language: customForm.language.trim() || 'Español',
        flag: customForm.flag.trim() || '🌎',
        ddi: customForm.ddi.trim().replace(/[^0-9]/g, ''),
        voiceId: customForm.voiceId.trim(),
        sampleText: customForm.sampleText.trim() || '¡Hola! Te comparto toda la información para empezar hoy mismo.',
        description: customForm.description.trim() || 'Voz personalizada cadastrada pelo operador.'
      }
    }));
    setShowAddCustomModal(false);
    setCustomForm({
      key: '',
      country: '',
      language: '',
      flag: '🌎',
      ddi: '',
      voiceId: '',
      description: '',
      sampleText: ''
    });
  };

  const handleDeleteRegionalVoice = (key) => {
    if (window.confirm(`Deseja remover a configuração de voz para este país?`)) {
      setRegionalVoices(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // Filter regional voices based on search and region tabs
  const filteredRegionalEntries = Object.entries(regionalVoices).filter(([key, voice]) => {
    // Search filter
    if (voiceSearch.trim()) {
      const q = voiceSearch.toLowerCase();
      const match = 
        voice.country.toLowerCase().includes(q) ||
        voice.language.toLowerCase().includes(q) ||
        key.toLowerCase().includes(q) ||
        (voice.ddi && voice.ddi.includes(q)) ||
        (voice.voiceId && voice.voiceId.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Region filter
    if (regionFilter === 'brazil') return key === 'pt-BR';
    if (regionFilter === 'latam') return key.startsWith('es-') || key === 'es-419';
    if (regionFilter === 'global') return key === 'en-US' || !key.startsWith('es-') && key !== 'pt-BR';
    if (regionFilter === 'configured') return Boolean(voice.voiceId && voice.voiceId.trim());

    return true;
  });

  const configuredCount = Object.values(regionalVoices).filter(v => v.voiceId && v.voiceId.trim()).length;
  const totalCount = Object.keys(regionalVoices).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Global Save Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Headphones size={24} color="#06b6d4" />
              Central de Vozes da IA (Multi-País & Idioma)
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '2px' }}>
              Configure a <strong>Audição (Groq Whisper)</strong> e as <strong>Vozes Nativas por País (Fish Audio)</strong> com detecção automática pela IA.
            </p>
          </div>

          <button type="submit" className="btn-primary" style={{ padding: '10px 22px' }}>
            {savedSuccess ? <CheckCircle2 size={18} /> : <Save size={18} />}
            <span>{savedSuccess ? 'Configurações Salvas!' : 'Salvar Todas as Configurações'}</span>
          </button>
        </div>

        {/* CARD 1: GROQ WHISPER (SPEECH-TO-TEXT / AUDIÇÃO DO LEAD) */}
        <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div className="flex items-center gap-3">
              <div style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '10px', color: '#fbbf24' }}>
                <Volume2 size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                    Groq Whisper (Audição & Transcrição de Áudio dos Leads)
                  </h3>
                  <span style={{ fontSize: '0.68rem', padding: '2px 8px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', fontWeight: 700 }}>
                    100% Gratuito na Groq
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Quando o cliente enviar áudio no WhatsApp (em Português ou Espanhol), a Groq transcreve em ~200ms para a IA responder.
                </p>
              </div>
            </div>

            {/* Toggle Enable */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'rgba(255, 255, 255, 0.04)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <input
                type="checkbox"
                checked={transcriptionData.enabled}
                onChange={(e) => setTranscriptionData({ ...transcriptionData, enabled: e.target.checked })}
                style={{ accentColor: '#fbbf24', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: transcriptionData.enabled ? '#fbbf24' : '#94a3b8' }}>
                {transcriptionData.enabled ? 'Audição Ativa' : 'Pausada'}
              </span>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            {/* Groq API Key Input */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1' }}>
                  Groq API Key
                </label>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.72rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                >
                  <span>Criar chave grátis na Groq</span>
                  <ExternalLink size={11} />
                </a>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showGroqKey ? 'text' : 'password'}
                  value={transcriptionData.apiKey}
                  onChange={(e) => setTranscriptionData({ ...transcriptionData, apiKey: e.target.value })}
                  placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="input-field"
                  style={{ paddingRight: '40px', fontSize: '0.84rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowGroqKey(!showGroqKey)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  {showGroqKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Groq Whisper Model Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Modelo Whisper de Transcrição
              </label>
              <select
                value={transcriptionData.model}
                onChange={(e) => setTranscriptionData({ ...transcriptionData, model: e.target.value })}
                className="input-field"
                style={{ fontSize: '0.84rem' }}
              >
                {availableGroqModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} [{m.tag}]
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Test Groq Connection Button & Feedback */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <button
              type="button"
              onClick={handleTestGroq}
              disabled={testingGroq}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '6px 14px', borderColor: '#fbbf24', color: '#fbbf24' }}
            >
              <Zap size={14} />
              <span>{testingGroq ? 'Verificando com Groq Cloud...' : 'Testar Conexão com Groq API'}</span>
            </button>

            {groqTestResult && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.8rem',
                color: groqTestResult.success ? '#34d399' : '#f43f5e',
                background: groqTestResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                padding: '6px 12px',
                borderRadius: '6px'
              }}>
                {groqTestResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{groqTestResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* CARD 2: FISH AUDIO CONFIGURAÇÕES GERAIS DE CONECTIVIDADE */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div className="flex items-center gap-3">
              <div style={{ padding: '10px', background: 'rgba(6, 182, 212, 0.15)', borderRadius: '10px', color: '#22d3ee' }}>
                <Mic size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                  Conectividade do Motor de Áudio (Fish Audio via OpenRouter)
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Motor de síntese de voz ultra-realista com velocidade humana adaptada para o WhatsApp.
                </p>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'rgba(255, 255, 255, 0.04)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                style={{ accentColor: '#06b6d4', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: formData.enabled ? '#22d3ee' : '#94a3b8' }}>
                {formData.enabled ? 'Voz Ativada' : 'Apenas Texto'}
              </span>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            {/* OpenRouter API Key */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1' }}>
                  OpenRouter API Key
                </label>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.72rem', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                >
                  <span>Obter no OpenRouter</span>
                  <ExternalLink size={11} />
                </a>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showFishKey ? 'text' : 'password'}
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="sk-or-v1-xxxxxxxxxxxxxxxx"
                  className="input-field"
                  style={{ paddingRight: '40px', fontSize: '0.84rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowFishKey(!showFishKey)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  {showFishKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Model Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Modelo Fish Audio
              </label>
              <select
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="input-field"
                style={{ fontSize: '0.84rem' }}
              >
                {availableFishModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} [{m.tag}]
                  </option>
                ))}
              </select>
            </div>

            {/* Speed Control */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1' }}>
                  Ritmo / Velocidade de Fala
                </label>
                <span style={{ fontSize: '0.78rem', color: '#22d3ee', fontWeight: 700 }}>
                  {formData.speed}x (Natural WhatsApp)
                </span>
              </div>
              <input
                type="range"
                min="0.75"
                max="1.15"
                step="0.02"
                value={formData.speed}
                onChange={(e) => setFormData({ ...formData, speed: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: '#06b6d4', cursor: 'pointer' }}
              />
            </div>

            {/* Global Fallback Voice ID */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1' }}>
                  Voz Geral de Fallback (Padrão Global)
                </label>
                <button
                  type="button"
                  onClick={handleCopyVoiceId}
                  className="btn-secondary"
                  style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                >
                  {copiedVoiceId ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                  <span>{copiedVoiceId ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
              <input
                type="text"
                value={formData.voiceId}
                onChange={(e) => setFormData({ ...formData, voiceId: e.target.value.trim() })}
                placeholder="7f92f8afb8ec43bf81429cc1c9199cb1"
                className="input-field"
                style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 3: CONFIGURAÇÃO DE VOZES REGIONAIS POR PAÍS / IDIOMA (SELEÇÃO DA IA) */}
        {/* ========================================================================= */}
        <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div className="flex items-center gap-3">
              <div style={{ padding: '10px', background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)', borderRadius: '10px', color: '#38bdf8' }}>
                <Globe size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                    Vozes por País & Idioma (Seleção Automática por IA)
                  </h3>
                  <span style={{ fontSize: '0.72rem', padding: '2px 10px', background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '12px', fontWeight: 700 }}>
                    {configuredCount} de {totalCount} Países Configurados
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '2px' }}>
                  Preencha o <strong>Voice ID</strong> de cada país. A IA detecta a origem do lead em tempo real e escolhe a voz certa na hora de falar!
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAddCustomModal(true)}
              className="btn-secondary"
              style={{ fontSize: '0.82rem', padding: '8px 14px', borderColor: '#38bdf8', color: '#38bdf8' }}
            >
              <Plus size={15} />
              <span>Adicionar Outro País / Idioma</span>
            </button>
          </div>

          {/* AI Autonomous Detection Highlights Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(8, 47, 73, 0.4) 100%)',
            border: '1px solid rgba(6, 182, 212, 0.2)',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(6, 182, 212, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22d3ee', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>
                1
              </div>
              <div>
                <strong style={{ fontSize: '0.8rem', color: '#f8fafc', display: 'block' }}>DDI do WhatsApp</strong>
                <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  Reconhece o código internacional (+52 México, +57 Colômbia, +55 Brasil, etc.) instantaneamente.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>
                2
              </div>
              <div>
                <strong style={{ fontSize: '0.8rem', color: '#f8fafc', display: 'block' }}>País Alvo da Campanha</strong>
                <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  Sincronizado automaticamente com o país definido na aba Infoproduto/Oferta.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>
                3
              </div>
              <div>
                <strong style={{ fontSize: '0.8rem', color: '#f8fafc', display: 'block' }}>Sotaque & Vocabulário</strong>
                <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  A IA analisa o texto da conversa para identificar termos e gírias locais.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>
                4
              </div>
              <div>
                <strong style={{ fontSize: '0.8rem', color: '#f8fafc', display: 'block' }}>Fallback Inteligente</strong>
                <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  Se o país não tiver voz configurada, utiliza LatAm Geral (es-419) ou a voz padrão.
                </span>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '6px', background: 'rgba(255, 255, 255, 0.03)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              {[
                { id: 'all', label: `Todos (${totalCount})` },
                { id: 'latam', label: 'América Latina' },
                { id: 'brazil', label: 'Brasil' },
                { id: 'global', label: 'Global / EUA' },
                { id: 'configured', label: `Configuradas (${configuredCount})` }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRegionFilter(tab.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: regionFilter === tab.id ? '#06b6d4' : 'transparent',
                    color: regionFilter === tab.id ? '#090d16' : '#94a3b8',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Quick Search */}
            <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 240px', maxWidth: '380px' }}>
              <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={voiceSearch}
                onChange={(e) => setVoiceSearch(e.target.value)}
                placeholder="Buscar país, idioma, DDI ou ID..."
                className="input-field"
                style={{ paddingLeft: '32px', fontSize: '0.8rem', padding: '6px 12px 6px 32px' }}
              />
            </div>
          </div>

          {/* Regional Country Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {filteredRegionalEntries.map(([key, voice]) => {
              const isConfigured = Boolean(voice.voiceId && voice.voiceId.trim());
              const isTestingThis = testingCardKey === key;

              return (
                <div
                  key={key}
                  style={{
                    background: isConfigured 
                      ? 'linear-gradient(145deg, rgba(6, 182, 212, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)' 
                      : 'rgba(255, 255, 255, 0.02)',
                    border: isConfigured ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '12px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'all 0.2s ease',
                    boxShadow: isConfigured ? '0 4px 20px rgba(6, 182, 212, 0.05)' : 'none'
                  }}
                >
                  {/* Card Header: Flag, Country Name, Badges */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>{voice.flag}</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                            {voice.country}
                          </h4>
                          {voice.ddi && (
                            <span style={{ fontSize: '0.68rem', padding: '1px 6px', background: 'rgba(255, 255, 255, 0.07)', color: '#cbd5e1', borderRadius: '4px', fontWeight: 600 }}>
                              +{voice.ddi}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                          {voice.language} • <code style={{ color: '#38bdf8' }}>{key}</code>
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span style={{
                      fontSize: '0.68rem',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      background: isConfigured ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                      color: isConfigured ? '#34d399' : '#94a3b8',
                      border: isConfigured ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(148, 163, 184, 0.2)',
                      whiteSpace: 'nowrap'
                    }}>
                      {isConfigured ? '● Voz Própria' : '○ Fallback'}
                    </span>
                  </div>

                  {/* Voice ID Input Field */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1' }}>
                        Voice ID (Fish Audio Reference ID):
                      </label>
                      {voice.voiceId && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(voice.voiceId);
                            alert(`ID da voz de ${voice.country} copiado!`);
                          }}
                          style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Copy size={11} />
                          <span>Copiar</span>
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        value={voice.voiceId || ''}
                        onChange={(e) => handleUpdateRegionalVoice(key, 'voiceId', e.target.value.trim())}
                        placeholder={key === 'pt-BR' ? '7f92f8afb8ec43bf81429cc1c9199cb1' : 'Cole o Voice ID deste país (ex: 4a9f2...)'}
                        className="input-field"
                        style={{
                          fontSize: '0.8rem',
                          fontFamily: 'monospace',
                          padding: '6px 10px',
                          borderColor: isConfigured ? 'rgba(6, 182, 212, 0.5)' : 'rgba(255, 255, 255, 0.1)'
                        }}
                      />
                      {voice.voiceId && (
                        <button
                          type="button"
                          onClick={() => handleUpdateRegionalVoice(key, 'voiceId', '')}
                          title="Limpar e usar fallback"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            color: '#94a3b8',
                            padding: '0 8px',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sample Dialect Text & Test Action */}
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        Frase de Teste ({voice.country}):
                      </span>
                      <button
                        type="button"
                        onClick={() => handleTestCardVoice(key, voice)}
                        disabled={isGenerating || isTestingThis}
                        style={{
                          background: isTestingThis ? '#10b981' : 'rgba(6, 182, 212, 0.2)',
                          color: isTestingThis ? '#fff' : '#22d3ee',
                          border: '1px solid rgba(6, 182, 212, 0.4)',
                          borderRadius: '6px',
                          padding: '3px 10px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        {isTestingThis ? <Pause size={12} /> : <Play size={12} />}
                        <span>{isTestingThis ? 'Ouvindo...' : 'Ouvir Voz'}</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      value={voice.sampleText || ''}
                      onChange={(e) => handleUpdateRegionalVoice(key, 'sampleText', e.target.value)}
                      placeholder="Frase típica para testar a pronúncia..."
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#cbd5e1',
                        fontSize: '0.76rem',
                        fontStyle: 'italic',
                        outline: 'none',
                        width: '100%'
                      }}
                    />
                  </div>

                  {/* Description & Delete Custom Option */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {voice.description}
                    </span>

                    {/* Allow deleting custom countries (not default ones) */}
                    {!defaultRegionalVoices[key] && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRegionalVoice(key)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f43f5e',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Remover país personalizado"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredRegionalEntries.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
              <p style={{ fontSize: '0.9rem' }}>Nenhum país encontrado para o filtro aplicado.</p>
            </div>
          )}
        </div>

        {/* Modal / Dialog to Add Custom Country */}
        {showAddCustomModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}>
            <div style={{
              background: '#0f172a',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '520px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={18} color="#22d3ee" />
                  Cadastrar Novo País / Idioma para a IA
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddCustomModal(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
                Adicione um novo país ou variação de idioma. A IA utilizará este Voice ID automaticamente sempre que o lead for daquela localidade.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Bandeira</label>
                  <input
                    type="text"
                    value={customForm.flag}
                    onChange={(e) => setCustomForm({ ...customForm, flag: e.target.value })}
                    placeholder="🇪🇨"
                    className="input-field"
                    style={{ textAlign: 'center', fontSize: '1.2rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Nome do País</label>
                  <input
                    type="text"
                    value={customForm.country}
                    onChange={(e) => setCustomForm({ ...customForm, country: e.target.value })}
                    placeholder="Ex: Equador, Uruguai, Espanha..."
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Código Idioma</label>
                  <input
                    type="text"
                    value={customForm.key}
                    onChange={(e) => setCustomForm({ ...customForm, key: e.target.value })}
                    placeholder="Ex: es-EC, es-UY, pt-PT..."
                    className="input-field"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>DDI Telefônico</label>
                  <input
                    type="text"
                    value={customForm.ddi}
                    onChange={(e) => setCustomForm({ ...customForm, ddi: e.target.value })}
                    placeholder="Ex: 593 (sem o +)"
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Nome da Língua / Sotaque</label>
                <input
                  type="text"
                  value={customForm.language}
                  onChange={(e) => setCustomForm({ ...customForm, language: e.target.value })}
                  placeholder="Ex: Español (Ecuador)"
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Voice ID no Fish Audio</label>
                <input
                  type="text"
                  value={customForm.voiceId}
                  onChange={(e) => setCustomForm({ ...customForm, voiceId: e.target.value.trim() })}
                  placeholder="Cole o Reference ID do Fish Audio para este país"
                  className="input-field"
                  style={{ fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Frase Típica de Demonstração</label>
                <input
                  type="text"
                  value={customForm.sampleText}
                  onChange={(e) => setCustomForm({ ...customForm, sampleText: e.target.value })}
                  placeholder="¡Hola! Te comparto las actividades completas para comenzar hoy."
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddCustomModal(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomCountry}
                  className="btn-primary"
                  style={{ padding: '8px 18px' }}
                >
                  Cadastrar País
                </button>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* ========================================================================= */}
      {/* CARD 4: LABORATÓRIO DE TESTE DE ÁUDIO (COM SELETOR DE PAÍSES) */}
      {/* ========================================================================= */}
      <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="#22d3ee" />
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              Laboratório de Síntese & Teste ({formData.model})
            </h4>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Formato: <code style={{ color: '#22d3ee' }}>WhatsApp Opus PTT nativo com onda animada</code>
          </span>
        </div>

        <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '14px' }}>
          Escolha o país/voz abaixo e digite um texto para ouvir como o cliente receberá a mensagem no WhatsApp:
        </p>

        {/* Voice Selector for Testing */}
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>
            Testar com a Voz de:
          </label>
          <select
            value={selectedTestVoiceKey}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedTestVoiceKey(val);
              if (regionalVoices[val]?.sampleText) {
                setTestText(regionalVoices[val].sampleText);
              }
            }}
            className="input-field"
            style={{ maxWidth: '320px', fontSize: '0.82rem', padding: '6px 12px' }}
          >
            <option value="default">🌐 Voz Padrão Global ({formData.voiceId.slice(0, 10)}...)</option>
            {Object.entries(regionalVoices).map(([key, v]) => (
              <option key={key} value={key}>
                {v.flag} {v.country} ({v.language}) {v.voiceId ? '✓' : '(Fallback)'}
              </option>
            ))}
          </select>

          {selectedTestVoiceKey !== 'default' && (
            <span style={{ fontSize: '0.74rem', color: regionalVoices[selectedTestVoiceKey]?.voiceId ? '#34d399' : '#fbbf24' }}>
              {regionalVoices[selectedTestVoiceKey]?.voiceId 
                ? `Voice ID: ${regionalVoices[selectedTestVoiceKey].voiceId.slice(0, 12)}...` 
                : 'Sem Voice ID próprio (usará voz padrão)'}
            </span>
          )}
        </div>

        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          className="input-field"
          rows={3}
          style={{ marginBottom: '14px' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <button
            type="button"
            onClick={handleTestAudio}
            disabled={isGenerating || !testText.trim()}
            className="btn-primary"
            style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' }}
          >
            <Wand2 size={16} />
            <span>{isGenerating ? 'Sintetizando Voz Regional...' : 'Sintetizar Áudio de Teste'}</span>
          </button>

          {testAudioResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255, 255, 255, 0.05)', padding: '8px 16px', borderRadius: '10px' }}>
              <button
                type="button"
                onClick={togglePlay}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#10b981',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: '2px' }} />}
              </button>

              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{testAudioResult.filename}</span>
                  {testAudioResult.detectedCountry && (
                    <span style={{ fontSize: '0.68rem', padding: '1px 6px', background: 'rgba(6, 182, 212, 0.2)', color: '#22d3ee', borderRadius: '4px' }}>
                      {testAudioResult.detectedCountry}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#34d399' }}>
                  Opus PTT ({testAudioResult.durationSec}s) • Voz: {testAudioResult.voiceId ? testAudioResult.voiceId.slice(0, 12) + '...' : 'Padrão'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
