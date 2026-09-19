import * as db from '../db';
import { cfg } from '../config';
import { eq, isIn } from '../store';
import * as orders from './orders';
import * as customers from './customers';
import * as instagram from '../integrations/instagram';
import { trackingUrl, MESSAGE_KIND_LABELS } from '../constants';
import { now, firstName, httpError } from '../utils';
import type { Customer, Message, Order, OrderFull } from '../types';

export const DEFAULT_TEMPLATES: Record<string, { label: string; text: string }> = {
  siparis_alindi: {
    label: 'Sipariş alındı',
    text: 'Merhaba {{ad}} 🌸\n\nSiparişinizi aldık, sipariş numaranız: {{siparis_no}} 📝\nHazırlanıp kargoya verildiğinde sizi buradan bilgilendireceğiz.\n\n{{isletme}} 🧡',
  },
  kargo_bildirimi: {
    label: 'Kargoya verildi bildirimi',
    text: 'Merhaba {{ad}} 🌸\n\n{{siparis_no}} numaralı siparişiniz DHL eCommerce ile kargoya verildi 📦\n\nTakip numaranız: {{takip_no}}\nTakip linki: {{takip_link}}\n\nBizi tercih ettiğiniz için teşekkür ederiz 🧡\n{{isletme}}',
  },
  memnuniyet: {
    label: 'Teslimat sonrası memnuniyet sorusu',
    text: 'Merhaba {{ad}} 🌸\n\n{{siparis_no}} numaralı siparişinizin teslim edildiğini gördük 🎉\nÜrünlerinizden memnun kaldınız mı? Görüşleriniz bizim için çok değerli 🧡\n\n{{isletme}}',
  },
};

export const PLACEHOLDERS: Record<string, string> = {
  ad: 'Müşterinin adı (ilk isim)',
  ad_soyad: 'Müşterinin adı soyadı',
  siparis_no: 'Sipariş numarası',
  takip_no: 'DHL takip numarası',
  takip_link: 'DHL takip linki',
  urunler: 'Sipariş içeriği',
  tutar: 'Sipariş toplamı',
  isletme: 'İşletme adı',
};

/** Otomatik mesaj anahtarları (Ayarlar'dan açılıp kapatılır). Varsayılan: hepsi kapalı; mesajlar elle gönderilir. */
export const AUTO_DEFAULTS: Record<string, boolean> = { auto_siparis_alindi: false, auto_kargo_bildirimi: false, auto_memnuniyet: false };
export const AUTO_LABELS: Record<string, string> = {
  auto_siparis_alindi: 'Sipariş oluşturulunca "Sipariş alındı" mesajını otomatik gönder',
  auto_kargo_bildirimi: 'Kargoya verilince kargo bildirimini otomatik gönder',
  auto_memnuniyet: 'Teslim edilince memnuniyet sorusunu otomatik gönder (kapalıysa sipariş detayından elle gönderirsiniz)',
};

export async function getAutoFlags(): Promise<Record<string, boolean>> {
  const saved = await db.getSettings(Object.keys(AUTO_DEFAULTS));
  const out: Record<string, boolean> = {};
  for (const [k, d] of Object.entries(AUTO_DEFAULTS)) {
    const v = saved.get(k);
    out[k] = v == null ? d : v === '1';
  }
  return out;
}

export async function setAutoFlag(key: string, value: boolean): Promise<void> {
  if (!(key in AUTO_DEFAULTS)) throw httpError(400, 'Bilinmeyen ayar');
  await db.setSetting(key, value ? '1' : '0');
}

/** Memnuniyet sorusu gönderildiğinde (veya elle gönderildi işaretlendiğinde) siparişi "cevap bekleniyor" durumuna alır. */
export async function markSatisfactionAsked(orderId: number): Promise<void> {
  const o = await orders.getRaw(orderId);
  if (!o || o.satisfaction) return;
  await db.store().update('orders', [eq('id', orderId)], { satisfaction: 'bekleniyor', satisfaction_asked_at: now(), updated_at: now() });
}

export async function getTemplates(): Promise<Record<string, { label: string; text: string; default: string }>> {
  const saved = await db.getSettings(Object.keys(DEFAULT_TEMPLATES).map((k) => `template:${k}`));
  const out: Record<string, { label: string; text: string; default: string }> = {};
  for (const [k, v] of Object.entries(DEFAULT_TEMPLATES)) out[k] = { label: v.label, text: saved.get(`template:${k}`) || v.text, default: v.text };
  return out;
}

export async function setTemplate(kind: string, text: string): Promise<void> {
  if (!DEFAULT_TEMPLATES[kind]) throw httpError(400, 'Bilinmeyen şablon');
  const t = String(text || '').trim();
  await db.setSetting(`template:${kind}`, t || DEFAULT_TEMPLATES[kind].text);
}

export function render(text: string, ctx: Record<string, unknown>): string {
  return String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => (ctx[k] != null ? String(ctx[k]) : ''));
}

export function buildContext(order: Order, customer: Customer | null) {
  const c = customer || ({} as Partial<Customer>);
  return {
    ad: firstName(c.name) || (c.ig_username ? '@' + c.ig_username : 'değerli müşterimiz'),
    ad_soyad: c.name || (c.ig_username ? '@' + c.ig_username : ''),
    siparis_no: '#' + order.order_no,
    takip_no: order.dhl_tracking_no || '',
    takip_link: order.dhl_tracking_no ? trackingUrl(order.dhl_tracking_no) : '',
    urunler: order.items || '',
    tutar: order.total ? '₺' + Number(order.total).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '',
    isletme: cfg.business.name,
  };
}

export async function renderForOrder(order: Order | OrderFull, kind: string, customText?: string | null): Promise<string> {
  const customer = (order as OrderFull).customer || (await customers.get(order.customer_id));
  const tpl = customText != null && String(customText).trim() ? customText : (await getTemplates())[kind].text;
  return render(tpl, buildContext(order, customer));
}

function parseAttachments(m: Message & { attachments: unknown }): Message {
  let attachments: Message['attachments'] = [];
  if (Array.isArray(m.attachments)) attachments = m.attachments as Message['attachments'];
  else { try { attachments = JSON.parse(String(m.attachments || '[]')); } catch { attachments = []; } }
  return { ...m, attachments };
}

export async function saveMessage(m: Partial<Message> & { customer_id: number; direction: 'in' | 'out' }): Promise<Message> {
  const row = await db.store().insert<Message & { attachments: string }>('messages', {
    customer_id: m.customer_id, order_id: m.order_id || null, direction: m.direction, channel: m.channel || 'instagram', ig_mid: m.ig_mid || null,
    text: m.text || '', attachments: JSON.stringify(m.attachments || []), status: m.status || 'ok', error: m.error || null, kind: m.kind || null,
    is_read: m.is_read ? 1 : 0, created_at: m.created_at || now(),
  });
  return parseAttachments(row);
}

export async function getMessage(id: number | string): Promise<Message | null> {
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) return null;
  const { rows } = await db.store().select<Message & { attachments: string }>({ table: 'messages', where: [eq('id', Number(id))], limit: 1 });
  return rows[0] ? parseAttachments(rows[0]) : null;
}

async function deliver(customer: Customer, text: string): Promise<{ status: Message['status']; error?: string; ig_mid?: string | null }> {
  if (!customer.ig_user_id) return { status: 'pending', error: 'Müşterinin Instagram bağlantısı yok · mesajı elle gönderin' };
  if (!(await instagram.isConfigured())) return { status: 'pending', error: 'Instagram API bağlı değil · mesajı elle gönderin' };
  try {
    const res = await instagram.sendText(customer.ig_user_id, text);
    return { status: 'ok', ig_mid: res.message_id || null };
  } catch (e) {
    let err = e as instagram.InstagramError;
    if (err.outsideWindow && cfg.instagram.humanAgentTag) {
      try {
        const res = await instagram.sendText(customer.ig_user_id, text, { tag: 'HUMAN_AGENT' });
        return { status: 'ok', ig_mid: res.message_id || null };
      } catch (e2) {
        err = e2 as instagram.InstagramError;
      }
    }
    return { status: 'failed', error: err.message };
  }
}

/** Müşteriye Instagram üzerinden mesaj gönderir; sonucu messages tablosuna yazar. */
export async function sendToCustomer(customer: Customer, text: string, opts: { orderId?: number | null; kind?: string } = {}): Promise<Message> {
  const result = await deliver(customer, text);
  return saveMessage({
    customer_id: customer.id, order_id: opts.orderId || null, direction: 'out', text, kind: opts.kind || 'manual', is_read: 1,
    status: result.status, error: result.error || null, ig_mid: result.ig_mid || null,
  });
}

export async function sendOrderNotification(order: OrderFull, kind: string, opts: { text?: string | null } = {}): Promise<Message> {
  if (!DEFAULT_TEMPLATES[kind] && kind !== 'manual') throw httpError(400, 'Bilinmeyen mesaj tipi');
  if (kind === 'manual' && !(opts.text && String(opts.text).trim())) throw httpError(400, 'Mesaj metni boş');
  const customer = order.customer || (await customers.get(order.customer_id))!;
  const body = kind === 'manual' ? render(opts.text!, buildContext(order, customer)) : await renderForOrder(order, kind, opts.text);
  const msg = await sendToCustomer(customer, body, { orderId: order.id, kind });
  const label = MESSAGE_KIND_LABELS[kind] || 'Mesaj';
  const outcome = msg.status === 'ok' ? 'gönderildi' : msg.status === 'pending' ? 'bekliyor (elle gönderilmeli)' : `gönderilemedi · ${msg.error}`;
  await orders.addEvent(order.id, 'mesaj', `${label}: ${outcome}`, { message_id: msg.id, status: msg.status });
  if (kind === 'memnuniyet' && msg.status !== 'failed') await markSatisfactionAsked(order.id);
  return msg;
}

export async function retryMessage(id: number | string): Promise<Message> {
  const m = await getMessage(id);
  if (!m || m.direction !== 'out') throw httpError(404, 'Mesaj bulunamadı');
  const customer = (await customers.get(m.customer_id))!;
  const result = await deliver(customer, m.text);
  await db.store().update('messages', [eq('id', m.id)], {
    status: result.status, error: result.error || null, ig_mid: result.ig_mid || m.ig_mid, created_at: result.status === 'ok' ? now() : m.created_at,
  });
  if (m.order_id) await orders.addEvent(m.order_id, 'mesaj', `Mesaj tekrar denendi: ${result.status === 'ok' ? 'gönderildi' : result.error}`, { message_id: m.id, status: result.status });
  if (m.order_id && m.kind === 'memnuniyet' && result.status === 'ok') await markSatisfactionAsked(m.order_id);
  return (await getMessage(m.id))!;
}

/** Müşteri yeni mesaj yazınca 24 saatlik pencere açılır: bekleyen/başarısız bildirimleri tekrar dener. */
export async function retryFailedForCustomer(customerId: number): Promise<Message[]> {
  if (!(await instagram.isConfigured())) return [];
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const { rows } = await db.store().select<{ id: number }>({
    table: 'messages', columns: ['id'], where: [eq('customer_id', customerId), eq('direction', 'out'), isIn('status', ['failed', 'pending']), { col: 'created_at', op: 'gte', val: cutoff }],
    order: [{ col: 'id' }], limit: 100,
  });
  const out: Message[] = [];
  for (const r of rows) {
    try { out.push(await retryMessage(r.id)); } catch (e) { console.error('[mesaj] tekrar deneme hatası:', (e as Error).message); }
  }
  return out;
}

export async function markManualSent(id: number | string): Promise<Message> {
  const m = await getMessage(id);
  if (!m) throw httpError(404, 'Mesaj bulunamadı');
  await db.store().update('messages', [eq('id', m.id)], { status: 'manual_sent', error: null });
  if (m.order_id) await orders.addEvent(m.order_id, 'mesaj', 'Mesaj elle gönderildi olarak işaretlendi', { message_id: m.id });
  if (m.order_id && m.kind === 'memnuniyet') await markSatisfactionAsked(m.order_id);
  return (await getMessage(m.id))!;
}

export interface OutboxRow extends Message { customer_name: string; customer_ig: string | null; customer_ig_id: string | null; customer_phone: string; order_no: number | null }

export async function listPending(): Promise<OutboxRow[]> {
  const { rows } = await db.store().select<Message & { attachments: string }>({
    table: 'messages', where: [eq('direction', 'out'), isIn('status', ['pending', 'failed'])], order: [{ col: 'id', asc: false }], limit: 200,
  });
  if (!rows.length) return [];
  const custIds = [...new Set(rows.map((r) => r.customer_id))];
  const orderIds = [...new Set(rows.map((r) => r.order_id).filter((x): x is number => x != null))];
  const custs = new Map((await db.store().select<Customer>({ table: 'customers', where: [isIn('id', custIds)], limit: custIds.length })).rows.map((c) => [c.id, c]));
  const nos = new Map(orderIds.length ? (await db.store().select<{ id: number; order_no: number }>({ table: 'orders', columns: ['id', 'order_no'], where: [isIn('id', orderIds)], limit: orderIds.length })).rows.map((o) => [o.id, o.order_no]) : []);
  return rows.map((r) => {
    const c = custs.get(r.customer_id);
    return { ...parseAttachments(r), attachments: [], customer_name: c?.name || '', customer_ig: c?.ig_username ?? null, customer_ig_id: c?.ig_user_id ?? null, customer_phone: c?.phone || '', order_no: r.order_id ? nos.get(r.order_id) ?? null : null };
  });
}

// --- Otomatik tetikleyiciler (sipariş akışı). Kancalar sipariş servisince BEKLENEREK çalıştırılır.
orders.hooks.status.set('messaging', async ({ order, to }) => {
  const flags = await getAutoFlags();
  if (to === 'kargoya_verildi' && flags.auto_kargo_bildirimi) await sendOrderNotification(order, 'kargo_bildirimi');
  if (to === 'teslim_edildi' && flags.auto_memnuniyet) await sendOrderNotification(order, 'memnuniyet');
});

orders.hooks.created.set('messaging', async (order) => {
  if ((await getAutoFlags()).auto_siparis_alindi) await sendOrderNotification(order, 'siparis_alindi');
});
