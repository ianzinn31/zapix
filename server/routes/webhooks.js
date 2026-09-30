import { Router } from 'express';
import { storage } from '../services/storage.js';

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

export default router;
