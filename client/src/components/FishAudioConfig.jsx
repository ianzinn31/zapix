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
  AlertCircle
} from 'lucide-react';

export default function FishAudioConfig({ fishSettings, transcriptionSettings, onSave, onTestAudio }) {
  // Fish Audio (TTS) state
  const [formData, setFormData] = useState({
    apiKey: fishSettings?.apiKey || '',
    model: fishSettings?.model || 'fish-audio/s2.1-pro-free:free',
    voiceId: fishSettings?.voiceId || '7f92f8afb8ec43bf81429cc1c9199cb1',
    enabled: fishSettings?.enabled ?? true,
    autoAudioMode: fishSettings?.autoAudioMode || 'pitch_and_welcome',
    speed: fishSettings?.speed || 1.0
  });

  // Groq Whisper (STT) state
  const [transcriptionData, setTranscriptionData] = useState({
    apiKey: transcriptionSettings?.apiKey || '',
    model: transcriptionSettings?.model || 'whisper-large-v3',
    language: transcriptionSettings?.language || 'pt',
    enabled: transcriptionSettings?.enabled ?? true
  });

  const [showFishKey, setShowFishKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [testText, setTestText] = useState('Opa, tudo bem? Aqui é o especialista da Zapix. Esse áudio foi gerado com o modelo Fish Audio s2.1-pro-free via OpenRouter diretamente para o seu WhatsApp!');
  const [isGenerating, setIsGenerating] = useState(false);
  const [testAudioResult, setTestAudioResult] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedVoiceId, setCopiedVoiceId] = useState(false);

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
        autoAudioMode: fishSettings.autoAudioMode || 'pitch_and_welcome',
        speed: fishSettings.speed || 1.0
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
    { id: 'whisper-large-v3', name: 'whisper-large-v3 (Maior precisão em PT-BR e gírias)', tag: 'Recomendado' },
    { id: 'whisper-large-v3-turbo', name: 'whisper-large-v3-turbo (Ultra-rápido ~150ms)', tag: 'Turbo' }
  ];

  const presetVoices = [
    {
      id: '7f92f8afb8ec43bf81429cc1c9199cb1',
      title: 'Especialista Vendedor Masculino (PT-BR)',
      description: 'Tom profissional, calmo e persuasivo. Excelente para fechamento de infoprodutos.'
    }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ 
      fishAudio: formData,
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
      const result = await onTestAudio(testText.trim(), formData.voiceId, formData.model);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Global Save Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Headphones size={24} color="#06b6d4" />
              Central de Voz & Áudio da IA
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '2px' }}>
              Configure a <strong>Audição (Groq Whisper)</strong> para entender áudios dos leads e a <strong>Fala (Fish Audio)</strong> para enviar áudios humanos.
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
                  Quando o cliente enviar áudio no WhatsApp, a Groq transcreve em ~200ms em Português para a NVIDIA processar a resposta de venda.
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

            {/* Whisper Model */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Modelo Whisper (Groq Cloud)
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

            {/* Language */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Idioma Padrão da Transcrição
              </label>
              <input
                type="text"
                value="pt (Português do Brasil - Nativo)"
                disabled
                className="input-field"
                style={{ fontSize: '0.84rem', opacity: 0.8, cursor: 'not-allowed' }}
              />
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

        {/* CARD 2: FISH AUDIO VIA OPENROUTER (TEXT-TO-SPEECH / VOZ DA IA) */}
        <div className="glass-card" style={{ padding: '24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div className="flex items-center gap-3">
              <div style={{ padding: '10px', background: 'rgba(6, 182, 212, 0.15)', borderRadius: '10px', color: '#22d3ee' }}>
                <Mic size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                  Fish Audio via OpenRouter (Síntese de Voz & PTT da IA)
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Utilizando o modelo <strong>{formData.model}</strong> via OpenRouter para criar notas de voz nativas no WhatsApp.
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

          {/* Section 1: Credentials & Model */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
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
                Modelo Fish Audio (OpenRouter)
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

            {/* Dispatch Mode */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Estratégia & Frequência de Envio de Áudio
              </label>
              <select
                value={formData.autoAudioMode || 'hybrid_high_conversion'}
                onChange={(e) => setFormData({ ...formData, autoAudioMode: e.target.value })}
                className="input-field"
                style={{ fontSize: '0.84rem' }}
              >
                <option value="hybrid_high_conversion">🔥 Modo Híbrido Alta Conversão (Mescla Texto + Áudio - Recomendado)</option>
                <option value="frequent_audio">🎙️ Modo Frequente (Áudio em 80%+ das Interações)</option>
                <option value="pitch_and_welcome">👋 Boas-vindas e Pitch de Vendas</option>
                <option value="pitch_only">💰 Apenas no Fechamento / Pitch de Vendas</option>
                <option value="mirror_only">👂 Espelhamento (Apenas quando o lead mandar áudio ou pedir)</option>
                <option value="manual_only">🔒 Desativar Áudios Automáticos (Apenas Texto)</option>
              </select>
            </div>
          </div>

          {/* Strategy Explanatory Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Sparkles size={20} color="#22d3ee" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.45' }}>
              {(formData.autoAudioMode === 'hybrid_high_conversion' || !formData.autoAudioMode) && (
                <span>
                  <strong style={{ color: '#38bdf8' }}>Modo Híbrido Ativo:</strong> A IA não espera o cliente pedir! Ela mescla naturalmente áudios pessoais de voz (10-15s) nos momentos de maior impacto psicológico (conexão inicial com a dor, quebra de objeções, apresentação da oferta e fechamento no PIX com a chave limpa no texto para cópia).
                </span>
              )}
              {formData.autoAudioMode === 'frequent_audio' && (
                <span>
                  <strong style={{ color: '#34d399' }}>Modo Frequente Ativo:</strong> A IA prioriza voz em praticamente todas as mensagens (80%+). O texto é reservado apenas para links, números e chaves PIX.
                </span>
              )}
              {formData.autoAudioMode === 'pitch_and_welcome' && (
                <span>
                  <strong style={{ color: '#fbbf24' }}>Boas-vindas e Pitch:</strong> Áudios são disparados no primeiro contato com o lead e na apresentação do valor do produto.
                </span>
              )}
              {formData.autoAudioMode === 'pitch_only' && (
                <span>
                  <strong style={{ color: '#fbbf24' }}>Pitch Only:</strong> Apenas na hora de apresentar a oferta final ou cobrar.
                </span>
              )}
              {formData.autoAudioMode === 'mirror_only' && (
                <span>
                  <strong style={{ color: '#94a3b8' }}>Espelhamento:</strong> O agente responde em texto e só manda áudio se o cliente mandar áudio primeiro ou pedir.
                </span>
              )}
              {formData.autoAudioMode === 'manual_only' && (
                <span>
                  <strong style={{ color: '#f43f5e' }}>Apenas Texto:</strong> Nenhum áudio automático será disparado no funil regular.
                </span>
              )}
            </div>
          </div>

          {/* Section 2: Custom Voice ID / Reference ID */}
          <div style={{
            background: 'rgba(6, 182, 212, 0.04)',
            border: '1px solid rgba(6, 182, 212, 0.2)',
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio size={18} color="#22d3ee" />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                  ID da Voz Personalizada (Voice ID / Reference ID)
                </h4>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleCopyVoiceId}
                  className="btn-secondary"
                  style={{ fontSize: '0.74rem', padding: '4px 10px' }}
                >
                  {copiedVoiceId ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                  <span>{copiedVoiceId ? 'Copiado!' : 'Copiar ID'}</span>
                </button>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '14px' }}>
              Cole abaixo o ID de referência da voz criada ou clonada no Fish Audio. O bot responderá com este timbre exato.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={formData.voiceId}
                  onChange={(e) => setFormData({ ...formData, voiceId: e.target.value.trim() })}
                  placeholder="Ex: 7f92f8afb8ec43bf81429cc1c9199cb1 ou custom_voice_hash"
                  className="input-field"
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
                {formData.voiceId !== '7f92f8afb8ec43bf81429cc1c9199cb1' && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, voiceId: '7f92f8afb8ec43bf81429cc1c9199cb1' })}
                    className="btn-secondary"
                    style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                    title="Restaurar voz padrão recomendada"
                  >
                    Restaurar Padrão
                  </button>
                )}
              </div>
            </div>

            {/* Presets & Help cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {presetVoices.map((v) => {
                const isSelected = formData.voiceId === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => setFormData({ ...formData, voiceId: v.id })}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: isSelected ? '1px solid #06b6d4' : '1px solid rgba(255, 255, 255, 0.06)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 700, color: isSelected ? '#22d3ee' : '#f8fafc' }}>
                        {v.title}
                      </span>
                      {isSelected && (
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', background: '#06b6d4', color: '#090d16', borderRadius: '4px', fontWeight: 700 }}>
                          SELECIONADA
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                      {v.description}
                    </p>
                    <code style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '6px', display: 'block' }}>
                      ID: {v.id}
                    </code>
                  </div>
                );
              })}

              <div style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.015)',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Sparkles size={20} color="#a855f7" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  <strong>Quer clonar a sua própria voz?</strong><br />
                  Grave 15s de áudio no Fish Audio, copie o Reference ID gerado e cole no campo acima para o bot responder com o seu timbre.
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Audio Testing Studio */}
      <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="#22d3ee" />
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              Laboratório de Teste de Áudio ({formData.model})
            </h4>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            ID em teste: <code style={{ color: '#22d3ee' }}>{formData.voiceId ? formData.voiceId.slice(0, 16) + '...' : 'Padrão'}</code>
          </span>
        </div>

        <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '14px' }}>
          Digite uma mensagem abaixo para gerar e ouvir como o lead receberá a nota de voz no WhatsApp com esta voz:
        </p>

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
            <span>{isGenerating ? 'Gerando via OpenRouter...' : 'Gerar Áudio de Teste'}</span>
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
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>
                  {testAudioResult.filename}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#34d399' }}>
                  WhatsApp Opus PTT ({testAudioResult.durationSec}s) • Voz: {testAudioResult.voiceId ? testAudioResult.voiceId.slice(0, 12) + '...' : 'Ativa'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
