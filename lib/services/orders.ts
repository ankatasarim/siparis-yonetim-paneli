import * as db from '../db';
import { cfg } from '../config';
import { eq, gt, ilike, isIn, isUniqueViolation, lt, or, type Cond, type Row, type Where } from '../store';
import { httpError, now, normalizeTr, pick, round2, toNumber } from '../utils';
import { STATUSES, ACTIVE_STATUSES, PAYMENT_STATUSES, SHIPPING_PAYERS, SATISFACTION_LABELS, trackingUrl } from '../constants';
import type { Customer, Dashboard, Order, OrderEvent, OrderFull, OrderLine, OrderRow, OrderStatus, PaymentStatus, Satisfaction, Message } from '../types';

/* ---------- Kancalar ----------
 * Serverless ortamda (Vercel) yanıt döndükten sonra arka planda çalışan iş kesilir; bu yüzden
 * durum değişikliklerine bağlı işler (ör. müşteriye mesaj) burada BEKLENEREK çalıştırılır.
 * İsimle kayıt yapılır ki geliştirme modunda modül yeniden yüklenince çift kayıt olmasın. */
export type StatusHook = (p: { order: OrderFull; from: OrderStatus; to: OrderStatus; by: string }) => Promise<void>;
export type CreatedHook = (order: OrderFull) => Promise<void>;
export type SatisfactionHook = (p: { order: OrderFull; verdict: Satisfaction; note?: string | null }) => Promise<void>;
interface Hooks { status: Map<string, StatusHook>; created: Map<string, CreatedHook>; satisfaction: Map<string, SatisfactionHook> }
const g = globalThis as unknown as { __ankaHooks?: Hooks };
export const hooks: Hooks = g.__ankaHooks || (g.__ankaHooks = { status: new Map(), created: new Map(), satisfaction: new Map() });

async function fire(kind: keyof Hooks, payload: unknown) {
  for (const [name, fn] of hooks[kind]) {
    try { await (fn as (p: unknown) => Promise<void>)(payload); }
    catch (e) { console.error(`[kanca ${kind}/${name}]`, (e as Error).message); }
  }
}

const EDITABLE = ['lines', 'notes', 'labels', 'desi', 'package_count', 'shipping_payer', 'shipping_fee', 'payment_status', 'payment_method', 'source'] as const;
const validId = (id: number | string) => Number.isInteger(Number(id)) && Number(id) > 0;
const S = () => db.store();

export function normalizeLines(input: unknown): OrderLine[] {
  let data = input;
  if (typeof data === 'string') {
    const s = data.trim();
    if (!s) return [];
    try { data = JSON.parse(s); } catch { data = [{ name: s, qty: 1, price: null }]; }
  }
  if (!Array.isArray(data)) return [];
  const out: OrderLine[] = [];
  for (const raw of data as Array<Record<string, unknown>>) {
    if (!raw) continue;
    const name = String(raw.name || '').trim();
    if (!name) continue;
    const qty = Math.max(1, parseInt(String(raw.qty ?? 1), 10) || 1);
    const price = toNumber(raw.price);
    if (price != null && (Number.isNaN(price) || price < 0)) throw httpError(400, `"${name}" için fiyat geçersiz`);
    out.push({ name, qty, price });
  }
  return out;
}

export const linesSummary = (lines: OrderLine[]) => lines.map((l) => `${l.qty}× ${l.name}`).join(', ');

export function calcTotals(lines: OrderLine[], shippingFee: number) {
  const subtotal = round2(lines.reduce((s, l) => s + l.qty * (l.price || 0), 0));
  return { subtotal, total: round2(subtotal + (shippingFee || 0)) };
}

function cleanFields(data: unknown): Record<string, unknown> {
  const d = pick(data as object, EDITABLE);
  const out: Record<string, unknown> = {};
  if ('lines' in d) {
    const lines = normalizeLines(d.lines);
    out.lines_json = JSON.stringify(lines);
    out.items = linesSummary(lines);
  }
  if ('notes' in d) out.notes = String(d.notes || '').trim();
  if ('labels' in d) out.labels = String(d.labels || '').trim();
  if ('source' in d) out.source = String(d.source || 'instagram').trim() || 'instagram';
  if ('desi' in d) {
    const v = toNumber(d.desi);
    if (v != null && (Number.isNaN(v) || v < 0)) throw httpError(400, 'Desi geçersiz');
    out.desi = v;
  }
  if ('package_count' in d) {
    const v = parseInt(String(d.package_count), 10);
    out.package_count = Number.isFinite(v) && v > 0 ? v : 1;
  }
  if ('shipping_fee' in d) {
    const v = toNumber(d.shipping_fee);
    if (v != null && (Number.isNaN(v) || v < 0)) throw httpError(400, 'Kargo ücreti geçersiz');
    out.shipping_fee = v || 0;
  }
  if ('shipping_payer' in d) {
    if (!SHIPPING_PAYERS[d.shipping_payer as keyof typeof SHIPPING_PAYERS]) throw httpError(400, 'Geçersiz kargo ödeme tipi');
    out.shipping_payer = d.shipping_payer;
  }
  if ('payment_status' in d) {
    if (!PAYMENT_STATUSES[d.payment_status as PaymentStatus]) throw httpError(400, 'Geçersiz ödeme durumu');
    out.payment_status = d.payment_status;
  }
  if ('payment_method' in d) out.payment_method = String(d.payment_method || '').trim();
  return out;
}

function hydrate<T extends Record<string, unknown>>(row: T | null): (Omit<T, 'lines_json'> & { lines: OrderLine[] }) | null {
  if (!row) return null;
  let lines: OrderLine[] = [];
  try { lines = JSON.parse((row.lines_json as string) || '[]'); } catch { lines = []; }
  const { lines_json: _lj, ...rest } = row;
  return { ...rest, lines } as Omit<T, 'lines_json'> & { lines: OrderLine[] };
}

function safeJson(s: string | null): Record<string, unknown> | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

function safeJsonArr(s: string | unknown): Message['attachments'] {
  if (Array.isArray(s)) return s as Message['attachments'];
  try { const v = JSON.parse(String(s || '[]')); return Array.isArray(v) ? v : []; } catch { return []; }
}

async function nextOrderNo(): Promise<number> {
  const { rows } = await S().select<{ order_no: number }>({ table: 'orders', columns: ['order_no'], order: [{ col: 'order_no', asc: false }], limit: 1 });
  return rows[0] ? Number(rows[0].order_no) + 1 : cfg.business.orderStartNo;
}

export async function getRaw(id: number | string): Promise<Order | null> {
  if (!validId(id)) return null;
  const { rows } = await S().select({ table: 'orders', where: [eq('id', Number(id))], limit: 1 });
  return hydrate(rows[0] || null) as Order | null;
}

export async function getByNo(orderNo: number | string): Promise<Order | null> {
  if (!validId(orderNo)) return null;
  const { rows } = await S().select({ table: 'orders', where: [eq('order_no', Number(orderNo))], limit: 1 });
  return hydrate(rows[0] || null) as Order | null;
}

export async function get(id: number | string): Promise<OrderFull | null> {
  const order = await getRaw(id);
  if (!order) return null;
  const customer = (await S().select<Customer>({ table: 'customers', where: [eq('id', order.customer_id)], limit: 1 })).rows[0];
  const events = (await S().select<OrderEvent & { meta: string | null }>({ table: 'order_events', where: [eq('order_id', order.id)], order: [{ col: 'id' }], limit: 1000 })).rows
    .map((e) => ({ ...e, meta: safeJson(e.meta as unknown as string) }));
  const messages = (await S().select<Message & { attachments: string }>({ table: 'messages', where: [eq('order_id', order.id)], order: [{ col: 'id' }], limit: 1000 })).rows
    .map((m) => ({ ...m, attachments: safeJsonArr(m.attachments) }));
  return {
    ...order,
    customer: customer as OrderFull['customer'],
    events,
    messages,
    next_statuses: STATUSES[order.status] ? STATUSES[order.status].next : [],
    tracking_url: order.dhl_tracking_no ? trackingUrl(order.dhl_tracking_no) : null,
  };
}

export interface ListOpts {
  status?: string | null;
  statuses?: OrderStatus[] | null;
  payment_status?: string | null;
  q?: string | null;
  customer_id?: number | string | null;
  page?: number;
  pageSize?: number;
}

/** Sipariş satırlarına müşteri özet alanlarını ekler. */
async function attachCustomers(rows: Row[]): Promise<OrderRow[]> {
  const ids = [...new Set(rows.map((r) => Number(r.customer_id)))];
  const custs = ids.length ? (await S().select<Customer>({ table: 'customers', where: [isIn('id', ids)], limit: ids.length })).rows : [];
  const map = new Map(custs.map((c) => [c.id, c]));
  return rows.map((r) => {
    const c = map.get(Number(r.customer_id));
    return {
      ...(hydrate(r) as Order),
      customer_name: c?.name || '', customer_phone: c?.phone || '', customer_email: c?.email || '',
      customer_ig: c?.ig_username ?? null, customer_ig_id: c?.ig_user_id ?? null, customer_city: c?.city || '', customer_district: c?.district || '',
    } as OrderRow;
  });
}

export async function list(opts: ListOpts = {}): Promise<{ rows: OrderRow[]; total: number; page: number; pageSize: number }> {
  const where: Where[] = [];
  if (opts.status && STATUSES[opts.status as OrderStatus]) where.push(eq('status', opts.status));
  if (opts.statuses && opts.statuses.length) where.push(isIn('status', opts.statuses));
  if (opts.payment_status && PAYMENT_STATUSES[opts.payment_status as PaymentStatus]) where.push(eq('payment_status', opts.payment_status));
  if (opts.customer_id) {
    if (!validId(opts.customer_id)) return { rows: [], total: 0, page: 1, pageSize: 20 };
    where.push(eq('customer_id', Number(opts.customer_id)));
  }
  if (opts.q && String(opts.q).trim()) {
    const q = String(opts.q).trim().replace(/^#/, '');
    const like = `%${q}%`;
    const conds: Cond[] = [ilike('items', like), ilike('dhl_tracking_no', like)];
    if (/^\d+$/.test(q)) conds.push(eq('order_no', Number(q)));
    const { rows: cs } = await S().select<{ id: number }>({
      table: 'customers', columns: ['id'], where: [or(['name', 'phone', 'email', 'ig_username'].map((c) => ilike(c, like)))], limit: 500,
    });
    if (cs.length) conds.push(isIn('customer_id', cs.map((c) => c.id)));
    where.push(or(conds));
  }
  const pageSize = Math.min(200, Math.max(1, Number(opts.pageSize) || 20));
  const page = Math.max(1, Number(opts.page) || 1);
  const { rows, count } = await S().select({ table: 'orders', where, order: [{ col: 'id', asc: false }], limit: pageSize, offset: (page - 1) * pageSize, count: true });
  return { rows: await attachCustomers(rows), total: count ?? rows.length, page, pageSize };
}

export async function addEvent(orderId: number | string, type: string, description: string, meta?: Record<string, unknown> | null): Promise<void> {
  await S().insert('order_events', { order_id: Number(orderId), type, description: description || '', meta: meta ? JSON.stringify(meta) : null, created_at: now() });
}

export async function create(data: Record<string, unknown>): Promise<OrderFull> {
  if (!data || !data.customer_id || !validId(data.customer_id as string)) throw httpError(400, 'Müşteri seçilmedi');
  const customer = (await S().select<{ id: number }>({ table: 'customers', columns: ['id'], where: [eq('id', Number(data.customer_id))], limit: 1 })).rows[0];
  if (!customer) throw httpError(404, 'Müşteri bulunamadı');
  const f = {
    lines_json: '[]', items: '', notes: '', labels: '', desi: null as number | null, package_count: 1,
    shipping_payer: 'gonderici', shipping_fee: 0, payment_status: 'bekleniyor', payment_method: '', source: 'instagram',
    ...cleanFields(data),
  } as Record<string, unknown>;
  const lines = JSON.parse(f.lines_json as string) as OrderLine[];
  if (!lines.length) throw httpError(400, 'En az bir ürün satırı girin');
  const { subtotal, total } = calcTotals(lines, Number(f.shipping_fee) || 0);
  const t = now();
  let id = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const order_no = await nextOrderNo();
    try {
      const row = await S().insert<{ id: number }>('orders', {
        order_no, customer_id: customer.id, status: 'yeni', payment_status: f.payment_status, payment_method: f.payment_method, shipping_payer: f.shipping_payer,
        lines_json: f.lines_json, items: f.items, notes: f.notes, labels: f.labels, desi: f.desi, package_count: f.package_count,
        shipping_fee: f.shipping_fee, subtotal, total, source: f.source, created_at: t, updated_at: t,
      });
      id = row.id;
      break;
    } catch (e) {
      if (attempt < 2 && isUniqueViolation(e)) continue; // aynı anda iki sipariş: numarayı yeniden al
      throw e;
    }
  }
  await addEvent(id, 'olusturuldu', `Sipariş oluşturuldu (${f.source === 'instagram' ? 'Instagram' : f.source})`);
  if (f.payment_status === 'alindi') await addEvent(id, 'odeme', `Ödeme alındı${f.payment_method ? ' · ' + f.payment_method : ''}`);
  await fire('created', (await get(id))!);
  return (await get(id))!;
}

export async function update(id: number | string, data: unknown): Promise<OrderFull> {
  const existing = await getRaw(id);
  if (!existing) throw httpError(404, 'Sipariş bulunamadı');
  const f = cleanFields(data);
  if (!Object.keys(f).length) return (await get(id))!;
  const lines = 'lines_json' in f ? (JSON.parse(f.lines_json as string) as OrderLine[]) : existing.lines;
  if (!lines.length) throw httpError(400, 'En az bir ürün satırı girin');
  const shippingFee = 'shipping_fee' in f ? Number(f.shipping_fee) : existing.shipping_fee;
  const { subtotal, total } = calcTotals(lines, shippingFee);
  f.subtotal = subtotal;
  f.total = total;
  if ('payment_status' in f && f.payment_status !== existing.payment_status) {
    await addEvent(existing.id, 'odeme', `Ödeme durumu: ${PAYMENT_STATUSES[f.payment_status as PaymentStatus].label}${f.payment_method ? ' · ' + f.payment_method : ''}`);
  }
  await S().update('orders', [eq('id', existing.id)], { ...f, updated_at: now() });
  return (await get(id))!;
}

export async function remove(id: number | string): Promise<boolean> {
  const existing = await getRaw(id);
  if (!existing) throw httpError(404, 'Sipariş bulunamadı');
  await S().update('messages', [eq('order_id', existing.id)], { order_id: null });
  await S().remove('order_events', [eq('order_id', existing.id)]);
  await S().remove('orders', [eq('id', existing.id)]);
  return true;
}

export async function setStatus(id: number | string, status: OrderStatus, opts: { note?: string; by?: string; force?: boolean } = {}): Promise<OrderFull> {
  const order = await getRaw(id);
  if (!order) throw httpError(404, 'Sipariş bulunamadı');
  if (!STATUSES[status]) throw httpError(400, 'Geçersiz durum');
  if (order.status === status) return (await get(id))!;
  const from = STATUSES[order.status];
  if (!opts.force && !from.next.includes(status)) {
    throw httpError(400, `"${from.label}" durumundan "${STATUSES[status].label}" durumuna geçilemez`);
  }
  if (status === 'kargoya_verildi' && !order.dhl_tracking_no && !opts.force) {
    throw httpError(400, 'Kargoya verildi olarak işaretlemek için önce DHL takip numarası girilmeli');
  }
  const t = now();
  const patch: Record<string, unknown> = { status, updated_at: t };
  if (status === 'kargoya_verildi') patch.shipped_at = t;
  if (status === 'teslim_edildi') {
    patch.delivered_at = t;
    if (order.dhl_tracking_no && order.dhl_status !== 'delivered') { patch.dhl_status = 'delivered'; patch.dhl_status_text = 'Teslim edildi'; }
  }
  if (status === 'kapandi' || status === 'iptal') patch.closed_at = t;
  await S().update('orders', [eq('id', order.id)], patch);
  const by = opts.by || 'panel';
  await addEvent(order.id, 'durum', `${from.label} → ${STATUSES[status].label}${opts.note ? ' · ' + opts.note : ''}`, { from: order.status, to: status, by });
  await fire('status', { order: (await get(id))!, from: order.status, to: status, by });
  return (await get(id))!;
}

/** DHL takip numarası kaydeder ve siparişi "Kargoya Verildi" durumuna alır. */
export async function recordShipment(id: number | string, { tracking_no, shipment_ref, by }: { tracking_no?: string; shipment_ref?: string | null; by?: string }): Promise<OrderFull> {
  const order = await getRaw(id);
  if (!order) throw httpError(404, 'Sipariş bulunamadı');
  const tracking = String(tracking_no || '').replace(/\s+/g, '').trim();
  if (!tracking) throw httpError(400, 'DHL takip numarası gerekli');
  if (['kapandi', 'iptal', 'teslim_edildi'].includes(order.status)) throw httpError(400, 'Bu sipariş için kargo kaydı yapılamaz');
  if (order.status === 'yeni') await setStatus(id, 'hazirlaniyor', { by: by || 'panel', note: 'Kargo kaydı ile otomatik' });
  await S().update('orders', [eq('id', order.id)], { dhl_tracking_no: tracking, dhl_shipment_ref: shipment_ref || null, dhl_status: 'created', dhl_status_text: 'Gönderi oluşturuldu', updated_at: now() });
  await addEvent(order.id, 'kargo', `DHL gönderisi kaydedildi · Takip No: ${tracking}`, { tracking_no: tracking, shipment_ref: shipment_ref || null });
  if (order.status === 'kargoya_verildi') return (await get(id))!;
  return setStatus(id, 'kargoya_verildi', { by: by || 'panel' });
}

export async function updateTracking(id: number | string, { status, text }: { status?: string; text?: string }): Promise<Order | null> {
  const order = await getRaw(id);
  if (!order) return null;
  await S().update('orders', [eq('id', order.id)], { dhl_status: status || order.dhl_status, dhl_status_text: text || order.dhl_status_text, dhl_last_check: now(), updated_at: now() });
  if (status && status !== order.dhl_status) await addEvent(order.id, 'kargo_durum', `DHL durumu: ${text || status}`, { status, text });
  return getRaw(id);
}

export async function setPayment(id: number | string, status: PaymentStatus, method?: string): Promise<OrderFull> {
  const order = await getRaw(id);
  if (!order) throw httpError(404, 'Sipariş bulunamadı');
  if (!PAYMENT_STATUSES[status]) throw httpError(400, 'Geçersiz ödeme durumu');
  return update(id, { payment_status: status, payment_method: method ?? order.payment_method });
}

export async function addComment(id: number | string, text: string, by = 'panel'): Promise<OrderFull> {
  const order = await getRaw(id);
  if (!order) throw httpError(404, 'Sipariş bulunamadı');
  const t = String(text || '').trim();
  if (!t) throw httpError(400, 'Yorum boş');
  await addEvent(order.id, 'yorum', t, { by });
  return (await get(id))!;
}

const NEGATIVE = ['memnun degil', 'memnun kalmadim', 'kotu', 'sorun', 'hasar', 'kirik', 'kirilmis', 'eksik', 'yanlis', 'begenmedim', 'iade', 'hayir', 'berbat', 'sikayet', 'bozuk', 'gec geldi', 'gelmedi', 'ulasmadi', 'hic', 'rezalet', 'degilim', 'olmamis', 'olmadi', 'problem', 'kusurlu', 'defolu', 'yirtik', 'lekeli', 'para iadesi', 'degistir', '👎', '😡', '😠', '😞', '😢'];
const POSITIVE = ['memnun', 'tesekkur', 'harika', 'super', 'guzel', 'begendim', 'bayildim', 'mukemmel', 'elinize saglik', 'ellerinize saglik', 'evet', 'cok iyi', 'kusursuz', 'muhtesem', 'sevdim', 'saolun', 'sagolun', 'sag olun', 'tsk', 'iyi ki', 'tavsiye', 'tekrar', 'basarili', '❤', '😍', '🥰', '👍', '🙏', '💕', '🧡', '💛', '😊', '☺', '🤩', '👌'];

/** Müşteri cevabını basit anahtar kelimelerle sınıflandırır. */
export function classifySatisfaction(text: string): Satisfaction {
  const t = normalizeTr(text);
  if (!t) return 'cevaplandi';
  if (NEGATIVE.some((k) => t.includes(k))) return 'memnun_degil';
  if (POSITIVE.some((k) => t.includes(k))) return 'memnun';
  return 'cevaplandi';
}

export async function findAwaitingSatisfaction(customerId: number): Promise<Order | null> {
  const { rows } = await S().select({
    table: 'orders', where: [eq('customer_id', customerId), eq('status', 'teslim_edildi'), eq('satisfaction', 'bekleniyor')],
    order: [{ col: 'delivered_at', asc: false }, { col: 'id', asc: false }], limit: 1,
  });
  return hydrate(rows[0] || null) as Order | null;
}

export async function setSatisfaction(id: number | string, verdict: Satisfaction, note?: string | null, opts: { by?: string; autoClose?: boolean } = {}): Promise<OrderFull> {
  const order = await getRaw(id);
  if (!order) throw httpError(404, 'Sipariş bulunamadı');
  if (!SATISFACTION_LABELS[verdict]) throw httpError(400, 'Geçersiz memnuniyet değeri');
  await S().update('orders', [eq('id', order.id)], { satisfaction: verdict, satisfaction_note: note || order.satisfaction_note || null, updated_at: now() });
  await addEvent(order.id, 'memnuniyet', `Memnuniyet: ${SATISFACTION_LABELS[verdict]}${note ? ' · "' + String(note).slice(0, 200) + '"' : ''}`, { verdict, by: opts.by || 'panel' });
  let updated = (await get(id))!;
  if (verdict === 'memnun' && updated.status === 'teslim_edildi' && opts.autoClose !== false) {
    updated = await setStatus(id, 'kapandi', { by: opts.by || 'panel', note: 'Müşteri memnun' });
  }
  await fire('satisfaction', { order: updated, verdict, note });
  return updated;
}

export async function recordSatisfactionReply(id: number | string, text: string): Promise<OrderFull> {
  return setSatisfaction(id, classifySatisfaction(text), text, { by: 'müşteri-cevabı' });
}

export async function neighbors(id: number): Promise<{ prev: number | null; next: number | null }> {
  const prev = (await S().select<{ id: number }>({ table: 'orders', columns: ['id'], where: [gt('id', id)], order: [{ col: 'id' }], limit: 1 })).rows[0];
  const next = (await S().select<{ id: number }>({ table: 'orders', columns: ['id'], where: [lt('id', id)], order: [{ col: 'id', asc: false }], limit: 1 })).rows[0];
  return { prev: prev ? prev.id : null, next: next ? next.id : null };
}

export async function dashboard(): Promise<Dashboard> {
  const all = await db.selectAll<{ id: number; status: OrderStatus; total: number; created_at: string; payment_status: PaymentStatus; satisfaction: Satisfaction | null }>({
    table: 'orders', columns: ['id', 'status', 'total', 'created_at', 'payment_status', 'satisfaction'], order: [{ col: 'id' }],
  });
  const counts = {} as Record<OrderStatus, number>;
  for (const s of Object.keys(STATUSES) as OrderStatus[]) counts[s] = 0;
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7) + '-01';
  let today_count = 0, month_count = 0, month_revenue = 0, unhappy = 0, unpaid = 0;
  for (const o of all) {
    if (counts[o.status] != null) counts[o.status] += 1;
    if (o.created_at >= today) today_count += 1;
    if (o.created_at >= month && o.status !== 'iptal') { month_count += 1; month_revenue += Number(o.total) || 0; }
    if (o.status === 'teslim_edildi' && (o.satisfaction === 'memnun_degil' || o.satisfaction === 'cevaplandi')) unhappy += 1;
    if (o.payment_status === 'bekleniyor' && o.status !== 'iptal' && o.status !== 'kapandi') unpaid += 1;
  }
  const pending_messages = (await S().select({ table: 'messages', columns: ['id'], where: [eq('direction', 'out'), isIn('status', ['failed', 'pending'])], limit: 1, count: true })).count || 0;
  const unread = (await S().select({ table: 'messages', columns: ['id'], where: [eq('direction', 'in'), eq('is_read', 0)], limit: 1, count: true })).count || 0;
  const evs = (await S().select<OrderEvent & { meta: string | null }>({ table: 'order_events', order: [{ col: 'id', asc: false }], limit: 20 })).rows;
  const evOrderIds = [...new Set(evs.map((e) => e.order_id))];
  const noMap = new Map(evOrderIds.length ? (await S().select<{ id: number; order_no: number }>({ table: 'orders', columns: ['id', 'order_no'], where: [isIn('id', evOrderIds)], limit: evOrderIds.length })).rows.map((o) => [o.id, o.order_no]) : []);
  const recent_events = evs.map((e) => ({ ...e, meta: safeJson(e.meta as unknown as string), order_no: noMap.get(e.order_id) || 0 }));
  return {
    counts,
    attention: { pending_messages, unhappy, unread, no_tracking: counts.hazirlaniyor, unpaid },
    recent_events, today_count, month_count, month_revenue: round2(month_revenue),
    new_orders: (await list({ status: 'yeni', pageSize: 8 })).rows,
    awaiting_shipment: (await list({ status: 'hazirlaniyor', pageSize: 8 })).rows,
    in_transit: (await list({ status: 'kargoya_verildi', pageSize: 8 })).rows,
  };
}

export { STATUSES, ACTIVE_STATUSES };
