import React, { useState } from 'react';
import { 
  Megaphone, 
  RefreshCw, 
  DollarSign, 
  Save, 
  CheckCircle2, 
  Copy, 
  Check, 
  ExternalLink,
  Webhook
} from 'lucide-react';

export default function MetaAdsConfig({ metaSettings, onSave, onSyncMeta, isSyncing }) {
  const [formData, setFormData] = useState({
    accessToken: metaSettings?.accessToken || '',
    adAccountId: metaSettings?.adAccountId || '',
    manualSpend: metaSettings?.manualSpend ?? 0,
    autoSync: metaSettings?.autoSync ?? false
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(null);

  const origin = window.location.origin;
  const webhooks = [
    { platform: 'Kiwify', url: `${origin}/webhooks/kiwify`, hint: 'Cole na aba Webhooks do produto na Kiwify com evento "Pedido Pago"' },
    { platform: 'Hotmart', url: `${origin}/webhooks/hotmart`, hint: 'Cole nas Configurações de Webhook da Hotmart com evento "Compra Aprovada"' },
    { platform: 'PerfectPay', url: `${origin}/webhooks/perfectpay`, hint: 'Cole nas Notificações da PerfectPay com status "Aprovado"' },
    { platform: 'Checkout Genérico', url: `${origin}/webhooks/generic`, hint: 'Dispare via POST com { phone, amount, customerName }' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ metaAds: formData });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const copyUrl = (url, platform) => {
    navigator.clipboard.writeText(url);
    setCopiedWebhook(platform);
    setTimeout(() => setCopiedWebhook(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Meta Ads API Configuration Card */}
      <form onSubmit={handleSubmit}>
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div className="flex items-center gap-3">
              <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.15)', borderRadius: '10px', color: '#60a5fa' }}>
                <Megaphone size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                  Meta Ads (Gastos de Anúncios)
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Puxe os gastos com anúncios do Facebook/Instagram para calcular o CAC e o ROAS exatos do infoproduto.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSyncMeta}
                disabled={isSyncing}
                className="btn-secondary"
              >
                <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
                <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Gastos'}</span>
              </button>

              <button type="submit" className="btn-primary">
                {savedSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
                <span>{savedSuccess ? 'Salvo!' : 'Salvar Configuração'}</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Meta Access Token (Graph API)
              </label>
              <input
                type="password"
                placeholder="EAAB..."
                value={formData.accessToken}
                onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                className="input-field"
                style={{ fontSize: '0.84rem' }}
              />
              <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                Token de acesso do Meta Developers ou Gerenciador de Negócios.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                ID da Conta de Anúncios (Ad Account ID)
              </label>
              <input
                type="text"
                placeholder="act_1234567890 ou 1234567890"
                value={formData.adAccountId}
                onChange={(e) => setFormData({ ...formData, adAccountId: e.target.value })}
                className="input-field"
                style={{ fontSize: '0.84rem' }}
              />
              <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                Encontrado na URL do Gerenciador de Anúncios da Meta.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Gasto Atual com Anúncios (R$) - Ajuste Direto
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.manualSpend}
                onChange={(e) => setFormData({ ...formData, manualSpend: parseFloat(e.target.value) })}
                className="input-field"
                style={{ fontSize: '0.84rem' }}
                required
              />
              <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                Pode ser atualizado manualmente para calcular métricas mesmo sem a API da Meta vinculada.
              </p>
            </div>
          </div>

          {metaSettings?.lastSyncedAt && (
            <div style={{ fontSize: '0.75rem', color: '#10b981' }}>
              ✓ Última sincronização bem-sucedida: {new Date(metaSettings.lastSyncedAt).toLocaleString('pt-BR')}
            </div>
          )}
        </div>
      </form>

      {/* Webhooks Integration Card */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '10px', color: '#10b981' }}>
            <Webhook size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
              Webhooks de Conversão Automática
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Conecte sua plataforma de vendas para que o Zapix registre compras aprovadas e atualize o faturamento em tempo real.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {webhooks.map((wh) => (
            <div
              key={wh.platform}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '14px 16px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>
                    {wh.platform}
                  </span>
                  <span className="badge badge-aprovado" style={{ fontSize: '0.65rem' }}>
                    POST JSON
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                  {wh.hint}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <code style={{ background: '#090d16', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', color: '#38bdf8' }}>
                  {wh.url}
                </code>
                <button
                  type="button"
                  onClick={() => copyUrl(wh.url, wh.platform)}
                  className="btn-secondary"
                  style={{ padding: '6px 10px' }}
                  title="Copiar URL do Webhook"
                >
                  {copiedWebhook === wh.platform ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
