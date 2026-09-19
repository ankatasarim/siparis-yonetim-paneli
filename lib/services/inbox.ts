import * as db from '../db';
import { cfg } from '../config';
import { eq, isIn } from '../store';
import * as customers from './customers';
import * as orders from './orders';
import * as messaging from './messaging';
import * as instagram from '../integrations/instagram';
import { httpError } from '../utils';
import { ACTIVE_STATUSES } from '../constants';
import type { Conversation, Customer, Message, Thread } from '../types';

const ATTACHMENT_LABELS: Record<string, string> = { image: 'Fotoğraf', video: 'Video', audio: 'Sesli mesaj', file: 'Dosya', share: 'Paylaşım', story_mention: 'Hikayede bahsetme', reel: 'Reels', ig_reel: 'Reels', template: 'Şablon', like_heart: '❤️' };

function attachmentText(attachments: { type: string }[]): string {
  if (!attachments || !attachments.length) return '';
  return `[${attachments.map((a) => ATTACHMENT_LABELS[a.type] || 'Ek').join(', ')}]`;
}

function parseAttachments(m: Message & { attachments: unknown }): Message {
  let attachments: Message['attachments'] = [];
  if (Array.isArray(m.attachments)) attachments = m.attachments as Message['attachments'];
  else { try { attachments = JSON.parse(String(m.attachments || '[]')); } catch { attachments = []; } }
  return { ...m, attachments };
}

/** Instagram profilini çeker ve müşteriye işler (hata olursa sessizce geçer). Serverless'ta beklenerek çağrılır. */
async function fetchProfile(customerId: number, igsid: string): Promise<void> {
  if (!(await instagram.isConfigured())) return;
  try {
    const p = await instagram.getProfile(igsid);
    const c = await customers.get(customerId);
    if (!c) return;
    await customers.update(customerId, { ig_username: p.username || c.ig_username, name: c.name || p.name || '', profile_pic: p.profile_pic || c.profile_pic });
  } catch (e) {
    console.warn('[instagram] profil alınamadı:', (e as Error).message);
  }
}

export async function handleMessage(ev: instagram.WebhookMessage): Promise<Message | null> {
  if (ev.isDeleted || !ev.mid) return null;
  const dup = await db.store().select<{ id: number }>({ table: 'messages', columns: ['id'], where: [eq('ig_mid', ev.mid)], limit: 1 });
  if (dup.rows.length) return null; // zaten kayıtlı (kendi gönderimimizin yankısı vb.)
  const igsid = ev.isEcho ? ev.recipientId : ev.senderId;
  if (!igsid) return null;

  let customer = await customers.findByIg(igsid);
  const isNew = !customer;
  if (!customer) customer = await customers.upsertByIg(igsid, {});

  const msg = await messaging.saveMessage({
    customer_id: customer.id,
    direction: ev.isEcho ? 'out' : 'in',
    text: ev.text || attachmentText(ev.attachments),
    attachments: ev.attachments,
    ig_mid: ev.mid,
    status: 'ok',
    kind: ev.isEcho ? 'instagram' : null,
    is_read: ev.isEcho ? 1 : 0,
    created_at: new Date(ev.timestamp || Date.now()).toISOString(),
  });

  if (isNew || !customer.ig_username) await fetchProfile(customer.id, igsid);

  if (!ev.isEcho) {
    const awaiting = await orders.findAwaitingSatisfaction(customer.id);
    if (awaiting && ev.text) {
      await orders.recordSatisfactionReply(awaiting.id, ev.text);
      await db.store().update('messages', [eq('id', msg.id)], { order_id: awaiting.id });
    }
    try { await messaging.retryFailedForCustomer(customer.id); }
    catch (e) { console.error('[mesaj] tekrar deneme:', (e as Error).message); }
  }
  return messaging.getMessage(msg.id);
}

export async function processWebhook(body: unknown): Promise<Message[]> {
  const results: Message[] = [];
  for (const ev of instagram.parseWebhook(body)) {
    try {
      if (ev.type === 'message') {
        const m = await handleMessage(ev);
        if (m) results.push(m);
      }
    } catch (e) {
      console.error('[webhook] mesaj işlenemedi:', (e as Error).message);
    }
  }
  return results;
}

/** Instagram bağlantısı olmadan akışı denemek için sahte gelen mesaj üretir. */
export async function simulateIncoming({ igsid, username, name, text }: { igsid?: string; username?: string; name?: string; text?: string }) {
  if (!cfg.allowSimulation) throw httpError(403, 'Simülasyon kapalı (ALLOW_SIMULATION=false)');
  if (!text || !String(text).trim()) throw httpError(400, 'Mesaj metni gerekli');
  const id = String(igsid || '').trim() || `sim-${Date.now()}`;
  const stamp = Date.now();
  const body = {
    object: 'instagram',
    entry: [{ id: 'me', time: stamp, messaging: [{ sender: { id }, recipient: { id: 'me' }, timestamp: stamp, message: { mid: `sim-${stamp}-${Math.random().toString(36).slice(2, 8)}`, text: String(text) } }] }],
  };
  const messages = await processWebhook(body);
  let customer = await customers.findByIg(id);
  if (customer && (username || name)) {
    const patch: Record<string, string> = {};
    if (username) patch.ig_username = username;
    if (name && !customer.name) patch.name = name;
    if (Object.keys(patch).length) customer = await customers.update(customer.id, patch);
  }
  return { customer, messages };
}

/** Sohbet listesi: her müşterinin son mesajı, okunmamış sayısı ve aktif sipariş sayısı. */
export async function conversations(): Promise<Conversation[]> {
  const msgs = await db.selectAll<{ id: number; customer_id: number; text: string; created_at: string; direction: 'in' | 'out'; status: string; is_read: number }>(
    { table: 'messages', columns: ['id', 'customer_id', 'text', 'created_at', 'direction', 'status', 'is_read'], order: [{ col: 'created_at', asc: false }, { col: 'id', asc: false }] },
    1000, 5000
  );
  const latest = new Map<number, typeof msgs[number]>();
  const unread = new Map<number, number>();
  for (const m of msgs) {
    if (!latest.has(m.customer_id)) latest.set(m.customer_id, m);
    if (m.direction === 'in' && !m.is_read) unread.set(m.customer_id, (unread.get(m.customer_id) || 0) + 1);
  }
  const ids = [...latest.keys()].slice(0, 300);
  if (!ids.length) return [];
  const custs = new Map((await db.store().select<Customer>({ table: 'customers', where: [isIn('id', ids)], limit: ids.length })).rows.map((c) => [c.id, c]));
  const active = new Map<number, number>();
  for (const o of await db.selectAll<{ customer_id: number }>({ table: 'orders', columns: ['customer_id'], where: [isIn('customer_id', ids), isIn('status', ACTIVE_STATUSES)] })) {
    active.set(o.customer_id, (active.get(o.customer_id) || 0) + 1);
  }
  return ids.map((id) => {
    const c = custs.get(id);
    const lm = latest.get(id)!;
    return {
      id, name: c?.name || '', ig_username: c?.ig_username ?? null, ig_user_id: c?.ig_user_id ?? null, profile_pic: c?.profile_pic ?? null, phone: c?.phone || '',
      last_text: lm.text, last_at: lm.created_at, last_direction: lm.direction, last_status: lm.status,
      unread: unread.get(id) || 0, active_orders: active.get(id) || 0,
    };
  }).filter((c) => custs.has(c.id));
}

export async function thread(customerId: number | string, { limit = 300 }: { limit?: number } = {}): Promise<Thread> {
  const customer = await customers.get(customerId);
  if (!customer) throw httpError(404, 'Müşteri bulunamadı');
  const { rows } = await db.store().select<Message & { attachments: string }>({
    table: 'messages', where: [eq('customer_id', customer.id)], order: [{ col: 'created_at' }, { col: 'id' }], limit: Number(limit) || 300,
  });
  const orderIds = [...new Set(rows.map((m) => m.order_id).filter((x): x is number => x != null))];
  const nos = new Map(orderIds.length ? (await db.store().select<{ id: number; order_no: number }>({ table: 'orders', columns: ['id', 'order_no'], where: [isIn('id', orderIds)], limit: orderIds.length })).rows.map((o) => [o.id, o.order_no]) : []);
  const messages = rows.map((m) => ({ ...parseAttachments(m), order_no: m.order_id ? nos.get(m.order_id) ?? null : null }));
  const lastIn = [...messages].reverse().find((m) => m.direction === 'in');
  const windowOpen = lastIn ? Date.now() - Date.parse(lastIn.created_at) < 24 * 3600 * 1000 : false;
  const active_orders = (await orders.list({ customer_id: customer.id, statuses: ACTIVE_STATUSES, pageSize: 20 })).rows;
  return { customer, messages, window_open: windowOpen, last_incoming_at: lastIn ? lastIn.created_at : null, active_orders };
}

export async function markRead(customerId: number | string): Promise<boolean> {
  if (!Number.isInteger(Number(customerId))) return false;
  await db.store().update('messages', [eq('customer_id', Number(customerId)), eq('direction', 'in'), eq('is_read', 0)], { is_read: 1 });
  return true;
}

export async function reply(customerId: number | string, text: string): Promise<Message> {
  const customer = (await customers.get(customerId)) as Customer | null;
  if (!customer) throw httpError(404, 'Müşteri bulunamadı');
  const t = String(text || '').trim();
  if (!t) throw httpError(400, 'Mesaj metni boş');
  return messaging.sendToCustomer(customer, t, { kind: 'manual' });
}
