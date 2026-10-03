import axios from 'axios';
import { storage } from './storage.js';

class XpagService {
  constructor() {
    this.baseUrl = 'https://api.xpag.global';
    // Sandbox default testing credentials if none configured
    this.sandboxDefaultClientId = 'xpagsandbox_00000000';
    this.sandboxDefaultClientSecret = '202620262026202620262026';
  }

  // Get current active credentials & environment from settings
  getConfig() {
    const settings = storage.getSettings();
    const product = settings.product || {};
    const gateways = settings.gateways || {};
    const xpagConfig = gateways.xpag || {};

    const environment = xpagConfig.environment || product.xpagEnvironment || 'production';
    const isSandbox = environment === 'sandbox';

    let clientId = xpagConfig.clientId || product.xpagClientId || product.xpagApiKey || process.env.XPAG_CLIENT_ID || '';
    let clientSecret = xpagConfig.clientSecret || product.xpagClientSecret || process.env.XPAG_CLIENT_SECRET || '';

    // If sandbox and no custom keys provided, fallback to standard sandbox testing keys
    if (isSandbox && (!clientId || !clientSecret)) {
      clientId = clientId || this.sandboxDefaultClientId;
      clientSecret = clientSecret || this.sandboxDefaultClientSecret;
    }

    const enabled = xpagConfig.enabled ?? (Boolean(clientId && clientSecret) || product.targetCountry === 'México');

    return {
      enabled,
      environment,
      isSandbox,
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      webhookUrl: xpagConfig.webhookUrl || `${process.env.APP_URL || 'https://api.xpag.global'}/webhooks/xpag`,
      autoCreateChargeOnPitch: xpagConfig.autoCreateChargeOnPitch ?? true
    };
  }

  getHeaders(customConfig = null) {
    const config = customConfig || this.getConfig();
    return {
      'X-Client-Id': config.clientId,
      'X-Client-Secret': config.clientSecret,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  isConfigured() {
    const config = this.getConfig();
    return Boolean(config.clientId && config.clientSecret);
  }

  /**
   * Cash-in (Create charge)
   * Supports:
   * - MXN: SPEI (CLABE / Bank STP) or OXXO (barcode)
   * - BRL: PIX (Dynamic QR Code + Copia e Cola)
   * - USDT: TRC-20 Address
   */
  async createCashIn({
    currency = 'MXN',
    amount,
    externalId,
    name = 'Cliente',
    document = '',
    description = 'Acceso Infoproducto',
    method = null, // e.g. 'SPEI', 'OXXO'
    payerData = null,
    webhookUrl = null,
    splits = null
  }) {
    const config = this.getConfig();
    if (!this.isConfigured()) {
      throw new Error('XPag credentials not configured (X-Client-Id / X-Client-Secret missing).');
    }

    const finalAmount = Number(amount);
    if (!finalAmount || isNaN(finalAmount) || finalAmount <= 0) {
      throw new Error(`Invalid amount: ${amount}`);
    }

    const cleanCurrency = String(currency || 'MXN').toUpperCase();
    const cleanExternalId = String(externalId || `lead_${Date.now()}`);

    const payload = {
      currency: cleanCurrency,
      amount: finalAmount,
      external_id: cleanExternalId,
      description: description || 'Acceso al programa'
    };

    if (webhookUrl) {
      payload.webhook_url = webhookUrl;
    }

    if (name) payload.name = name;
    if (document) payload.document = document;

    // Currency-specific parameters
    if (cleanCurrency === 'MXN') {
      if (method === 'OXXO') {
        payload.method = 'OXXO';
        if (payerData) payload.payerData = payerData;
      } else {
        payload.method = 'SPEI';
      }
    } else if (cleanCurrency === 'BRL') {
      if (splits && Array.isArray(splits)) {
        payload.splits = splits;
      }
    }

    try {
      storage.addLog('INFO', `[XPag CashIn] Criando cobrança de ${cleanCurrency} ${finalAmount} para ${cleanExternalId}...`);

      const response = await axios.post(`${this.baseUrl}/cashin`, payload, {
        headers: this.getHeaders(config),
        timeout: 15000
      });

      const data = response.data || {};

      // Enrich result with normalized attributes
      const normalizedResult = {
        success: data.ok !== false,
        raw: data,
        transactionId: data.transaction_id || data.request_number || data.id,
        requestNumber: data.request_number || data.transaction_id,
        externalId: cleanExternalId,
        currency: cleanCurrency,
        amount: data.amount || finalAmount,
        status: data.status || 'pending',
        // SPEI fields (Mexico)
        clabe: data.clabe || null,
        bankName: data.bank_name || 'STP (Sistema de Transferencia y Pagos)',
        reference: data.reference || null,
        beneficiary: data.beneficiary || 'Oficial',
        // PIX fields (Brazil)
        pixCopyPaste: data.copyPaste || data.pix_copia_cola || data.code || null,
        pixQrImage: data.qr_img || data.qr_code_url || null,
        // OXXO fields (Mexico)
        oxxoBarcode: data.barcode || null,
        // USDT fields
        usdtAddress: data.address || null,
        usdtNetwork: data.network || 'TRON',
        createdAt: Date.now()
      };

      // Save charge to storage memory for reconciliation
      storage.saveXpagCharge(cleanExternalId, normalizedResult);

      storage.addLog(
        'SUCCESS',
        `[XPag CashIn] Cobrança gerada com sucesso! ID: ${normalizedResult.transactionId} | Moeda: ${cleanCurrency} ${finalAmount} ${normalizedResult.clabe ? `| CLABE: ${normalizedResult.clabe}` : ''}`
      );

      return normalizedResult;
    } catch (err) {
      const errDetails = err.response?.data?.message || err.response?.data?.error || err.message;
      storage.addLog('ERROR', `[XPag CashIn Error]: ${errDetails}`, { payload, response: err.response?.data });
      throw new Error(`Falha ao gerar cobrança na XPag: ${errDetails}`);
    }
  }

  /**
   * Cash-out (Saques / Repasses)
   */
  async createCashOut(params) {
    const config = this.getConfig();
    if (!this.isConfigured()) {
      throw new Error('XPag credentials not configured.');
    }

    try {
      const response = await axios.post(`${this.baseUrl}/cashout`, params, {
        headers: this.getHeaders(config),
        timeout: 15000
      });
      return response.data;
    } catch (err) {
      const errDetails = err.response?.data?.message || err.response?.data?.error || err.message;
      throw new Error(`Falha ao solicitar cashout na XPag: ${errDetails}`);
    }
  }

  /**
   * Get real-time balance for all supported currencies (BRL, MXN, USDT, COP)
   */
  async getBalance() {
    const config = this.getConfig();
    if (!this.isConfigured()) {
      return {
        ok: false,
        error: 'Credenciais XPag não configuradas',
        balances: {
          BRL: { available: 0, blocked: 0 },
          MXN: { available: 0, blocked: 0 },
          USDT: { available: 0, blocked: 0 }
        }
      };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/balance`, {
        headers: this.getHeaders(config),
        timeout: 10000
      });
      return response.data;
    } catch (err) {
      const errDetails = err.response?.data?.message || err.response?.data?.error || err.message;
      return {
        ok: false,
        error: errDetails,
        status: err.response?.status
      };
    }
  }

  /**
   * Consult transaction by request_number, transaction_id, external_id or clabe
   */
  async consultTransaction(query = {}) {
    const config = this.getConfig();
    if (!this.isConfigured()) {
      throw new Error('XPag credentials not configured.');
    }

    const params = new URLSearchParams();
    if (query.requestNumber) params.append('request_number', query.requestNumber);
    if (query.transactionId) params.append('transaction_id', query.transactionId);
    if (query.externalId) params.append('external_id', query.externalId);
    if (query.clabe) params.append('clabe', query.clabe);

    try {
      const response = await axios.get(`${this.baseUrl}/consult-transaction?${params.toString()}`, {
        headers: this.getHeaders(config),
        timeout: 10000
      });
      return response.data;
    } catch (err) {
      const errDetails = err.response?.data?.message || err.response?.data?.error || err.message;
      throw new Error(`Erro ao consultar transação na XPag: ${errDetails}`);
    }
  }

  /**
   * Test connection to XPag with current or custom credentials
   */
  async testConnection(customConfig = null) {
    const config = customConfig || this.getConfig();
    if (!config.clientId || !config.clientSecret) {
      return {
        success: false,
        message: 'Client ID ou Client Secret ausentes. Preencha os campos para testar.'
      };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/balance`, {
        headers: this.getHeaders(config),
        timeout: 10000
      });

      if (response.data && response.data.ok !== false) {
        return {
          success: true,
          message: 'Conexão com a XPag estabelecida com sucesso!',
          environment: config.environment,
          balances: response.data.balances || {}
        };
      }
      return {
        success: false,
        message: 'A API respondeu mas retornou status não confirmado.',
        data: response.data
      };
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      let msg = err.message;
      if (status === 401 || status === 403) {
        msg = 'Credenciais inválidas: X-Client-Id ou X-Client-Secret incorretos.';
      } else if (data?.message) {
        msg = data.message;
      }
      return {
        success: false,
        status,
        message: msg
      };
    }
  }

  /**
   * Simulate a payment in Sandbox mode
   * POST /sandbox/simulate { "transaction_id": "pr_...", "outcome": "paid" }
   */
  async simulateSandboxPayment(transactionId, outcome = 'paid') {
    const config = this.getConfig();
    try {
      const response = await axios.post(
        `${this.baseUrl}/sandbox/simulate`,
        { transaction_id: transactionId, outcome },
        { headers: this.getHeaders(config), timeout: 10000 }
      );
      return response.data;
    } catch (err) {
      const errDetails = err.response?.data?.message || err.response?.data?.error || err.message;
      throw new Error(`Falha ao simular pagamento sandbox: ${errDetails}`);
    }
  }
}

export const xpagService = new XpagService();
