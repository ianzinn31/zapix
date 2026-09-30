import React from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Megaphone, 
  Percent, 
  Target, 
  Activity,
  Terminal,
  CheckCircle2
} from 'lucide-react';

export default function DashboardOverview({ metrics, sales, logs, onSyncMeta, isSyncingMeta }) {
  const summary = metrics?.summary || {
    totalLeads: 0,
    totalSalesCount: 0,
    totalRevenue: 0,
    averageTicket: 0,
    totalAdSpend: 0,
    conversionRate: 0,
    cac: 0,
    roas: 0
  };

  const funnel = metrics?.funnel || {
    NOVO: 0,
    EM_CONVERSA: 0,
    PITCH_ENVIADO: 0,
    CHECKOUT: 0,
    APROVADO: 0,
    PERDIDO: 0
  };

  const last7Days = metrics?.last7Days || [];
  const maxDayRevenue = Math.max(...last7Days.map((d) => d.revenue || 0), 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 6 Key KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px'
      }}>
        {/* 1. Faturamento Total */}
        <div className="glass-card" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '80px',
            height: '80px',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)',
            borderRadius: '50%'
          }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Faturamento Aprovado
            </span>
            <div style={{ padding: '6px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '8px', color: '#10b981', display: 'flex' }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
            R$ {Number(summary.totalRevenue).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#34d399' }}>
            <TrendingUp size={13} />
            <span>Ticket Médio: R$ {Number(summary.averageTicket).toFixed(2)}</span>
          </div>
        </div>

        {/* 2. Vendas Aprovadas */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Vendas Aprovadas
            </span>
            <div style={{ padding: '6px', background: 'rgba(59, 130, 246, 0.15)', borderRadius: '8px', color: '#60a5fa', display: 'flex' }}>
              <ShoppingCart size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc' }}>
            {summary.totalSalesCount} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#94a3b8' }}>pedidos</span>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>
            Kiwify / Hotmart / PerfectPay
          </div>
        </div>

        {/* 3. Gastos com Anúncios (Meta Ads) */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Gasto Meta Ads
            </span>
            <div style={{ padding: '6px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '8px', color: '#fbbf24', display: 'flex' }}>
              <Megaphone size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc' }}>
            R$ {Number(summary.totalAdSpend).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              {metrics?.metaSync?.isConfigured ? 'Integrado API' : 'Valor Definido'}
            </span>
            <button
              onClick={onSyncMeta}
              disabled={isSyncingMeta}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#60a5fa',
                fontSize: '0.74rem',
                cursor: 'pointer',
                fontWeight: 600,
                textDecoration: 'underline'
              }}
            >
              {isSyncingMeta ? 'Sincronizando...' : 'Atualizar'}
            </button>
          </div>
        </div>

        {/* 4. Taxa de Conversão */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Taxa de Conversão
            </span>
            <div style={{ padding: '6px', background: 'rgba(236, 72, 153, 0.15)', borderRadius: '8px', color: '#f472b6', display: 'flex' }}>
              <Percent size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc' }}>
            {Number(summary.conversionRate).toFixed(1)}%
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>
            {summary.totalLeads} leads no WhatsApp
          </div>
        </div>

        {/* 5. CAC (Custo por Aquisição) */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              CAC Médio
            </span>
            <div style={{ padding: '6px', background: 'rgba(139, 92, 246, 0.15)', borderRadius: '8px', color: '#c084fc', display: 'flex' }}>
              <Target size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc' }}>
            R$ {Number(summary.cac).toFixed(2)}
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>
            Custo p/ venda aprovada
          </div>
        </div>

        {/* 6. ROAS */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              ROAS (Retorno)
            </span>
            <div style={{ padding: '6px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '8px', color: '#34d399', display: 'flex' }}>
              <Activity size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: summary.roas >= 1.5 ? '#34d399' : '#f8fafc' }}>
            {Number(summary.roas).toFixed(2)}x
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>
            Multiplicador sobre anúncios
          </div>
        </div>
      </div>

      {/* Middle Row: Funnel + 7 Days Performance */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '16px'
      }}>
        {/* Funil Visual de Conversão */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              Funil de Vendas do WhatsApp
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Status dos Leads
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { key: 'NOVO', label: '1. Novos Leads Chegados', count: funnel.NOVO, color: '#60a5fa' },
              { key: 'EM_CONVERSA', label: '2. Em Atendimento Ativo', count: funnel.EM_CONVERSA, color: '#c084fc' },
              { key: 'PITCH_ENVIADO', label: '3. Apresentação & Áudio Enviado', count: funnel.PITCH_ENVIADO, color: '#fbbf24' },
              { key: 'CHECKOUT', label: '4. Link de Checkout Aberto', count: funnel.CHECKOUT, color: '#f472b6' },
              { key: 'APROVADO', label: '5. Venda Fechada / Aprovada', count: funnel.APROVADO, color: '#34d399' }
            ].map((step) => {
              const total = Math.max(summary.totalLeads, 1);
              const pct = Math.min(Math.round((step.count / total) * 100), 100);

              return (
                <div key={step.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{step.label}</span>
                    <span style={{ fontWeight: 700, color: step.color }}>
                      {step.count} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.max(pct, step.count > 0 ? 8 : 0)}%`,
                      backgroundColor: step.color,
                      borderRadius: '4px',
                      transition: 'width 0.4s ease'
                    }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gráfico de Faturamento dos Últimos 7 Dias */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              Performance Últimos 7 Dias
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Receita diária
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '8px',
            height: '150px',
            paddingTop: '16px'
          }}>
            {last7Days.map((item, i) => {
              const heightPct = Math.max((item.revenue / maxDayRevenue) * 100, 10);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                    {item.revenue > 0 ? `R$${item.revenue}` : '-'}
                  </span>
                  <div style={{
                    width: '100%',
                    height: `${heightPct}%`,
                    maxHeight: '110px',
                    background: item.revenue > 0 
                      ? 'linear-gradient(180deg, #10b981 0%, rgba(16, 185, 129, 0.25) 100%)' 
                      : 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '6px 6px 2px 2px',
                    transition: 'all 0.3s'
                  }}></div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    {item.day.split(',')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Row: Real-time Sales Feed + Logs Terminal */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '16px'
      }}>
        {/* Vendas Aprovadas Feed */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} color="#10b981" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                Vendas Aprovadas em Tempo Real
              </h3>
            </div>
            <span className="badge badge-aprovado">
              {sales.length} Aprovadas
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
            {sales.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.82rem', textAlign: 'center', padding: '24px' }}>
                Nenhuma venda registrada ainda. As vendas aprovadas via webhook (Kiwify, Hotmart, PerfectPay) aparecerão aqui automaticamente.
              </p>
            ) : (
              sales.map((sale) => (
                <div
                  key={sale.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'rgba(255, 255, 255, 0.025)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.84rem', color: '#f8fafc' }}>
                        {sale.customerName}
                      </span>
                      <span style={{
                        fontSize: '0.65rem',
                        padding: '1px 5px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#34d399',
                        borderRadius: '4px',
                        fontWeight: 700
                      }}>
                        {sale.platform}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {sale.phone || 'Checkout Direto'} • {new Date(sale.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#34d399' }}>
                      + R$ {Number(sale.amount).toFixed(2)}
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                      Aprovado
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Terminal de Eventos do Sistema */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={16} color="#06b6d4" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                Logs do Agente & Fallback
              </h3>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Tempo Real
            </span>
          </div>

          <div style={{
            flex: 1,
            maxHeight: '260px',
            overflowY: 'auto',
            background: '#090d16',
            borderRadius: '8px',
            padding: '10px 12px',
            fontFamily: 'Consolas, monospace',
            fontSize: '0.75rem',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            {logs.length === 0 ? (
              <span style={{ color: '#475569' }}>Nenhum log registrado.</span>
            ) : (
              logs.map((log) => {
                let badgeColor = '#94a3b8';
                if (log.type === 'SUCCESS') badgeColor = '#34d399';
                if (log.type === 'WARNING' || log.type === 'FALLBACK_TRIGGERED') badgeColor = '#fbbf24';
                if (log.type === 'ERROR') badgeColor = '#f43f5e';

                return (
                  <div key={log.id} style={{ display: 'flex', gap: '8px', lineHeight: 1.35 }}>
                    <span style={{ color: '#475569', flexShrink: 0 }}>
                      {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span style={{ color: badgeColor, fontWeight: 700, flexShrink: 0 }}>
                      [{log.type}]
                    </span>
                    <span style={{ color: '#cbd5e1', wordBreak: 'break-word' }}>
                      {log.message}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
