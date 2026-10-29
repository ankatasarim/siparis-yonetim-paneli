import * as db from '../db';
import { eq, ilike, or, type Where } from '../store';
import { httpError, now, pick, round2, toNumber } from '../utils';
import type { Product, ProductOptionGroup } from '../types';

/**
 * Ürün kataloğu: sipariş formunda satır eklerken buradan seçilir; ad ve fiyat satıra kopyalanır.
 * options (varyasyon grupları) DB'de options_json olarak saklanır; string listeler eski şemadan uyumluluk için desteklenir.
 */

const FIELDS = ['name', 'price', 'units_per_package', 'unit_price', 'unit_name', 'package_name', 'description', 'image', 'desi', 'options', 'active', 'sort_order'] as const;
const MAX_OPTION_GROUPS = 10;
const MAX_OPTION_VALUES = 100;
const validId = (id: number | string) => Number.isInteger(Number(id)) && Number(id) > 0;

/** Baz birim fiyatını satış paketine çevirir; para değerleri kuruş hassasiyetinde tutulur. */
export const packagePrice = (unitPrice: number, unitsPerPackage: number) => round2(unitPrice * unitsPerPackage);

/** Eski string listelerini tek bir "Seçenek" grubuna dönüştürür. */
export function parseProductOptions(input: unknown): ProductOptionGroup[] {
  const legacyValues = (value: unknown): string[] => {
    const raw: unknown[] = Array.isArray(value) ? value : String(value ?? '').split(/[,\n;]/);
    const values: string[] = [];
    for (const item of raw) {
      const text = String(item ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
      if (text && !values.some((x) => x.toLocaleLowerCase('tr') === text.toLocaleLowerCase('tr'))) values.push(text);
      if (values.length >= MAX_OPTION_VALUES) break;
    }
    return values;
  };

  if (typeof input === 'string') {
    const values = legacyValues(input);
    return values.length ? [{ name: 'Seçenek', values }] : [];
  }
  if (!Array.isArray(input) || !input.length) return [];
  if (input.every((item) => typeof item !== 'object' || item === null || Array.isArray(item))) {
    const values = legacyValues(input);
    return values.length ? [{ name: 'Seçenek', values }] : [];
  }

  const groups: ProductOptionGroup[] = [];
  let totalValues = 0;
  for (const raw of input.slice(0, MAX_OPTION_GROUPS)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    const name = String(item.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!name || groups.some((group) => group.name.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'))) continue;
    const values = legacyValues(item.values).slice(0, Math.max(0, MAX_OPTION_VALUES - totalValues));
    if (!values.length) continue;
    groups.push({ name, values });
    totalValues += values.length;
    if (totalValues >= MAX_OPTION_VALUES) break;
  }
  return groups;
}

function hydrate<T extends Record<string, unknown>>(row: T | null): Product | null {
  if (!row) return null;
  let options: ProductOptionGroup[] = [];
  try { options = parseProductOptions(JSON.parse((row.options_json as string) || '[]')); } catch { options = []; }
  const { options_json: _oj, ...rest } = row;
  const unitsPerPackage = Math.max(1, Number(rest.units_per_package) || 1);
  const packagePriceValue = rest.price == null ? null : Number(rest.price);
  const unitPrice = rest.unit_price == null
    ? packagePriceValue == null ? null : round2(packagePriceValue / unitsPerPackage)
    : Number(rest.unit_price);
  return {
    ...(rest as unknown as Product),
    price: packagePriceValue,
    units_per_package: unitsPerPackage,
    unit_price: unitPrice,
    unit_name: String(rest.unit_name || 'adet'),
    package_name: String(rest.package_name || (unitsPerPackage > 1 ? 'paket' : 'adet')),
    options,
  };
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
  if ('units_per_package' in d) {
    const v = toNumber(d.units_per_package);
    if (v == null || !Number.isInteger(v) || v < 1 || v > 100000) throw httpError(400, 'Paket içi adet 1 veya daha büyük tam sayı olmalı');
    out.units_per_package = v;
  }
  if ('unit_price' in d) {
    const v = toNumber(d.unit_price);
    if (v != null && (Number.isNaN(v) || v < 0)) throw httpError(400, 'Birim fiyat geçersiz');
    out.unit_price = v == null ? null : round2(v);
  }
  if ('unit_name' in d) {
    const v = String(d.unit_name || '').replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!v) throw httpError(400, 'İç birim adı gerekli');
    out.unit_name = v;
  }
  if ('package_name' in d) {
    const v = String(d.package_name || '').replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!v) throw httpError(400, 'Satış birimi adı gerekli');
    out.package_name = v;
  }
  if ('options' in d) out.options_json = JSON.stringify(parseProductOptions(d.options));
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
  const unitsPerPackage = Number(c.units_per_package ?? 1);
  const unitPrice = c.unit_price == null ? null : Number(c.unit_price);
  const price = unitPrice != null ? packagePrice(unitPrice, unitsPerPackage) : c.price ?? null;
  const row = await db.store().insert<Record<string, unknown>>('products', {
    name: c.name, price, units_per_package: unitsPerPackage, unit_price: unitPrice,
    unit_name: c.unit_name ?? 'adet', package_name: c.package_name ?? (unitsPerPackage > 1 ? 'paket' : 'adet'),
    description: c.description ?? '', image: c.image ?? '', desi: c.desi ?? 0, options_json: c.options_json ?? '[]',
    active: c.active ?? 1, sort_order: c.sort_order ?? 0, created_at: t, updated_at: t,
  });
  return hydrate(row)!;
}

export async function update(id: number | string, data: unknown): Promise<Product> {
  const existing = await get(id);
  if (!existing) throw httpError(404, 'Ürün bulunamadı');
  const c = clean(data);
  if (!Object.keys(c).length) return existing;
  const changesPricing = 'units_per_package' in c || 'unit_price' in c || 'price' in c;
  if (changesPricing) {
    const unitsPerPackage = Number(c.units_per_package ?? existing.units_per_package);
    c.units_per_package = unitsPerPackage;
    if ('price' in c && !('unit_price' in c)) {
      // Eski istemciler price alanını satış/paket fiyatı olarak gönderir.
      const packagePriceValue = c.price as number | null;
      c.unit_price = packagePriceValue == null ? null : round2(packagePriceValue / unitsPerPackage);
    } else {
      const unitPrice = 'unit_price' in c ? c.unit_price as number | null : existing.unit_price;
      c.unit_price = unitPrice;
      c.price = unitPrice != null ? packagePrice(unitPrice, unitsPerPackage) : null;
    }
  }
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
