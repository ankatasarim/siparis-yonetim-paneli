import * as db from '../db';
import { eq, ilike, or, type Where } from '../store';
import { httpError, now, pick, toNumber } from '../utils';
import type { Product } from '../types';

/**
 * Ürün kataloğu: sipariş formunda satır eklerken buradan seçilir; ad ve fiyat satıra kopyalanır.
 * options (renk vb.) DB'de options_json (JSON dizi) olarak saklanır; doluysa sipariş satırında seçim kutusu çıkar.
 */

const FIELDS = ['name', 'price', 'description', 'image', 'desi', 'options', 'active', 'sort_order'] as const;
const MAX_OPTIONS = 50;
const validId = (id: number | string) => Number.isInteger(Number(id)) && Number(id) > 0;

/** Dizi ya da "Kırmızı, Sarı" gibi virgül/satır ayrılmış metin → temiz, tekrarsız liste. */
export function parseOptions(input: unknown): string[] {
  const raw: unknown[] = Array.isArray(input) ? input : String(input ?? '').split(/[,\n;]/);
  const out: string[] = [];
  for (const v of raw) {
    const s = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (s && !out.some((x) => x.toLocaleLowerCase('tr') === s.toLocaleLowerCase('tr'))) out.push(s);
    if (out.length >= MAX_OPTIONS) break;
  }
  return out;
}

function hydrate<T extends Record<string, unknown>>(row: T | null): Product | null {
  if (!row) return null;
  let options: string[] = [];
  try { const v = JSON.parse((row.options_json as string) || '[]'); options = Array.isArray(v) ? v.map(String) : []; } catch { options = []; }
  const { options_json: _oj, ...rest } = row;
  return { ...(rest as unknown as Product), options };
}

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
  if ('options' in d) out.options_json = JSON.stringify(parseOptions(d.options));
  if ('active' in d) out.active = d.active === false || d.active === 0 || d.active === '0' ? 0 : 1;
  if ('sort_order' in d) {
    const v = parseInt(String(d.sort_order), 10);
    out.sort_order = Number.isFinite(v) ? v : 0;
  }
  return out;
}

export async function get(id: number | string): Promise<Product | null> {
  if (!validId(id)) return null;
  const { rows } = await db.store().select<Record<string, unknown>>({ table: 'products', where: [eq('id', Number(id))], limit: 1 });
  return hydrate(rows[0] || null);
}

export async function list({ q, active }: { q?: string | null; active?: boolean | null } = {}): Promise<Product[]> {
  const where: Where[] = [];
  const like = q && String(q).trim() ? `%${String(q).trim()}%` : null;
  if (like) where.push(or([ilike('name', like), ilike('description', like)]));
  if (active != null) where.push(eq('active', active ? 1 : 0));
  const rows = await db.selectAll<Record<string, unknown>>({ table: 'products', where, order: [{ col: 'sort_order' }, { col: 'name' }] });
  return rows.map((r) => hydrate(r)!).filter(Boolean);
}

export async function create(data: unknown): Promise<Product> {
  const c = clean(data);
  if (!c.name) throw httpError(400, 'Ürün adı gerekli');
  const t = now();
  const row = await db.store().insert<Record<string, unknown>>('products', {
    name: c.name, price: c.price ?? null, description: c.description ?? '', image: c.image ?? '', desi: c.desi ?? 0, options_json: c.options_json ?? '[]',
    active: c.active ?? 1, sort_order: c.sort_order ?? 0, created_at: t, updated_at: t,
  });
  return hydrate(row)!;
}

export async function update(id: number | string, data: unknown): Promise<Product> {
  const existing = await get(id);
  if (!existing) throw httpError(404, 'Ürün bulunamadı');
  const c = clean(data);
  if (!Object.keys(c).length) return existing;
  const rows = await db.store().update<Record<string, unknown>>('products', [eq('id', existing.id)], { ...c, updated_at: now() });
  return hydrate(rows[0] || null) || (await get(id))!;
}

/** Siler. Eski siparişlerdeki satırlar etkilenmez (ad, fiyat ve seçenek satırda saklıdır). */
export async function remove(id: number | string): Promise<boolean> {
  const p = await get(id);
  if (!p) throw httpError(404, 'Ürün bulunamadı');
  await db.store().remove('products', [eq('id', p.id)]);
  return true;
}
