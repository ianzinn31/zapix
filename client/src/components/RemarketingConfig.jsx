import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, 
  Mic, 
  Volume2, 
  Play, 
  Pause, 
  Save, 
  Clock, 
  ShieldCheck, 
  Sparkles, 
  Plus, 
  Trash2, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Radio, 
  Headphones, 
  RefreshCw,
  Zap,
  ArrowRight,
  Filter
} from 'lucide-react';

export default function RemarketingConfig({ remarketingSettings, product, onSave }) {
  const [formData, setFormData] = useState({
    enabled: remarketingSettings?.enabled ?? true,
    preferAudio: remarketingSettings?.preferAudio ?? true,
    startHour: remarketingSettings?.startHour ?? 8,
    endHour: remarketingSettings?.endHour ?? 22,
    minJitterMinutes: remarketingSettings?.minJitterMinutes ?? 2,
    maxJitterMinutes: remarketingSettings?.maxJitterMinutes ?? 6,
    steps: remarketingSettings?.steps || [
      {
        id: 'step-1',
        name: '1º Toque: Suporte no PIX / Dificuldade no App',
        delayMinutes: 20,
        sendMode: 'audio',
        targetFunnel: 'PIX_OR_ABANDONED',
        audioText: 'Opa, tudo bem? Tô passando aqui rapidinho só pra saber se você conseguiu abrir o app do banco ou se deu algum errinho no PIX. Qualquer coisa me dá um alô aqui que eu te ajudo!',
        useAiGeneratedText: true,
        aiPromptInstruction: 'Pergunte com simpatia se o lead teve alguma dificuldade no aplicativo do banco para concluir o PIX e ofereça ajuda amigável.'
      },
      {
        id: 'step-2',
        name: '2º Toque: Escassez & Condição Promocional (2h)',
        delayMinutes: 120,
        sendMode: 'audio',
        targetFunnel: 'PIX_OR_ABANDONED',
        audioText: 'Oi {nome}! Passando só pra te avisar que eu consegui segurar aquela condição promocional de {preco} pra você até o fim do dia. Se você ainda quiser aproveitar, me avisa pra eu já liberar seu acesso na hora!',
        useAiGeneratedText: true,
        aiPromptInstruction: 'Avise que segurou o valor promocional do produto até o final do dia e pergunte se ele quer aproveitar para liberar o acesso imediato.'
      },
      {
        id: 'step-3',
        name: '3º Toque: Reengajamento & Prova Social (24h)',
        delayMinutes: 1440,
        sendMode: 'audio',
        targetFunnel: 'ALL_UNPAID',
        audioText: 'Oi {nome}! Tudo bem com você? Tava lembrando da nossa conversa aqui e queria ver como você tá. Você ainda tem interesse nas novidades do {produto}? Muita gente tá amando os resultados!',
        useAiGeneratedText: true,
        aiPromptInstruction: 'Fale de forma calorosa no dia seguinte perguntando se o lead ainda quer transformar a rotina com o método e se ficou alguma dúvida.'
      }
    ]
  });

  const [stats, setStats] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [previewLoadingStepId, setPreviewLoadingStepId] = useState(null);
  const [playingStepId, setPlayingStepId] = useState(null);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [testPhones, setTestPhones] = useState({});
  const [sendingTestStepId, setSendingTestStepId] = useState(null);
  const [testSuccessMessage, setTestSuccessMessage] = useState(null);
  const [isTriggeringNow, setIsTriggeringNow] = useState(false);

  useEffect(() => {
    if (remarketingSettings) {
      setFormData({
        enabled: remarketingSettings.enabled ?? true,
        preferAudio: remarketingSettings.preferAudio ?? true,
        startHour: remarketingSettings.startHour ?? 8,
        endHour: remarketingSettings.endHour ?? 22,
        minJitterMinutes: remarketingSettings.minJitterMinutes ?? 2,
        maxJitterMinutes: remarketingSettings.maxJitterMinutes ?? 6,
        steps: remarketingSettings.steps && remarketingSettings.steps.length > 0 ? remarketingSettings.steps : formData.steps
      });
    }
    fetchStats();
  }, [remarketingSettings]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/remarketing');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (e) {
      console.error('Failed to fetch remarketing stats:', e);
    }
  };

  const handleSave = () => {
    onSave({ remarketing: formData });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleAddStep = () => {
    const newStepNum = formData.steps.length + 1;
    const newStep = {
      id: `step-${Date.now()}`,
      name: `${newStepNum}º Toque: Acompanhamento Personalizado`,
      delayMinutes: 2880, // 48h
      sendMode: 'audio',
      targetFunnel: 'ALL_UNPAID',
      audioText: 'Oi {nome}, tudo bem? Passando pra saber se você ainda quer ter acesso ao {produto} ou se ficou alguma dúvida pendente!',
      useAiGeneratedText: true,
      aiPromptInstruction: 'Fale de forma calorosa perguntando se o cliente ainda deseja aproveitar o método ou se precisa de esclarecimentos.'
    };
    setFormData((prev) => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }));
  };

  const handleRemoveStep = (index) => {
    setFormData((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateStep = (index, field, value) => {
    setFormData((prev) => {
      const updatedSteps = [...prev.steps];
      updatedSteps[index] = {
        ...updatedSteps[index],
        [field]: value
      };
      return { ...prev, steps: updatedSteps };
    });
  };

  // Preview synthetic audio in browser
  const handlePreviewAudio = async (step) => {
    if (playingStepId === step.id && currentAudio) {
      currentAudio.pause();
      setPlayingStepId(null);
      return;
    }

    setPreviewLoadingStepId(step.id);
    try {
      const sampleText = (step.audioText || '')
        .replace(/\{nome\}/gi, 'Maria')
        .replace(/\{produto\}/gi, product?.name || 'nosso método')
        .replace(/\{preco\}/gi, `R$ ${Number(product?.price || 47).toFixed(2)}`);

      const res = await fetch('/api/remarketing/preview-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sampleText })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na síntese');

      if (currentAudio) {
        currentAudio.pause();
      }

      const audio = new Audio(data.audioUrl);
      setCurrentAudio(audio);
      setPlayingStepId(step.id);

      audio.play();
      audio.onended = () => {
        setPlayingStepId(null);
      };
    } catch (err) {
      alert(`Falha ao sintetizar áudio: ${err.message}`);
    } finally {
      setPreviewLoadingStepId(null);
    }
  };

  // Send test voice note directly via WhatsApp
  const handleSendTestToPhone = async (stepId) => {
    const targetPhone = testPhones[stepId];
    if (!targetPhone || targetPhone.replace(/[^0-9]/g, '').length < 10) {
      alert('Por favor, informe um número de WhatsApp válido com DDD (ex: 5511999998888).');
      return;
    }

    setSendingTestStepId(stepId);
    try {
      const res = await fetch('/api/remarketing/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId, targetPhone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro no envio');

      setTestSuccessMessage({ stepId, text: `Áudio PTT enviado com sucesso para ${targetPhone}!` });
      setTimeout(() => setTestSuccessMessage(null), 4000);
    } catch (err) {
      alert(`Erro no disparo de teste: ${err.message}`);
    } finally {
      setSendingTestStepId(null);
    }
  };

  const handleTriggerNow = async () => {
    setIsTriggeringNow(true);
    try {
      const res = await fetch('/api/remarketing/trigger-now', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        fetchStats();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsTriggeringNow(false), 1500);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner / Master Switch */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(59, 130, 246, 0.2) 100%)',
              border: '1px solid rgba(6, 182, 212, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}>
              <RotateCcw size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Recuperação Automática & Remarketing
                </h2>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <Mic size={12} />
                  100% Áudio Humanizado (Fish Audio)
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                Dispara mensagens de voz autênticas no WhatsApp para leads que pararam de responder ou geraram PIX e não pagaram.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleTriggerNow}
              disabled={isTriggeringNow}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '9px 16px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#cbd5e1',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <RefreshCw size={14} className={isTriggeringNow ? 'animate-spin' : ''} />
              {isTriggeringNow ? 'Verificando...' : 'Verificar Fila Agora'}
            </button>

            <button
              onClick={handleSave}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)',
                transition: 'all 0.2s'
              }}
            >
              {savedSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
              {savedSuccess ? 'Salvo com Sucesso!' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

        {/* Master Active Switch & Live Queue Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          padding: '14px',
          borderRadius: '12px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          {/* Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block' }}>Status do Motor</span>
              <strong style={{ fontSize: '0.95rem', color: formData.enabled ? '#34d399' : '#f43f5e' }}>
                {formData.enabled ? 'Ativo & Monitorando' : 'Pausado'}
              </strong>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: formData.enabled ? '#10b981' : '#334155',
                transition: '.3s',
                borderRadius: '24px'
              }}>
                <span style={{
                  position: 'absolute',
                  content: '""',
                  height: '18px',
                  width: '18px',
                  left: formData.enabled ? '26px' : '4px',
                  bottom: '3px',
                  backgroundColor: 'white',
                  transition: '.3s',
                  borderRadius: '50%'
                }} />
              </span>
            </label>
          </div>

          {/* Prefer Audio Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block' }}>Preferência de Envio</span>
              <strong style={{ fontSize: '0.95rem', color: '#38bdf8' }}>
                {formData.preferAudio ? '100% Mensagem de Voz (PTT)' : 'Texto Padrão'}
              </strong>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.preferAudio}
                onChange={(e) => setFormData({ ...formData, preferAudio: e.target.checked })}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: formData.preferAudio ? '#06b6d4' : '#334155',
                transition: '.3s',
                borderRadius: '24px'
              }}>
                <span style={{
                  position: 'absolute',
                  content: '""',
                  height: '18px',
                  width: '18px',
                  left: formData.preferAudio ? '26px' : '4px',
                  bottom: '3px',
                  backgroundColor: 'white',
                  transition: '.3s',
                  borderRadius: '50%'
                }} />
              </span>
            </label>
          </div>

          {/* Queue Count */}
          <div style={{ padding: '0 8px', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block' }}>Leads em Monitoramento</span>
            <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>
              {stats?.totalEligible ?? 0} leads pendentes
            </strong>
          </div>

          {/* Operating Hours Status */}
          <div style={{ padding: '0 8px', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block' }}>Janela de Horário</span>
            <strong style={{ fontSize: '0.95rem', color: stats?.withinHours ? '#34d399' : '#f59e0b' }}>
              {stats?.withinHours ? '🟢 Aberto (Envios Liberados)' : '🌙 Noturno (Pausado até 08h)'}
            </strong>
          </div>
        </div>
      </div>

      {/* Safety & Anti-Ban Parameters */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '14px',
        padding: '20px'
      }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 14px 0' }}>
          <ShieldCheck size={18} color="#38bdf8" />
          Regras de Proteção de Conta & Horários Silenciosos
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Horário Inicial de Disparo
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                min="0"
                max="23"
                value={formData.startHour}
                onChange={(e) => setFormData({ ...formData, startHour: parseInt(e.target.value, 10) })}
                style={{
                  width: '80px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              />
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>:00 (Manhã)</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Não envia áudio antes deste horário</span>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Horário Limite Noturno
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                min="0"
                max="23"
                value={formData.endHour}
                onChange={(e) => setFormData({ ...formData, endHour: parseInt(e.target.value, 10) })}
                style={{
                  width: '80px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              />
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>:00 (Noite)</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Evita incomodar leads na madrugada</span>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Variação Humana Aleatória (Jitter Anti-Ban)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                min="1"
                max="15"
                value={formData.minJitterMinutes}
                onChange={(e) => setFormData({ ...formData, minJitterMinutes: parseInt(e.target.value, 10) })}
                style={{
                  width: '60px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              />
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>a</span>
              <input
                type="number"
                min="1"
                max="30"
                value={formData.maxJitterMinutes}
                onChange={(e) => setFormData({ ...formData, maxJitterMinutes: parseInt(e.target.value, 10) })}
                style={{
                  width: '60px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              />
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>minutos adicionais</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Impede disparos em minutos matemáticos exatos</span>
          </div>
        </div>
      </div>

      {/* Sequence Cards (Steps) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Funil de Recuperação em Áudio ({formData.steps.length} Etapas)
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Sequência progressiva disparada automaticamente conforme o tempo em que o lead ficou sem responder.
            </p>
          </div>
          <button
            onClick={handleAddStep}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              cursor: 'pointer'
            }}
          >
            <Plus size={14} />
            Adicionar Nova Etapa
          </button>
        </div>

        {formData.steps.map((step, index) => {
          const isPlaying = playingStepId === step.id;
          const isLoadingPreview = previewLoadingStepId === step.id;
          const isSendingTest = sendingTestStepId === step.id;
          const successMsg = testSuccessMessage?.stepId === step.id ? testSuccessMessage.text : null;

          return (
            <div
              key={step.id || index}
              style={{
                background: 'rgba(30, 41, 59, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                position: 'relative'
              }}
            >
              {/* Step Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={step.name}
                    onChange={(e) => handleUpdateStep(index, 'name', e.target.value)}
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: '#f8fafc',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px dashed rgba(255,255,255,0.2)',
                      padding: '2px 4px',
                      minWidth: '280px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Delay setting */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.6)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Clock size={13} color="#94a3b8" />
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Aguardar:</span>
                    <input
                      type="number"
                      min="1"
                      value={step.delayMinutes}
                      onChange={(e) => handleUpdateStep(index, 'delayMinutes', parseInt(e.target.value, 10))}
                      style={{
                        width: '55px',
                        background: 'transparent',
                        border: 'none',
                        color: '#38bdf8',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        textAlign: 'center'
                      }}
                    />
                    <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                      minutos ({step.delayMinutes >= 60 ? `${(step.delayMinutes / 60).toFixed(1)}h` : `${step.delayMinutes}m`})
                    </span>
                  </div>

                  {formData.steps.length > 1 && (
                    <button
                      onClick={() => handleRemoveStep(index)}
                      title="Excluir etapa"
                      style={{
                        background: 'rgba(244, 63, 94, 0.1)',
                        border: '1px solid rgba(244, 63, 94, 0.25)',
                        color: '#f43f5e',
                        padding: '6px',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Funnel Target & Delivery Format */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>
                    Público-Alvo desta Etapa
                  </label>
                  <select
                    value={step.targetFunnel}
                    onChange={(e) => handleUpdateStep(index, 'targetFunnel', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#f8fafc',
                      fontSize: '0.82rem'
                    }}
                  >
                    <option value="PIX_OR_ABANDONED">🎯 Quem recebeu o PIX ou Checkout e não pagou</option>
                    <option value="ALL_UNPAID">👥 Todos os leads pendentes (Não aprovados)</option>
                    <option value="NOVO_OU_CONVERSA">💬 Quem parou antes de receber a oferta</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>
                    Formato da Mensagem
                  </label>
                  <select
                    value={step.sendMode}
                    onChange={(e) => handleUpdateStep(index, 'sendMode', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#f8fafc',
                      fontSize: '0.82rem'
                    }}
                  >
                    <option value="audio">🎙️ Áudio Humanizado PTT (Voz Fish Audio)</option>
                    <option value="text">💬 Mensagem de Texto com Simulação de Digitação</option>
                  </select>
                </div>
              </div>

              {/* Dynamic NVIDIA NIM AI Generation vs Static Template */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={15} color="#a855f7" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0' }}>
                      Gerar Fala do Áudio com IA (NVIDIA NIM)
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      — Cria uma fala única e espontânea para cada lead
                    </span>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: '38px', height: '20px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={step.useAiGeneratedText}
                      onChange={(e) => handleUpdateStep(index, 'useAiGeneratedText', e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: step.useAiGeneratedText ? '#a855f7' : '#334155',
                      transition: '.3s',
                      borderRadius: '20px'
                    }}>
                      <span style={{
                        position: 'absolute',
                        content: '""',
                        height: '14px',
                        width: '14px',
                        left: step.useAiGeneratedText ? '20px' : '3px',
                        bottom: '3px',
                        backgroundColor: 'white',
                        transition: '.3s',
                        borderRadius: '50%'
                      }} />
                    </span>
                  </label>
                </div>

                {step.useAiGeneratedText && (
                  <div>
                    <label style={{ fontSize: '0.74rem', color: '#c084fc', display: 'block', marginBottom: '4px' }}>
                      Instrução para a IA gerar o áudio:
                    </label>
                    <input
                      type="text"
                      value={step.aiPromptInstruction}
                      onChange={(e) => handleUpdateStep(index, 'aiPromptInstruction', e.target.value)}
                      placeholder="Ex: Pergunte se o lead teve dificuldade no app do banco e ofereça auxílio..."
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        color: '#f8fafc',
                        fontSize: '0.82rem'
                      }}
                    />
                  </div>
                )}

                {/* Spoken script / Template */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                      {step.useAiGeneratedText ? 'Roteiro de Fallback (usado se a IA estiver sem saldo/offline):' : 'Roteiro Exato do Áudio:'}
                    </label>
                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                      Variáveis: {'{nome}'}, {'{produto}'}, {'{preco}'}, {'{chave_pix}'}
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={step.audioText}
                    onChange={(e) => handleUpdateStep(index, 'audioText', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#f8fafc',
                      fontSize: '0.82rem',
                      lineHeight: '1.4',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              {/* Actions: Audio Player in Browser + Send Test to WhatsApp */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                paddingTop: '6px',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)'
              }}>
                {/* Audio Preview Button */}
                <button
                  onClick={() => handlePreviewAudio(step)}
                  disabled={isLoadingPreview}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    background: isPlaying ? 'rgba(239, 68, 68, 0.2)' : 'rgba(6, 182, 212, 0.15)',
                    border: isPlaying ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(6, 182, 212, 0.4)',
                    color: isPlaying ? '#f87171' : '#38bdf8',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {isLoadingPreview ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : isPlaying ? (
                    <Pause size={13} />
                  ) : (
                    <Play size={13} />
                  )}
                  {isLoadingPreview ? 'Gerando Voz...' : isPlaying ? 'Pausar Áudio' : 'Ouvir Voz no Navegador'}
                </button>

                {/* Send Test to Phone */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Seu WhatsApp (ex: 5511999998888)"
                    value={testPhones[step.id] || ''}
                    onChange={(e) => setTestPhones({ ...testPhones, [step.id]: e.target.value })}
                    style={{
                      width: '210px',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#f8fafc',
                      fontSize: '0.75rem'
                    }}
                  />
                  <button
                    onClick={() => handleSendTestToPhone(step.id)}
                    disabled={isSendingTest}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      color: '#34d399',
                      cursor: 'pointer'
                    }}
                  >
                    {isSendingTest ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                    {isSendingTest ? 'Enviando...' : 'Enviar Teste'}
                  </button>
                </div>
              </div>

              {successMsg && (
                <div style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#34d399',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <CheckCircle2 size={13} />
                  <span>{successMsg}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
