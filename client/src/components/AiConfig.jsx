import React, { useState } from 'react';
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
  RefreshCw
} from 'lucide-react';

export default function AiConfig({ aiSettings, onSave }) {
  const [formData, setFormData] = useState({
    primaryModel: aiSettings?.primaryModel || 'meta/llama-3.2-11b-vision-instruct',
    primaryApiKey: aiSettings?.primaryApiKey || '',
    fallbackModel: aiSettings?.fallbackModel || 'meta/llama-3.2-11b-vision-instruct',
    fallbackApiKey: aiSettings?.fallbackApiKey || '',
    temperature: aiSettings?.temperature ?? 0.7,
    maxTokens: aiSettings?.maxTokens || 800,
    customPromptInstructions: aiSettings?.customPromptInstructions || ''
  });

  const [showPrimaryKey, setShowPrimaryKey] = useState(false);
  const [showFallbackKey, setShowFallbackKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const availableModels = [
    { id: 'meta/llama-3.2-11b-vision-instruct', name: 'Meta Llama 3.2 11B Vision Instruct (Recomendado & Ultra Estável)', tag: 'Estável & Sem Vazamentos' },
    { id: 'meta/llama-3.2-90b-vision-instruct', name: 'Meta Llama 3.2 90B Vision Instruct', tag: 'Alta Capacidade' },
    { id: 'deepseek-ai/deepseek-v4.1-flash', name: 'DeepSeek v4.1 Flash (Modo Raciocínio CoT)', tag: 'Raciocínio' },
    { id: 'deepseek-ai/deepseek-coder-6.7b-instruct', name: 'DeepSeek Coder 6.7B Instruct', tag: 'Lógica Rápida' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ai: formData });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="glass-card" style={{ padding: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div className="flex items-center gap-3">
            <div style={{ padding: '10px', background: 'rgba(139, 92, 246, 0.15)', borderRadius: '10px', color: '#c084fc' }}>
              <Cpu size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                Cérebro de IA: NVIDIA NIM Dual Fallback
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Alta disponibilidade com duas APIs da NVIDIA NIM para nunca perder vendas quando uma API oscilar.
              </p>
            </div>
          </div>

          <button type="submit" className="btn-primary">
            {savedSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
            <span>{savedSuccess ? 'Salvo!' : 'Salvar Modelos'}</span>
          </button>
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
          justifyContent: 'space-between'
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
                  ? 'Fallback Acionado: Operando com Modelo Secundário'
                  : 'Sistema Estável: Operando com Modelo Primário'}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                {aiSettings?.isFallbackActive
                  ? `Motivo: ${aiSettings.lastFallbackReason || 'Erro temporário na rota primária'}`
                  : 'Se o modelo primário sofrer timeout ou limite de requisições, o segundo assume instantaneamente sem o cliente perceber.'}
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

        {/* 2-Column: Primary & Fallback */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          {/* Primary Model Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} color="#c084fc" />
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                  1. Modelo Primário (NVIDIA NIM)
                </h4>
              </div>
              <span className="badge badge-conversa">Rota Principal</span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Selecione o Modelo Primário
              </label>
              <select
                value={formData.primaryModel}
                onChange={(e) => setFormData({ ...formData, primaryModel: e.target.value })}
                className="input-field"
                style={{ fontSize: '0.84rem' }}
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                NVIDIA NIM API Key (Primária)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPrimaryKey ? 'text' : 'password'}
                  value={formData.primaryApiKey}
                  onChange={(e) => setFormData({ ...formData, primaryApiKey: e.target.value })}
                  placeholder="nvapi-xxxxxxxxxxxxxxxxxxxxxxxx"
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
                Obtenha gratuitamente em <a href="https://build.nvidia.com" target="_blank" rel="noreferrer" style={{ color: '#c084fc' }}>build.nvidia.com</a>
              </p>
            </div>
          </div>

          {/* Secondary / Fallback Model Card */}
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
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                  2. Modelo Fallback (Backup Automático)
                </h4>
              </div>
              <span className="badge badge-pitch">Rota Contingência</span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Selecione o Modelo de Fallback
              </label>
              <select
                value={formData.fallbackModel}
                onChange={(e) => setFormData({ ...formData, fallbackModel: e.target.value })}
                className="input-field"
                style={{ fontSize: '0.84rem' }}
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                NVIDIA NIM API Key (Fallback / Secundária)
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
                Pode ser de outra conta NVIDIA ou a mesma chave reserva.
              </p>
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
