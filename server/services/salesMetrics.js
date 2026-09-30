import axios from 'axios';
import { storage } from './storage.js';

class SalesMetricsService {
  // Calculate complete sales, conversion, and advertising analytics
  getMetrics() {
    const leads = storage.getLeads();
    const sales = storage.getSales();
    const settings = storage.getSettings();
    const metaConfig = settings.metaAds;

    const totalLeads = leads.length;
    const approvedSales = sales.filter((s) => s.status === 'approved');
    const totalSalesCount = approvedSales.length;
    const totalRevenue = approvedSales.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
    const averageTicket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;

    // Meta Ads Spend
    const totalAdSpend = Number(metaConfig.manualSpend) || 0;

    // Conversion rate: (Approved Sales / Total Leads) * 100
    const conversionRate = totalLeads > 0 ? (totalSalesCount / totalLeads) * 100 : 0;

    // CAC: Ad Spend / Sales
    const cac = totalSalesCount > 0 ? totalAdSpend / totalSalesCount : 0;

    // ROAS: Revenue / Ad Spend
    const roas = totalAdSpend > 0 ? totalRevenue / totalAdSpend : (totalRevenue > 0 ? 99 : 0);

    // Funnel distribution
    const funnel = {
      NOVO: leads.filter((l) => l.stage === 'NOVO').length,
      EM_CONVERSA: leads.filter((l) => l.stage === 'EM_CONVERSA').length,
      PITCH_ENVIADO: leads.filter((l) => l.stage === 'PITCH_ENVIADO').length,
      CHECKOUT: leads.filter((l) => l.stage === 'CHECKOUT').length,
      APROVADO: leads.filter((l) => l.stage === 'APROVADO').length,
      PERDIDO: leads.filter((l) => l.stage === 'PERDIDO').length
    };

    // Daily revenue for last 7 days chart
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

      const daySales = approvedSales.filter((s) => s.createdAt >= dayStart && s.createdAt < dayEnd);
      const dayRevenue = daySales.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
      const dayLeads = leads.filter((l) => (l.createdAt || 0) >= dayStart && (l.createdAt || 0) < dayEnd).length;

      last7Days.push({
        day: dayName,
        revenue: dayRevenue,
        salesCount: daySales.length,
        leadsCount: dayLeads
      });
    }

    return {
      summary: {
        totalLeads,
        totalSalesCount,
        totalRevenue,
        averageTicket,
        totalAdSpend,
        conversionRate,
        cac,
        roas
      },
      funnel,
      last7Days,
      metaSync: {
        adAccountId: metaConfig.adAccountId,
        lastSyncedAt: metaConfig.lastSyncedAt,
        isConfigured: Boolean(metaConfig.accessToken && metaConfig.adAccountId)
      }
    };
  }

  // Sync spend directly from Meta Ads Graph API
  async syncMetaAdsSpend() {
    const settings = storage.getSettings();
    const { accessToken, adAccountId } = settings.metaAds;

    if (!accessToken || !adAccountId) {
      throw new Error('Credenciais da Meta Ads (Access Token ou Ad Account ID) não configuradas.');
    }

    const cleanAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const url = `https://graph.facebook.com/v19.0/${cleanAccountId}/insights?fields=spend&date_preset=maximum&access_token=${accessToken}`;

    try {
      const response = await axios.get(url, { timeout: 15000 });
      if (response.data && response.data.data && response.data.data[0]) {
        const spend = parseFloat(response.data.data[0].spend) || 0;
        storage.updateSettings({
          metaAds: {
            manualSpend: spend,
            lastSyncedAt: Date.now()
          }
        });
        storage.addLog('SUCCESS', `Meta Ads sincronizado com sucesso! Gasto total: R$ ${spend.toFixed(2)}`);
        return spend;
      }
      throw new Error('Nenhum dado retornado da conta de anúncios da Meta.');
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message;
      storage.addLog('ERROR', `Falha ao sincronizar Meta Ads: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}

export const salesMetrics = new SalesMetricsService();
