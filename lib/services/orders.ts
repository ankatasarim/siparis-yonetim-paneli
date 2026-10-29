import * as db from '../db';
import { cfg } from '../config';
import { eq, gt, ilike, isIn, isNull, isUniqueViolation, lt, or, type Cond, type Row, type Where } from '../store';
import { httpError, now, normalizeTr, pick, round2, toNumber } from '../utils';
import { STATUSES, ACTIVE_STATUSES, PAYMENT_STATUSES, SHIPPING_PAYERS, SHIPPING_COMPANIES, SATISFACTION_LABELS, ORDER_SOURCES, DEFAULT_SOURCE, ACCOUNT_PAYMENT_METHOD, trackingUrl } from '../constants';
import * as dhl from '../integrations/dhl';
import * as accounts from './accounts';
import type { Customer, Dashboard, Order, OrderEvent, OrderFull, OrderLine, OrderRow, OrderSource, OrderStatus, PaymentStatus, Satisfaction, Message, ShippingCompany } from '../types';

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

const EDITABLE = ['lines', 'notes', 'labels', 'desi', 'package_count', 'tax_rate', 'shipping_payer', 'shipping_fee', 'payment_status', 'payment_method', 'source'] as const;
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
    const rawQty = toNumber(raw.qty ?? 1);
    if (rawQty == null || Number.isNaN(rawQty) || rawQty <= 0 || rawQty > 1000000) throw httpError(400, `"${name}" için miktar geçersiz`);
    const qty = Number(rawQty.toFixed(4));
    const price = toNumber(raw.price);
    if (price != null && (Number.isNaN(price) || price < 0)) throw httpError(400, `"${name}" için fiyat geçersiz`);
    const unitsPerPackage = Number(raw.units_per_package ?? 1);
    if (!Number.isInteger(unitsPerPackage) || unitsPerPackage < 1 || unitsPerPackage > 100000) throw httpError(400, `"${name}" için paket içi birim adedi geçersiz`);
    const unitPrice = toNumber(raw.unit_price);
    if (unitPrice != null && (Number.isNaN(unitPrice) || unitPrice < 0)) throw httpError(400, `"${name}" için birim fiyat geçersiz`);
    const pid = Number(raw.product_id);
    const line: OrderLine = Number.isInteger(pid) && pid > 0 ? { name, qty, price, product_id: pid } : { name, qty, price };
    line.units_per_package = unitsPerPackage;
    line.unit_name = String(raw.unit_name || 'adet').replace(/\s+/g, ' ').trim().slice(0, 24) || 'adet';
    line.package_name = String(raw.package_name || (unitsPerPackage > 1 ? 'paket' : 'adet')).replace(/\s+/g, ' ').trim().slice(0, 24) || 'adet';
    line.unit_price = unitPrice == null ? null : round2(unitPrice);
    const variant = String(raw.variant ?? '').replace(/\s+/g, ' ').trim().slice(0, 240);
    if (variant) line.variant = variant;
    out.push(line);
  }
  return out;
}

export const linesSummary = (lines: OrderLine[]) => lines.map((l) => {
  const packageName = l.package_name || 'adet';
  const unitsPerPackage = l.units_per_package || 1;
  const packageDetails = unitsPerPackage > 1 ? ` (${l.qty * unitsPerPackage} ${l.unit_name || 'adet'})` : '';
  return `${l.qty} ${packageName}${packageDetails} ${l.name}${l.variant ? ` (${l.variant})` : ''}`;
}).join(', ');

export function calcTotals(lines: OrderLine[], shippingFee: number, taxRate = 0) {
  const subtotal = round2(lines.reduce((s, l) => s + l.qty * (l.price || 0), 0));
  const rate = Math.max(0, Math.min(100, Number(taxRate) || 0));
  const tax = round2((subtotal + (shippingFee || 0)) * (rate / 100));
  return { subtotal, tax, total: round2(subtotal + tax + (shippingFee || 0)) };
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
  if ('source' in d) {
    const s = String(d.source || DEFAULT_SOURCE).trim().toLowerCase();
    if (!ORDER_SOURCES[s as OrderSource]) throw httpError(400, 'Geçersiz sipariş kanalı');
    out.source = s;
  }
  if ('desi' in d) {
    const v = toNumber(d.desi);
    if (v != null && (Number.isNaN(v) || v < 0)) throw httpError(400, 'Desi geçersiz');
    out.desi = v;
  }
  if ('package_count' in d) {
    const v = parseInt(String(d.package_count), 10);
    out.package_count = Number.isFinite(v) && v > 0 ? v : 1;
  }
  if ('tax_rate' in d) {
    const v = toNumber(d.tax_rate);
    if (v != null && (Number.isNaN(v) || v < 0 || v > 100)) throw httpError(400, 'KDV oranı geçersiz');
    out.tax_rate = v || 0;
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
  const normalized: Record<string, unknown> = { ...rest, tax_rate: Number(rest.tax_rate ?? 0) || 0 };
  // Eski yerel yedeklerde de kapandı kayıtlarını teslim edildi olarak göster.
  if (normalized.status === 'kapandi') normalized.status = 'teslim_edildi';
  if (!normalized.shipping_company && normalized.dhl_tracking_no) normalized.shipping_company = 'dhl';
  if (!normalized.shipping_tracking_no && normalized.dhl_tracking_no) normalized.shipping_tracking_no = normalized.dhl_tracking_no;
  return { ...normalized, lines } as Omit<T, 'lines_json'> & { lines: OrderLine[] };
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
    tracking_url: order.shipping_company === 'dhl' && order.shipping_tracking_no ? trackingUrl(order.shipping_tracking_no) : null,
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
    const conds: Cond[] = [ilike('items', like), ilike('dhl_tracking_no', like), ilike('shipping_tracking_no', like)];
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

/** DHL toplu gönderi dosyası için siparişler + müşterileri (sipariş numarasına göre sıralı). */
export async function listForDhlExport(opts: { statuses: OrderStatus[]; skipTracked: boolean }): Promise<{ order: Order; customer: Customer }[]> {
  const where: Where[] = [isIn('status', opts.statuses), or([isNull('shipping_company'), eq('shipping_company', 'dhl')])];
  if (opts.skipTracked) {
    where.push(or([isNull('shipping_tracking_no'), eq('shipping_tracking_no', '')]));
    where.push(or([isNull('dhl_tracking_no'), eq('dhl_tracking_no', '')]));
  }
  const rows = await db.selectAll({ table: 'orders', where, order: [{ col: 'order_no' }] }, 500, 2000);
  const ids = [...new Set(rows.map((r) => Number(r.customer_id)))];
  const custs = ids.length ? await db.selectAll<Customer>({ table: 'customers', where: [isIn('id', ids)] }) : [];
  const map = new Map(custs.map((c) => [c.id, c]));
  return rows.map((r) => ({ order: hydrate(r) as Order, customer: map.get(Number(r.customer_id)) as Customer })).filter((x) => x.customer);
}

/** Porego sipariş aktarımı için hazırlandı durumundaki tüm siparişler ve müşterileri. */
export async function listForPoregoExport(selectedOrderIds?: number[]): Promise<{ order: Order; customer: Customer }[]> {
  const where: Where[] = selectedOrderIds?.length ? [isIn('id', selectedOrderIds)] : [eq('status', 'hazirlandi')];
  const rows = await db.selectAll({ table: 'orders', where, order: [{ col: 'order_no' }] }, 500, 2000);
  const customerIds = [...new Set(rows.map((r) => Number(r.customer_id)))];
  const custs = customerIds.length ? await db.selectAll<Customer>({ table: 'customers', where: [isIn('id', customerIds)] }) : [];
  const map = new Map(custs.map((c) => [c.id, c]));
  return rows.map((r) => ({ order: hydrate(r) as Order, customer: map.get(Number(r.customer_id)) as Customer })).filter((x) => x.customer);
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
    shipping_payer: 'gonderici', shipping_fee: 0, payment_status: 'bekleniyor', payment_method: '', source: DEFAULT_SOURCE,
    ...cleanFields(data),
  } as Record<string, unknown>;
  if (f.payment_method === ACCOUNT_PAYMENT_METHOD && f.payment_status !== 'bekleniyor') {
    throw httpError(400, 'Cari hesaplı siparişin ödemesi tahsilat girilene kadar beklemede kalmalıdır');
  }
  const lines = JSON.parse(f.lines_json as string) as OrderLine[];
  if (!lines.length) throw httpError(400, 'En az bir ürün satırı girin');
  const taxRate = Number(f.tax_rate) || 0;
  const { subtotal, total } = calcTotals(lines, Number(f.shipping_fee) || 0, taxRate);
  if (f.payment_method === ACCOUNT_PAYMENT_METHOD && total <= 0) throw httpError(400, 'Cari hesaba kaydedilecek sipariş tutarı sıfırdan büyük olmalıdır');
  const t = now();
  let id = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const order_no = await nextOrderNo();
    try {
      const row = await S().insert<{ id: number }>('orders', {
        order_no, customer_id: customer.id, status: 'yeni', payment_status: f.payment_status, payment_method: f.payment_method, shipping_payer: f.shipping_payer,
        lines_json: f.lines_json, items: f.items, notes: f.notes, labels: f.labels, desi: f.desi, package_count: f.package_count,
        tax_rate: Number(f.tax_rate) || 0, shipping_fee: f.shipping_fee, subtotal, total, source: f.source, created_at: t, updated_at: t,
      });
      id = row.id;
      break;
    } catch (e) {
      if (attempt < 2 && isUniqueViolation(e)) continue; // aynı anda iki sipariş: numarayı yeniden al
      throw e;
    }
  }
  if (f.payment_method === ACCOUNT_PAYMENT_METHOD) {
    try {
      const createdOrder = await getRaw(id);
      if (!createdOrder) throw httpError(500, 'Sipariş kaydı oluşturulamadı');
      await accounts.syncOrderCharge(createdOrder);
    } catch (e) {
      await S().remove('account_transactions', [eq('order_id', id)]);
      await S().remove('orders', [eq('id', id)]);
      throw e;
    }
  }
  await addEvent(id, 'olusturuldu', `Sipariş oluşturuldu (${ORDER_SOURCES[f.source as OrderSource]?.label || f.source})`);
  if (f.payment_method === ACCOUNT_PAYMENT_METHOD) await addEvent(id, 'cari', 'Sipariş tutarı müşteri cari hesabına borç kaydedildi');
  if (f.payment_status === 'alindi') await addEvent(id, 'odeme', `Ödeme alındı${f.payment_method ? ' · ' + f.payment_method : ''}`);
  await fire('created', (await get(id))!);
  return (await get(id))!;
}

export async function update(id: number | string, data: unknown): Promise<OrderFull> {
  const existing = await getRaw(id);
  if (!existing) throw httpError(404, 'Sipariş bulunamadı');
  const f = cleanFields(data);
  const requestedMethod = String(f.payment_method ?? existing.payment_method ?? '').trim();
  const requestedStatus = f.payment_status ?? existing.payment_status;
  if (existing.payment_method === ACCOUNT_PAYMENT_METHOD && requestedMethod !== ACCOUNT_PAYMENT_METHOD) {
    throw httpError(400, 'Cari hesaba aktarılmış siparişin ödeme yöntemi değiştirilemez; tahsilatı Cari Hesaplar ekranından kaydedin');
  }
  if (requestedMethod === ACCOUNT_PAYMENT_METHOD && requestedStatus !== 'bekleniyor') {
    throw httpError(400, 'Cari hesaplı siparişin ödemesi tahsilat girilene kadar beklemede kalmalıdır');
  }
  const cid = (data as Record<string, unknown> | null)?.customer_id;
  if (cid != null && cid !== '' && Number(cid) !== existing.customer_id) {
    if (!validId(cid as number)) throw httpError(400, 'Geçersiz müşteri');
    const { rows } = await S().select<Customer>({ table: 'customers', where: [eq('id', Number(cid))], limit: 1 });
    if (!rows[0]) throw httpError(404, 'Müşteri bulunamadı');
    f.customer_id = Number(cid);
    await addEvent(existing.id, 'not', `Müşteri değiştirildi: ${rows[0].name || (rows[0].ig_username ? '@' + rows[0].ig_username : '#' + rows[0].id)}`);
  }
  if (!Object.keys(f).length) return (await get(id))!;
  const lines = 'lines_json' in f ? (JSON.parse(f.lines_json as string) as OrderLine[]) : existing.lines;
  if (!lines.length) throw httpError(400, 'En az bir ürün satırı girin');
  const shippingFee = 'shipping_fee' in f ? Number(f.shipping_fee) : existing.shipping_fee;
  const taxRate = 'tax_rate' in f ? Number(f.tax_rate) : Number(existing.tax_rate ?? 0);
  const { subtotal, total } = calcTotals(lines, shippingFee, taxRate);
  if (requestedMethod === ACCOUNT_PAYMENT_METHOD && total <= 0) throw httpError(400, 'Cari hesaba kaydedilecek sipariş tutarı sıfırdan büyük olmalıdır');
  f.tax_rate = taxRate;
  f.subtotal = subtotal;
  f.total = total;
  if ('payment_status' in f && f.payment_status !== existing.payment_status) {
    await addEvent(existing.id, 'odeme', `Ödeme durumu: ${PAYMENT_STATUSES[f.payment_status as PaymentStatus].label}${f.payment_method ? ' · ' + f.payment_method : ''}`);
  }
  await S().update('orders', [eq('id', existing.id)], { ...f, updated_at: now() });
  if (requestedMethod === ACCOUNT_PAYMENT_METHOD) {
    const updated = await getRaw(existing.id);
    if (updated) await accounts.syncOrderCharge(updated);
  }
  return (await get(id))!;
}

export async function remove(id: number | string): Promise<boolean> {
  const existing = await getRaw(id);
  if (!existing) throw httpError(404, 'Sipariş bulunamadı');
  await S().update('messages', [eq('order_id', existing.id)], { order_id: null });
  await S().remove('account_transactions', [eq('order_id', existing.id)]);
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
  const t = now();
  const patch: Record<string, unknown> = { status, updated_at: t };
  if (status === 'kargoya_verildi') patch.shipped_at = t;
  if (status === 'teslim_edildi') {
    patch.delivered_at = t;
    patch.closed_at = t;
    if (order.dhl_tracking_no && order.dhl_status !== 'delivered') { patch.dhl_status = 'delivered'; patch.dhl_status_text = 'Teslim edildi'; }
  }
  if (status === 'iptal') patch.closed_at = t;
  await S().update('orders', [eq('id', order.id)], patch);
  const by = opts.by || 'panel';
  await addEvent(order.id, 'durum', `${from.label} → ${STATUSES[status].label}${opts.note ? ' · ' + opts.note : ''}`, { from: order.status, to: status, by });
  if (status === 'iptal' && order.payment_method === ACCOUNT_PAYMENT_METHOD) {
    await S().remove('account_transactions', [eq('order_id', order.id)]);
    await addEvent(order.id, 'cari', 'İptal edilen siparişin cari borç hareketi kaldırıldı');
  }
  // DHL API ile oluşturulmuş sipariş (referans + DHL sipariş kaydı) iptal edilince DHL tarafında da iptal dene; başarısızlık akışı durdurmaz.
  if (status === 'iptal' && order.dhl_tracking_no && order.dhl_shipment_ref && dhl.canCreate()) {
    try {
      await dhl.cancelShipment(order.dhl_tracking_no);
      await addEvent(order.id, 'kargo', `DHL siparişi iptal edildi · Referans: ${order.dhl_tracking_no}`, { reference: order.dhl_tracking_no });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await addEvent(order.id, 'kargo', `DHL iptali yapılamadı: ${msg}`, { reference: order.dhl_tracking_no, error: msg });
    }
  }
  await fire('status', { order: (await get(id))!, from: order.status, to: status, by });
  return (await get(id))!;
}

/** Kargo şirketini ve isteğe bağlı takip numarasını kaydeder, siparişi kargoya verildi yapar. */
export async function recordShipment(id: number | string, { company, tracking_no, shipment_ref, by }: { company: ShippingCompany; tracking_no?: string; shipment_ref?: string | null; by?: string }): Promise<OrderFull> {
  const order = await getRaw(id);
  if (!order) throw httpError(404, 'Sipariş bulunamadı');
  const tracking = String(tracking_no || '').replace(/\s+/g, '').trim();
  if (!SHIPPING_COMPANIES[company]) throw httpError(400, 'Geçersiz kargo şirketi');
  if (['iptal', 'teslim_edildi'].includes(order.status)) throw httpError(400, 'Bu sipariş için kargo kaydı yapılamaz');
  if (company !== 'elden_teslim' && order.status === 'yeni') await setStatus(id, 'hazirlaniyor', { by: by || 'panel', note: 'Kargo kaydı ile otomatik' });
  const patch: Record<string, unknown> = {
    shipping_company: company,
    shipping_tracking_no: tracking || null,
    dhl_tracking_no: company === 'dhl' ? (tracking || null) : null,
    dhl_shipment_ref: company === 'dhl' ? shipment_ref || null : null,
    updated_at: now(),
  };
  if (company === 'dhl') {
    patch.dhl_status = tracking ? 'created' : null;
    patch.dhl_status_text = tracking ? 'Takip numarası kaydedildi' : null;
  } else {
    patch.dhl_status = null;
    patch.dhl_status_text = null;
  }
  await S().update('orders', [eq('id', order.id)], patch);
  await addEvent(order.id, 'kargo', `${SHIPPING_COMPANIES[company]}${company === 'elden_teslim' ? ' olarak teslim edildi' : ' kargoya verildi'}${tracking ? ` · Takip No: ${tracking}` : ''}`, { company, tracking_no: tracking || null, shipment_ref: shipment_ref || null });
  if (company === 'elden_teslim') return setStatus(id, 'teslim_edildi', { by: by || 'panel', note: 'Elden teslim', force: true });
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
    if (o.payment_status === 'bekleniyor' && o.status !== 'iptal' && o.status !== 'teslim_edildi') unpaid += 1;
  }
  const pending_messages = (await S().select({ table: 'messages', columns: ['id'], where: [eq('direction', 'out'), isIn('status', ['failed', 'pending'])], limit: 1, count: true })).count || 0;
  const unread = (await S().select({ table: 'messages', columns: ['id'], where: [eq('direction', 'in'), eq('is_read', 0)], limit: 1, count: true })).count || 0;
  const evs = (await S().select<OrderEvent & { meta: string | null }>({ table: 'order_events', order: [{ col: 'id', asc: false }], limit: 20 })).rows;
  const evOrderIds = [...new Set(evs.map((e) => e.order_id))];
  const noMap = new Map(evOrderIds.length ? (await S().select<{ id: number; order_no: number }>({ table: 'orders', columns: ['id', 'order_no'], where: [isIn('id', evOrderIds)], limit: evOrderIds.length })).rows.map((o) => [o.id, o.order_no]) : []);
  const recent_events = evs.map((e) => ({ ...e, meta: safeJson(e.meta as unknown as string), order_no: noMap.get(e.order_id) || 0 }));
  return {
    counts,
    attention: { pending_messages, unhappy, unread, no_tracking: counts.hazirlaniyor + counts.hazirlandi, unpaid },
    recent_events, today_count, month_count, month_revenue: round2(month_revenue),
    new_orders: (await list({ status: 'yeni', pageSize: 8 })).rows,
    awaiting_shipment: (await list({ statuses: ['hazirlaniyor', 'hazirlandi'], pageSize: 8 })).rows,
    in_transit: (await list({ status: 'kargoya_verildi', pageSize: 8 })).rows,
  };
}

export { STATUSES, ACTIVE_STATUSES };
