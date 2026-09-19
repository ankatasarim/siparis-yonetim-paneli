import * as db from '../db';
import { eq, ilike, isIn, or } from '../store';
import { httpError, now, pick, round2 } from '../utils';
import type { Customer, CustomerRow } from '../types';

const FIELDS = ['name', 'email', 'phone', 'address', 'city', 'district', 'postal_code', 'notes', 'ig_username', 'ig_user_id', 'profile_pic'] as const;
const NULLABLE = new Set(['ig_user_id', 'ig_username', 'profile_pic']);
const validId = (id: number | string) => Number.isInteger(Number(id)) && Number(id) > 0;

function clean(data: unknown): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(pick(data as object, FIELDS))) {
    out[k] = v == null ? (NULLABLE.has(k) ? null : '') : String(v).trim();
  }
  if (out.ig_username) out.ig_username = out.ig_username.replace(/^@/, '');
  if (out.ig_username === '') out.ig_username = null;
  if (out.ig_user_id === '') out.ig_user_id = null;
  if (out.profile_pic === '') out.profile_pic = null;
  return out;
}

export async function get(id: number | string): Promise<Customer | null> {
  if (!validId(id)) return null;
  const { rows } = await db.store().select<Customer>({ table: 'customers', where: [eq('id', Number(id))], limit: 1 });
  return rows[0] || null;
}

export async function findByIg(igUserId: string | null | undefined): Promise<Customer | null> {
  if (!igUserId) return null;
  const { rows } = await db.store().select<Customer>({ table: 'customers', where: [eq('ig_user_id', String(igUserId))], limit: 1 });
  return rows[0] || null;
}

export async function list({ q, limit = 200 }: { q?: string | null; limit?: number | string } = {}): Promise<CustomerRow[]> {
  const like = q && String(q).trim() ? `%${String(q).trim()}%` : null;
  const where = like ? [or(['name', 'phone', 'email', 'ig_username', 'address', 'city'].map((c) => ilike(c, like)))] : [];
  const { rows: custs } = await db.store().select<Customer>({ table: 'customers', where, order: [{ col: 'updated_at', asc: false }], limit: Math.min(1000, Number(limit) || 200) });
  if (!custs.length) return [];
  const ids = custs.map((c) => c.id);
  const ords = await db.selectAll<{ customer_id: number; total: number; status: string; created_at: string }>({
    table: 'orders', columns: ['customer_id', 'total', 'status', 'created_at'], where: [isIn('customer_id', ids)],
  });
  const unread = await db.selectAll<{ customer_id: number }>({
    table: 'messages', columns: ['customer_id'], where: [isIn('customer_id', ids), eq('direction', 'in'), eq('is_read', 0)],
  });
  const agg = new Map<number, { count: number; last: string | null; spent: number; unread: number }>();
  const at = (id: number) => { let x = agg.get(id); if (!x) { x = { count: 0, last: null, spent: 0, unread: 0 }; agg.set(id, x); } return x; };
  for (const o of ords) {
    const x = at(o.customer_id);
    x.count += 1;
    if (!x.last || o.created_at > x.last) x.last = o.created_at;
    if (o.status !== 'iptal') x.spent += Number(o.total) || 0;
  }
  for (const m of unread) at(m.customer_id).unread += 1;
  return custs
    .map((c) => { const x = agg.get(c.id); return { ...c, order_count: x?.count || 0, last_order_at: x?.last || null, total_spent: round2(x?.spent || 0), unread: x?.unread || 0 }; })
    .sort((a, b) => String(b.last_order_at || b.updated_at).localeCompare(String(a.last_order_at || a.updated_at)));
}

export async function create(data: unknown): Promise<Customer> {
  const c = clean(data);
  if (!c.name && !c.ig_username && !c.ig_user_id) throw httpError(400, 'Müşteri adı gerekli');
  if (c.ig_user_id && (await findByIg(c.ig_user_id))) throw httpError(409, 'Bu Instagram hesabına bağlı müşteri zaten var');
  const t = now();
  return db.store().insert<Customer>('customers', {
    ig_user_id: c.ig_user_id || null, ig_username: c.ig_username || null, name: c.name || '', email: c.email || '', phone: c.phone || '',
    address: c.address || '', city: c.city || '', district: c.district || '', postal_code: c.postal_code || '', notes: c.notes || '',
    profile_pic: c.profile_pic || null, created_at: t, updated_at: t,
  });
}

export async function update(id: number | string, data: unknown): Promise<Customer> {
  const existing = await get(id);
  if (!existing) throw httpError(404, 'Müşteri bulunamadı');
  const c = clean(data);
  if (c.ig_user_id) {
    const other = await findByIg(c.ig_user_id);
    if (other && other.id !== existing.id) throw httpError(409, 'Bu Instagram hesabı başka bir müşteriye bağlı');
  }
  if (!Object.keys(c).length) return existing;
  const rows = await db.store().update<Customer>('customers', [eq('id', existing.id)], { ...c, updated_at: now() });
  return rows[0] || (await get(id))!;
}

/** Instagram'dan gelen kullanıcıyı bulur, yoksa oluşturur; profil bilgilerini günceller. */
export async function upsertByIg(igUserId: string, profile: { username?: string | null; name?: string | null; profile_pic?: string | null } = {}): Promise<Customer> {
  const existing = await findByIg(igUserId);
  if (existing) {
    const patch: Record<string, string> = {};
    if (profile.username && profile.username !== existing.ig_username) patch.ig_username = profile.username;
    if (profile.name && !existing.name) patch.name = profile.name;
    if (profile.profile_pic && profile.profile_pic !== existing.profile_pic) patch.profile_pic = profile.profile_pic;
    return Object.keys(patch).length ? update(existing.id, patch) : existing;
  }
  return create({ ig_user_id: String(igUserId), ig_username: profile.username || null, name: profile.name || '', profile_pic: profile.profile_pic || null });
}

export async function remove(id: number | string): Promise<boolean> {
  const c = await get(id);
  if (!c) throw httpError(404, 'Müşteri bulunamadı');
  const { count } = await db.store().select({ table: 'orders', columns: ['id'], where: [eq('customer_id', c.id)], limit: 1, count: true });
  if ((count || 0) > 0) throw httpError(400, 'Siparişi olan müşteri silinemez');
  await db.store().remove('messages', [eq('customer_id', c.id)]);
  await db.store().remove('customers', [eq('id', c.id)]);
  return true;
}
