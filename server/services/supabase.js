import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase = null;
let isConfigured = false;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
    isConfigured = true;
    console.log(`[Supabase] Conectado com sucesso ao projeto: ${supabaseUrl}`);
  } catch (err) {
    console.error('[Supabase] Erro ao instanciar cliente:', err);
  }
} else {
  console.log('[Supabase] Chaves SUPABASE_URL ou SUPABASE_KEY não configuradas no .env. Operando com armazenamento local de contingência.');
}

export class SupabaseService {
  constructor() {
    this.client = supabase;
    this.isConfigured = isConfigured;
  }

  getStatus() {
    return {
      isConfigured: this.isConfigured,
      url: supabaseUrl ? supabaseUrl.replace(/https:\/\/(.*?)\..*/, '$1') : null
    };
  }

  // --- Settings ---
  async getSettings() {
    if (!this.isConfigured) return null;
    try {
      const { data, error } = await this.client
        .from('zapix_settings')
        .select('data')
        .eq('id', 'global')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn('[Supabase] getSettings error:', error.message);
      }
      return data ? data.data : null;
    } catch (e) {
      console.warn('[Supabase] getSettings exception:', e.message);
      return null;
    }
  }

  async saveSettings(settingsData) {
    if (!this.isConfigured) return false;
    try {
      const { error } = await this.client
        .from('zapix_settings')
        .upsert({ id: 'global', data: settingsData, updated_at: new Date().toISOString() });

      if (error) console.warn('[Supabase] saveSettings error:', error.message);
      return !error;
    } catch (e) {
      console.warn('[Supabase] saveSettings exception:', e.message);
      return false;
    }
  }

  // --- Leads ---
  async getLeads() {
    if (!this.isConfigured) return null;
    try {
      const { data, error } = await this.client
        .from('zapix_leads')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('[Supabase] getLeads error:', error.message);
        return null;
      }
      return (data || []).map((row) => ({
        id: row.id,
        phone: row.phone,
        name: row.name,
        stage: row.stage,
        aiActive: row.ai_active,
        tags: row.tags || [],
        lastMessage: row.last_message,
        lastMessageFromMe: row.last_message_from_me,
        unreadCount: row.unread_count || 0,
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at)
      }));
    } catch (e) {
      console.warn('[Supabase] getLeads exception:', e.message);
      return null;
    }
  }

  async upsertLead(lead) {
    if (!this.isConfigured) return false;
    try {
      const payload = {
        id: lead.id || lead.phone,
        phone: lead.phone,
        name: lead.name || lead.phone,
        stage: lead.stage || 'NOVO',
        ai_active: lead.aiActive !== false,
        tags: lead.tags || [],
        last_message: lead.lastMessage || '',
        last_message_from_me: Boolean(lead.lastMessageFromMe),
        unread_count: lead.unreadCount || 0,
        created_at: lead.createdAt || Date.now(),
        updated_at: lead.updatedAt || Date.now()
      };

      const { error } = await this.client
        .from('zapix_leads')
        .upsert(payload, { onConflict: 'phone' });

      if (error) console.warn('[Supabase] upsertLead error:', error.message);
      return !error;
    } catch (e) {
      console.warn('[Supabase] upsertLead exception:', e.message);
      return false;
    }
  }

  async deleteLead(phone) {
    if (!this.isConfigured || !phone) return false;
    try {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const { error } = await this.client
        .from('zapix_leads')
        .delete()
        .or(`phone.eq.${phone},phone.eq.${cleanPhone}`);
      if (error) console.warn('[Supabase] deleteLead error:', error.message);
      return !error;
    } catch (e) {
      console.warn('[Supabase] deleteLead exception:', e.message);
      return false;
    }
  }

  async deleteMessagesByPhone(phone) {
    if (!this.isConfigured || !phone) return false;
    try {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const { error } = await this.client
        .from('zapix_messages')
        .delete()
        .or(`phone.eq.${phone},phone.eq.${cleanPhone}`);
      if (error) console.warn('[Supabase] deleteMessagesByPhone error:', error.message);
      return !error;
    } catch (e) {
      console.warn('[Supabase] deleteMessagesByPhone exception:', e.message);
      return false;
    }
  }

  // --- Messages ---
  async getMessages(phone) {
    if (!this.isConfigured) return null;
    try {
      let query = this.client
        .from('zapix_messages')
        .select('*')
        .order('timestamp', { ascending: true })
        .limit(300);

      if (phone) {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        query = query.ilike('phone', `%${cleanPhone}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('[Supabase] getMessages error:', error.message);
        return null;
      }

      return (data || []).map((row) => ({
        id: row.id,
        phone: row.phone,
        fromMe: Boolean(row.from_me),
        text: row.text,
        type: row.type,
        mediaUrl: row.media_url,
        audioDuration: row.audio_duration,
        status: row.status,
        timestamp: Number(row.timestamp)
      }));
    } catch (e) {
      console.warn('[Supabase] getMessages exception:', e.message);
      return null;
    }
  }

  async addMessage(msg) {
    if (!this.isConfigured) return false;
    try {
      const payload = {
        id: msg.id,
        phone: msg.phone,
        from_me: Boolean(msg.fromMe),
        text: msg.text || '',
        type: msg.type || 'text',
        media_url: msg.mediaUrl || null,
        audio_duration: msg.audioDuration || null,
        status: msg.status || 'delivered',
        timestamp: msg.timestamp || Date.now()
      };

      const { error } = await this.client
        .from('zapix_messages')
        .insert(payload);

      if (error) console.warn('[Supabase] addMessage error:', error.message);
      return !error;
    } catch (e) {
      console.warn('[Supabase] addMessage exception:', e.message);
      return false;
    }
  }

  // --- Deliverables ---
  async getDeliverables() {
    if (!this.isConfigured) return null;
    try {
      const { data, error } = await this.client
        .from('zapix_deliverables')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return null;
      return (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        filename: row.filename,
        type: row.type,
        tag: row.tag,
        description: row.description,
        url: row.url,
        path: row.path,
        size: Number(row.size) || 0,
        createdAt: Number(row.created_at)
      }));
    } catch (e) {
      return null;
    }
  }

  async addDeliverable(d) {
    if (!this.isConfigured) return false;
    try {
      const { error } = await this.client.from('zapix_deliverables').insert({
        id: d.id,
        name: d.name,
        filename: d.filename,
        type: d.type,
        tag: d.tag,
        description: d.description || '',
        url: d.url,
        path: d.path,
        size: d.size || 0,
        created_at: d.createdAt || Date.now()
      });
      return !error;
    } catch (e) {
      return false;
    }
  }

  async deleteDeliverable(id) {
    if (!this.isConfigured) return false;
    try {
      const { error } = await this.client.from('zapix_deliverables').delete().eq('id', id);
      return !error;
    } catch (e) {
      return false;
    }
  }

  // --- Sales ---
  async getSales() {
    if (!this.isConfigured) return null;
    try {
      const { data, error } = await this.client
        .from('zapix_sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return null;
      return (data || []).map((row) => ({
        id: row.id,
        leadId: row.lead_id,
        phone: row.phone,
        customerName: row.customer_name,
        amount: Number(row.amount),
        platform: row.platform,
        status: row.status,
        createdAt: Number(row.created_at)
      }));
    } catch (e) {
      return null;
    }
  }

  async addSale(sale) {
    if (!this.isConfigured) return false;
    try {
      const { error } = await this.client.from('zapix_sales').insert({
        id: sale.id,
        lead_id: sale.leadId || null,
        phone: sale.phone || null,
        customer_name: sale.customerName || 'Cliente',
        amount: sale.amount,
        platform: sale.platform || 'Kiwify',
        status: sale.status || 'approved',
        created_at: sale.createdAt || Date.now()
      });
      return !error;
    } catch (e) {
      return false;
    }
  }

  // --- System Logs ---
  async addLog(log) {
    if (!this.isConfigured) return false;
    try {
      await this.client.from('zapix_logs').insert({
        id: log.id,
        type: log.type,
        message: log.message,
        meta: log.meta ? JSON.stringify(log.meta) : null,
        timestamp: log.timestamp || Date.now()
      });
      return true;
    } catch (e) {
      return false;
    }
  }
}

export const supabaseService = new SupabaseService();
