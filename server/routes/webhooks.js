import { Router } from 'express';
import { storage } from '../services/storage.js';
import { whatsapp } from '../services/whatsapp.js';

const router = Router();

// Kiwify Webhook
router.post('/kiwify', (req, res) => {
  try {
    const body = req.body || {};
    const event = body.order_status || body.webhook_event_type;

    if (event === 'paid' || event === 'order_approved' || body.status === 'paid') {
      const phone = (body.Customer?.mobile || body.Customer?.phone || '').replace(/[^0-9]/g, '');
      const customerName = body.Customer?.full_name || body.Customer?.name || 'Cliente Kiwify';
      const amount = parseFloat(body.order_amount || body.Commissions?.charge_amount || 9700) / 100;

      storage.addSale({
        phone,
        customerName,
        amount: isNaN(amount) ? 97.00 : amount,
        platform: 'Kiwify',
        status: 'approved'
      });

      storage.addLog('SUCCESS', `Webhook Kiwify: Venda Aprovada R$ ${amount} (${customerName})`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error in Kiwify webhook:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Hotmart Webhook
router.post('/hotmart', (req, res) => {
  try {
    const body = req.body || {};
    const event = body.event;

    if (event === 'PURCHASE_APPROVED' || body.data?.purchase?.status === 'APPROVED') {
      const buyer = body.data?.buyer || {};
      const phone = (buyer.checkout_phone || buyer.phone || '').replace(/[^0-9]/g, '');
      const customerName = buyer.name || 'Cliente Hotmart';
      const amount = parseFloat(body.data?.purchase?.price?.value || 97.00);

      storage.addSale({
        phone,
        customerName,
        amount: isNaN(amount) ? 97.00 : amount,
        platform: 'Hotmart',
        status: 'approved'
      });

      storage.addLog('SUCCESS', `Webhook Hotmart: Venda Aprovada R$ ${amount} (${customerName})`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error in Hotmart webhook:', err);
    return res.status(500).json({ error: err.message });
  }
});

// PerfectPay Webhook
router.post('/perfectpay', (req, res) => {
  try {
    const body = req.body || {};
    const status = body.sale_status_enum_key || body.status;

    if (status === 'approved' || status === 'paid' || status === 2) {
      const phone = (body.customer?.phone_number || '').replace(/[^0-9]/g, '');
      const customerName = body.customer?.full_name || 'Cliente PerfectPay';
      const amount = parseFloat(body.sale_amount || 97.00);

      storage.addSale({
        phone,
        customerName,
        amount: isNaN(amount) ? 97.00 : amount,
        platform: 'PerfectPay',
        status: 'approved'
      });

      storage.addLog('SUCCESS', `Webhook PerfectPay: Venda Aprovada R$ ${amount} (${customerName})`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error in PerfectPay webhook:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Generic Webhook
router.post('/generic', (req, res) => {
  try {
    const body = req.body || {};
    const phone = (body.phone || '').replace(/[^0-9]/g, '');
    const amount = parseFloat(body.amount || body.value || 97.00);
    const platform = body.platform || 'Checkout Webhook';
    const customerName = body.name || body.customerName || 'Cliente';

    storage.addSale({
      phone,
      customerName,
      amount,
      platform,
      status: 'approved'
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// XPag Global Webhook (SPEI, PIX, OXXO, USDT)
router.post('/xpag', async (req, res) => {
  try {
    const body = req.body || {};
    storage.addLog(
      'INFO',
      `Webhook XPag recebido: Tipo=${body.type || 'cashin'} | Status=${body.status} | ID=${body.transaction_id || body.request_number || 'N/A'}`,
      body
    );

    const status = String(body.status || '').toLowerCase();
    const type = String(body.type || 'cashin').toLowerCase();

    // Respond HTTP 200 immediately to meet XPag SLA (< 5s)
    res.status(200).json({ received: true });

    // Handle Cash-In Approval (paid/confirmed/completed)
    if ((type === 'cashin' || !body.type) && (status === 'confirmed' || status === 'completed' || status === 'paid')) {
      const rawExternal = String(body.external_id || '');
      let phone = rawExternal.replace(/[^0-9]/g, '');

      // Check if externalId was mapped to an existing XPag charge
      let chargeData = storage.getXpagCharge(body.transaction_id) || storage.getXpagCharge(body.request_number) || storage.getXpagCharge(rawExternal);
      if (!phone && chargeData?.externalId) {
        phone = String(chargeData.externalId).replace(/[^0-9]/g, '');
      }

      const currency = String(body.currency || chargeData?.currency || 'MXN').toUpperCase();
      const amount = parseFloat(body.amount || chargeData?.amount || 0);
      const lead = phone ? storage.getLead(phone) : null;
      const customerName = lead?.name || body.payer?.name || chargeData?.raw?.name || 'Cliente XPag';

      // 1. Add Sale
      const newSale = storage.addSale({
        phone: phone || '',
        customerName,
        amount: isNaN(amount) || amount <= 0 ? 150.00 : amount,
        platform: `XPag (${currency})`,
        status: 'approved'
      });

      storage.addLog('SUCCESS', `🎉 Venda XPag APROVADA! ${currency} ${newSale.amount.toFixed(2)} - ${customerName} (${phone || 'Sem fone'})`);

      // 2. Mark lead as APROVADO
      if (phone) {
        storage.upsertLead(phone, {
          stage: 'APROVADO',
          lastReceiptStatus: 'APROVADO',
          lastReceiptAmount: amount,
          lastReceiptBank: body.bank_name || 'XPag Gateway',
          lastReceiptDate: Date.now()
        });
        whatsapp.emit('lead:updated', storage.getLead(phone));

        // 3. Auto-deliver products via WhatsApp if connected!
        if (whatsapp.status === 'connected') {
          const isSpanish = currency === 'MXN' || currency === 'COP' || lead?.phone?.startsWith('52') || lead?.phone?.startsWith('57');
          const congratsText = isSpanish
            ? `¡Muchísimas gracias por tu pago! ❤️ Tu acceso ha sido confirmado con éxito.\n\nAquí tienes todo tu material completo para que lo descargues y lo disfrutes. ¡Cualquier duda que tengas, aquí sigo a la orden!`
            : `Pagamento confirmado com sucesso! ❤️ Muito obrigado pelo carinho e pela confiança!\n\nSegue o seu material completo para download. Qualquer dúvida estou à disposição!`;

          setTimeout(async () => {
            try {
              await whatsapp.sendManualMessage(phone, congratsText, 'text');
              const deliverables = storage.getDeliverables();
              for (const deliv of deliverables) {
                await whatsapp.sendManualMessage(phone, `[ENVIAR_ARQUIVO: ${deliv.tag}]`, 'deliverable');
                await new Promise(r => setTimeout(r, 1500));
              }
            } catch (deliverErr) {
              console.error('[XPag Webhook Auto-Deliver Error]:', deliverErr);
            }
          }, 1000);
        }
      }
    }
  } catch (err) {
    console.error('Error in XPag webhook:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message });
    }
  }
});

export default router;
