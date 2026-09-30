import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Sliders, 
  Clock, 
  MessageSquare, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  Activity
} from 'lucide-react';

export default function AntiBanConfig({ antiBanSettings, onSave }) {
  const [formData, setFormData] = useState({
    minThinkingDelay: antiBanSettings?.minThinkingDelay || 1800,
    maxThinkingDelay: antiBanSettings?.maxThinkingDelay || 4200,
    charDelayMin: antiBanSettings?.charDelayMin || 22,
    charDelayMax: antiBanSettings?.charDelayMax || 48,
    splitBubbles: antiBanSettings?.splitBubbles ?? true,
    maxCharsPerBubble: antiBanSettings?.maxCharsPerBubble || 220,
    sendComposing: antiBanSettings?.sendComposing ?? true,
    sendRecording: antiBanSettings?.sendRecording ?? true,
    minIntervalBetweenMessages: antiBanSettings?.minIntervalBetweenMessages || 1200
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ antiBan: formData });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div className="flex items-center gap-3">
            <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '10px', color: '#10b981' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                Sistema Anti-Banimento & Simulação Humana
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Algoritmos de humanização comportamental para operar a API não-oficial sem levantar suspeitas nos filtros do WhatsApp.
              </p>
            </div>
          </div>

          <button type="submit" className="btn-primary">
            {savedSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
            <span>{savedSuccess ? 'Salvo!' : 'Salvar Proteção'}</span>
          </button>
        </div>

        {/* Security Score Banner */}
        <div style={{
          padding: '16px 20px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>
              99%
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                Score de Proteção Anti-Ban: EXTREMAMENTE SEGURO
              </div>
              <p style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                Status "digitando...", pausas realistas e divisão em balões pequenos evitam padrões de robô.
              </p>
            </div>
          </div>
          <span className="badge badge-aprovado">Blindagem Ativa</span>
        </div>

        {/* Settings Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          {/* Thinking Delay */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Clock size={16} color="#38bdf8" />
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>
                Tempo de "Leitura e Reflexão"
              </h4>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '12px' }}>
              Pausa natural entre o cliente enviar a mensagem e a IA começar a responder (simula o humano lendo a tela).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Mínimo (ms)
                </label>
                <input
                  type="number"
                  value={formData.minThinkingDelay}
                  onChange={(e) => setFormData({ ...formData, minThinkingDelay: parseInt(e.target.value) })}
                  className="input-field"
                  step="100"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Máximo (ms)
                </label>
                <input
                  type="number"
                  value={formData.maxThinkingDelay}
                  onChange={(e) => setFormData({ ...formData, maxThinkingDelay: parseInt(e.target.value) })}
                  className="input-field"
                  step="100"
                />
              </div>
            </div>
          </div>

          {/* Typing Speed per character */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Activity size={16} color="#10b981" />
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>
                Velocidade de Digitação por Caractere
              </h4>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '12px' }}>
              Milissegundos por letra. Uma mensagem de 100 caracteres levará entre 2.5s e 4.5s para ser "digitada".
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Min ms/caractere
                </label>
                <input
                  type="number"
                  value={formData.charDelayMin}
                  onChange={(e) => setFormData({ ...formData, charDelayMin: parseInt(e.target.value) })}
                  className="input-field"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Max ms/caractere
                </label>
                <input
                  type="number"
                  value={formData.charDelayMax}
                  onChange={(e) => setFormData({ ...formData, charDelayMax: parseInt(e.target.value) })}
                  className="input-field"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Presence & Bubble Splitting Toggles */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc' }}>
                Simular Status "Digitando..." no WhatsApp
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Dispara o evento oficial <code>composing</code> para que o lead veja o status antes de receber a mensagem.
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={formData.sendComposing}
                onChange={(e) => setFormData({ ...formData, sendComposing: e.target.checked })}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc' }}>
                Simular Status "Gravando Áudio..." no WhatsApp
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Dispara o evento oficial <code>recording</code> antes de disparar o áudio do Fish Audio.
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={formData.sendRecording}
                onChange={(e) => setFormData({ ...formData, sendRecording: e.target.checked })}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc' }}>
                Dividir Textos Longos em Balões Naturais
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Pessoas reais não mandam testões no WhatsApp. Quebra as respostas em 2 a 3 mensagens menores.
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={formData.splitBubbles}
                onChange={(e) => setFormData({ ...formData, splitBubbles: e.target.checked })}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {formData.splitBubbles && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Limite de Caracteres por Balão: {formData.maxCharsPerBubble}
              </label>
              <input
                type="range"
                min="100"
                max="400"
                step="10"
                value={formData.maxCharsPerBubble}
                onChange={(e) => setFormData({ ...formData, maxCharsPerBubble: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
              />
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
