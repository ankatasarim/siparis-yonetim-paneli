import * as db from '../db';
import { eq, ilike, or, type Where } from '../store';
import { httpError, now, pick, toNumber } from '../utils';
import type { Product } from '../types';

/** Ürün kataloğu: sipariş formunda satır eklerken buradan seçilir; ad ve fiyat satıra kopyalanır. */

const FIELDS = ['name', 'price', 'description', 'image', 'desi', 'active', 'sort_order'] as const;
const validId = (id: number | string) => Number.isInteger(Number(id)) && Number(id) > 0;

function clean(data: unknown): Record<string, unknown> {
  const d = pick(data as object, FIELDS);
  const out: Record<string, unknown> = {};
  if ('name' in d) {
    out.name = String(d.name || '').trim();
    if (!out.name) throw httpError(400, 'Ürün adı gerekli');
  }
  if ('description' in d) out.description = String(d.description || '').trim();
  if ('image' in d) out.image = String(d.image || '').trim();
  if ('desi' in d) {
    const v = toNumber(d.desi);
    if (v != null && (Number.isNaN(v) || v < 0)) throw httpError(400, 'Desi geçersiz');
    out.desi = v ?? 0;
  }
  if ('price' in d) {
    const v = toNumber(d.price);
    if (v != null && (Number.isNaN(v) || v < 0)) throw httpError(400, 'Fiyat geçersiz');
    out.price = v;
  }
  if ('active' in d) out.active = d.active === false || d.active === 0 || d.active === '0' ? 0 : 1;
  if ('sort_order' in d) {
    const v = parseInt(String(d.sort_order), 10);
    out.sort_order = Number.isFinite(v) ? v : 0;
  }
  return out;
}

export async function get(id: number | string): Promise<Product | null> {
  if (!validId(id)) return null;
  const { rows } = await db.store().select<Product>({ table: 'products', where: [eq('id', Number(id))], limit: 1 });
  return rows[0] || null;
}

export async function list({ q, active }: { q?: string | null; active?: boolean | null } = {}): Promise<Product[]> {
  const where: Where[] = [];
  const like = q && String(q).trim() ? `%${String(q).trim()}%` : null;
  if (like) where.push(or([ilike('name', like), ilike('description', like)]));
  if (active != null) where.push(eq('active', active ? 1 : 0));
  return db.selectAll<Product>({ table: 'products', where, order: [{ col: 'sort_order' }, { col: 'name' }] });
}

export async function create(data: unknown): Promise<Product> {
  const c = clean(data);
  if (!c.name) throw httpError(400, 'Ürün adı gerekli');
  const t = now();
  return db.store().insert<Product>('products', {
    name: c.name, price: c.price ?? null, description: c.description ?? '', image: c.image ?? '', desi: c.desi ?? 0,
    active: c.active ?? 1, sort_order: c.sort_order ?? 0, created_at: t, updated_at: t,
  });
}

export async function update(id: number | string, data: unknown): Promise<Product> {
  const existing = await get(id);
  if (!existing) throw httpError(404, 'Ürün bulunamadı');
  const c = clean(data);
  if (!Object.keys(c).length) return existing;
  const rows = await db.store().update<Product>('products', [eq('id', existing.id)], { ...c, updated_at: now() });
  return rows[0] || (await get(id))!;
}

/** Siler. Eski siparişlerdeki satırlar etkilenmez (ad ve fiyat satırda saklıdır). */
export async function remove(id: number | string): Promise<boolean> {
  const p = await get(id);
  if (!p) throw httpError(404, 'Ürün bulunamadı');
  await db.store().remove('products', [eq('id', p.id)]);
  return true;
}
