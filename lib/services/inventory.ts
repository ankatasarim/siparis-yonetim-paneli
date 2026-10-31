import * as db from '../db';
import { eq, type Row } from '../store';
import { httpError, now, round2, toNumber } from '../utils';
import * as products from './products';
import type { InventoryMovement, InventoryVariant, Order, OrderLine, Product } from '../types';

const trackedStatus = (status: string) => ['yeni', 'hazirlaniyor', 'hazirlandi'].includes(status);
const shippedStatus = (status: string) => ['kargoya_verildi', 'teslim_edildi'].includes(status);
const amount = (v: unknown) => Math.round((Number(v) || 0) * 10000) / 10000;

type StockTarget = { product: Product; variant?: InventoryVariant | null };
type StockRow = { product_id: number; product_name: string; unit_name: string; inventory_enabled: number; variant_id: number | null; variant_key: string | null; variant_label: string | null; sku: string; stock_on_hand: number; stock_reserved: number; low_stock_threshold: number; legacy?: boolean };

const productVariantLabels = (p: Product): string[] => {
  if (!p.options.length) return [];
  let combinations = [''];
  for (const group of p.options) {
    if (combinations.length * group.values.length > 2000) throw httpError(400, `"${p.name}" ürününde 2.000'den fazla varyasyon kombinasyonu var; stok takibi için seçenekleri sadeleştirin`);
    combinations = combinations.flatMap((previous) => group.values.map((value) => previous ? `${previous} · ${group.name}: ${value}` : `${group.name}: ${value}`));
  }
  return combinations;
};

async function getOrCreateVariant(p: Product, label: string): Promise<InventoryVariant> {
  if (!productVariantLabels(p).includes(label)) throw httpError(400, 'Varyasyon seçimi bu ürün için geçerli değil');
  if (db.kind() === 'supabase') {
    const id = Number(await db.store().rpc<number>('inventory_ensure_variant', { p_product_id: p.id, p_label: label }));
    const created = (await db.store().select<InventoryVariant>({ table: 'inventory_variants', where: [eq('id', id), eq('product_id', p.id)], limit: 1 })).rows[0];
    if (!created) throw httpError(500, 'Varyasyon stok kaydı oluşturulamadı');
    return created;
  }
  const found = (await db.store().select<InventoryVariant>({ table: 'inventory_variants', where: [eq('product_id', p.id), eq('variant_key', label)], limit: 1 })).rows[0];
  if (found) return found;
  return db.store().insert<InventoryVariant>('inventory_variants', {
    product_id: p.id, variant_key: label, label, sku: '', stock_on_hand: 0, stock_reserved: 0,
    low_stock_threshold: 0, active: 1, inventory_enabled: p.inventory_enabled ? 1 : 0, created_at: now(), updated_at: now(),
    ...(db.kind() === 'local' ? { product_id_variant_key: `${p.id}:${label}` } : {}),
  });
}

async function getStockTarget(productId: number, variantId?: number | null): Promise<StockTarget> {
  const product = await products.get(productId);
  if (!product) throw httpError(404, 'Ürün bulunamadı');
  if (variantId != null) {
    const variant = (await db.store().select<InventoryVariant>({ table: 'inventory_variants', where: [eq('id', variantId), eq('product_id', productId)], limit: 1 })).rows[0];
    if (!variant) throw httpError(404, 'Ürün varyasyonu bulunamadı');
    return { product, variant };
  }
  return { product, variant: null };
}

async function addMovement(p: Product, movement_type: InventoryMovement['movement_type'], quantity: number, fields: { variant?: InventoryVariant | null; unit_cost?: number | null; reference?: string | null; note?: string } = {}) {
  await db.store().insert('inventory_movements', {
    product_id: p.id, variant_id: fields.variant?.id ?? null, variant_label: fields.variant?.label ?? null,
    movement_type, quantity: amount(quantity), unit_cost: fields.unit_cost ?? null,
    reference: fields.reference ?? null, note: fields.note || '', created_at: now(),
  });
}

/** Stock changes use an SQL row lock in Supabase; the local store follows the same validation rules. */
export async function recordMovement(input: { product_id: unknown; variant_id?: unknown; variant_key?: unknown; type: unknown; quantity: unknown; unit_cost?: unknown; reference?: unknown; note?: unknown }) {
  const productId = Number(input.product_id);
  if (!Number.isInteger(productId) || productId < 1) throw httpError(400, 'Ürün seçimi geçersiz');
  const rawType = String(input.type || '');
  if (!['receipt', 'adjustment', 'return'].includes(rawType)) throw httpError(400, 'Stok hareketi türü geçersiz');
  const type = rawType as 'receipt' | 'adjustment' | 'return';
  const quantity = toNumber(input.quantity);
  if (quantity == null || Number.isNaN(quantity) || quantity === 0 || Math.abs(quantity) > 100000000 || (type !== 'adjustment' && quantity < 0)) throw httpError(400, 'Miktar geçersiz');
  const unitCost = input.unit_cost == null || input.unit_cost === '' ? null : toNumber(input.unit_cost);
  if (unitCost != null && (Number.isNaN(unitCost) || unitCost < 0)) throw httpError(400, 'Birim maliyet geçersiz');
  const variantId = input.variant_id == null || input.variant_id === '' ? null : Number(input.variant_id);
  if (variantId != null && (!Number.isInteger(variantId) || variantId < 1)) throw httpError(400, 'Varyasyon seçimi geçersiz');
  let { product: p, variant } = await getStockTarget(productId, variantId);
  if (type === 'receipt' && !p.inventory_enabled) p = await setTracking(p.id, { enabled: true });
  if (!p.inventory_enabled) throw httpError(400, 'Önce ürün için stok takibini etkinleştirin');
  const variantKey = String(input.variant_key || '').trim();
  if (!variant && p.options.length) {
    if (!variantKey) throw httpError(400, 'Varyasyonlu ürünlerde renk/özellik seçimi zorunludur');
    if (type !== 'receipt') throw httpError(400, 'Varyasyon stok kaydı yok; önce bu varyasyona stok girişi yapın');
    variant = await getOrCreateVariant(p, variantKey);
  }
  if (type === 'receipt' && variant && !variant.inventory_enabled) {
    await setVariantSettings(variant.id, { enabled: true });
    variant = (await db.store().select<InventoryVariant>({ table: 'inventory_variants', where: [eq('id', variant.id)], limit: 1 })).rows[0];
  }
  if (variant && !variant.active) throw httpError(400, 'Bu varyasyon artık aktif değil');
  if (variant && !variant.inventory_enabled) throw httpError(400, 'Önce bu varyasyon için stok takibini etkinleştirin');
  const note = String(input.note || '').trim().slice(0, 500);
  const reference = String(input.reference || '').trim().slice(0, 100) || null;

  if (db.kind() === 'supabase') {
    if (variant) await db.store().rpc('inventory_record_variant_movement', {
      p_variant_id: variant.id, p_movement_type: type, p_quantity: quantity,
      p_unit_cost: unitCost, p_reference: reference, p_note: note,
    });
    else await db.store().rpc('inventory_record_movement', {
      p_product_id: productId, p_movement_type: type, p_quantity: quantity,
      p_unit_cost: unitCost, p_reference: reference, p_note: note,
    });
  } else {
    const onHand = variant ? variant.stock_on_hand : p.stock_on_hand;
    const reserved = variant ? variant.stock_reserved : p.stock_reserved;
    const next = amount(onHand + quantity);
    if (next < reserved) throw httpError(400, `Stok miktarı ayrılmış stoktan (${reserved} ${p.unit_name}) az olamaz`);
    await db.store().update(variant ? 'inventory_variants' : 'products', [eq('id', variant ? variant.id : p.id)], { stock_on_hand: next, updated_at: now() });
    await addMovement(p, type, quantity, { variant, unit_cost: unitCost, reference, note });
  }
  return products.get(productId);
}

export async function setVariantSettings(variantId: number | string, input: { enabled?: unknown; sku?: unknown; low_stock_threshold?: unknown }) {
  const id = Number(variantId);
  const variant = (await db.store().select<InventoryVariant>({ table: 'inventory_variants', where: [eq('id', id)], limit: 1 })).rows[0];
  if (!variant) throw httpError(404, 'Ürün varyasyonu bulunamadı');
  const p = await products.get(variant.product_id);
  if (!p) throw httpError(404, 'Ürün bulunamadı');
  const enabled = input.enabled === false || input.enabled === 0 || input.enabled === '0' ? 0 : 1;
  const patch: Row = { inventory_enabled: enabled, updated_at: now() };
  if (input.sku !== undefined) patch.sku = String(input.sku || '').replace(/\s+/g, '').slice(0, 64);
  if (input.low_stock_threshold !== undefined) {
    const threshold = toNumber(input.low_stock_threshold);
    if (threshold == null || Number.isNaN(threshold) || threshold < 0 || threshold > 100000000) throw httpError(400, 'Minimum stok miktarı geçersiz');
    patch.low_stock_threshold = threshold;
  }
  await db.store().update('inventory_variants', [eq('id', id)], patch);
  if (enabled && !p.inventory_enabled) await products.update(p.id, { inventory_enabled: 1 });
  return db.store().select<InventoryVariant>({ table: 'inventory_variants', where: [eq('id', id)], limit: 1 }).then((result) => result.rows[0]);
}

export async function setTracking(productId: number | string, input: { enabled?: unknown; sku?: unknown; low_stock_threshold?: unknown }) {
  const p = await products.get(productId);
  if (!p) throw httpError(404, 'Ürün bulunamadı');
  const enabled = input.enabled === false || input.enabled === 0 || input.enabled === '0' ? 0 : 1;
  return products.update(productId, {
    inventory_enabled: enabled,
    ...(input.sku !== undefined ? { sku: input.sku } : {}),
    ...(input.low_stock_threshold !== undefined ? { low_stock_threshold: input.low_stock_threshold } : {}),
  });
}

/**
 * Local JSON store lifecycle equivalent of the Supabase order trigger. New and preparing orders reserve stock;
 * shipment converts reservations to physical consumption; cancellation releases only unshipped reservations.
 */
export async function syncOrder(orderId: number, statusOverride?: string) {
  if (db.kind() === 'supabase') return; // DB trigger is the atomic source of truth in production.
  const { rows } = await db.store().select<Row>({ table: 'orders', where: [eq('id', orderId)], limit: 1 });
  const stored = rows[0];
  if (!stored) return;
  let order: Order;
  try { order = { ...stored, lines: JSON.parse(stored.lines_json || '[]') } as Order; }
  catch { order = { ...stored, lines: [] } as unknown as Order; }
  const status = statusOverride || order.status;
  const existing = (await db.store().select<Row>({ table: 'inventory_reservations', where: [eq('order_id', orderId)] })).rows;

  if (shippedStatus(status)) {
    const pending: Array<{ reservation: Row; product: Product; variant: InventoryVariant | null; quantity: number }> = [];
    for (const reservation of existing) {
      if (reservation.state !== 'reserved') continue;
      const p = await products.get(reservation.product_id);
      if (!p) throw httpError(409, 'Siparişte bulunan stok ürünü artık mevcut değil');
      const variant = reservation.variant_id ? (await db.store().select<InventoryVariant>({ table: 'inventory_variants', where: [eq('id', reservation.variant_id)], limit: 1 })).rows[0] || null : null;
      const qty = Number(reservation.quantity) || 0;
      const onHand = variant ? variant.stock_on_hand : p.stock_on_hand;
      const reserved = variant ? variant.stock_reserved : p.stock_reserved;
      if (onHand < qty || reserved < qty) throw httpError(409, `Stok kaydı tutarsız: ${p.name}${variant ? ` (${variant.label})` : ''} (depoda ${onHand}, ayrılmış ${reserved}, rezervasyon ${qty})`);
      pending.push({ reservation, product: p, variant, quantity: qty });
    }
    for (const { reservation, product: p, variant, quantity: qty } of pending) {
      const table = variant ? 'inventory_variants' : 'products';
      const id = variant ? variant.id : p.id;
      await db.store().update(table, [eq('id', id)], { stock_on_hand: amount((variant ? variant.stock_on_hand : p.stock_on_hand) - qty), stock_reserved: amount((variant ? variant.stock_reserved : p.stock_reserved) - qty), updated_at: now() });
      await db.store().update('inventory_reservations', [eq('id', reservation.id)], { state: 'consumed', updated_at: now() });
      await addMovement(p, 'shipment', -qty, { variant, reference: `Sipariş #${order.order_no}`, note: 'Sipariş kargoya verildi; ayrılmış stok depodan çıktı' });
    }
    return;
  }

  if (!trackedStatus(status)) {
    for (const reservation of existing) {
      if (reservation.state !== 'reserved') continue;
      const p = await products.get(reservation.product_id);
      if (!p) continue;
      const variant = reservation.variant_id ? (await db.store().select<InventoryVariant>({ table: 'inventory_variants', where: [eq('id', reservation.variant_id)], limit: 1 })).rows[0] || null : null;
      const qty = Number(reservation.quantity) || 0;
      await db.store().update(variant ? 'inventory_variants' : 'products', [eq('id', variant ? variant.id : p.id)], { stock_reserved: amount(Math.max(0, (variant ? variant.stock_reserved : p.stock_reserved) - qty)), updated_at: now() });
      await db.store().update('inventory_reservations', [eq('id', reservation.id)], { state: 'released', quantity: 0, updated_at: now() });
      await addMovement(p, 'reservation_release', -qty, { variant, reference: `Sipariş #${order.order_no}`, note: 'İptal edilen siparişin stok rezervasyonu bırakıldı' });
    }
    return;
  }

  const desired = new Map<string, { product: Product; variant: InventoryVariant | null; quantity: number }>();
  for (const line of order.lines || []) {
    const productId = Number(line.product_id);
    if (!Number.isInteger(productId) || productId < 1) continue;
    const p = await products.get(productId);
    if (!p || !p.inventory_enabled) continue;
    let variant: InventoryVariant | null = null;
    if (p.options.length) {
      const selection = String(line.variant || '').trim();
      if (!selection || !productVariantLabels(p).includes(selection)) throw httpError(409, `"${p.name}" için siparişte geçerli renk/varyasyon seçimi bulunamadı`);
      variant = (await db.store().select<InventoryVariant>({ table: 'inventory_variants', where: [eq('product_id', p.id), eq('variant_key', selection)], limit: 1 })).rows[0] || null;
      if (!variant || !variant.active) throw httpError(409, `"${p.name}" için ${selection} varyasyonunun stok kaydı bulunamadı`);
      if (!variant.inventory_enabled) continue;
    }
    const key = `${productId}:${variant?.id ?? 0}`;
    const previous = desired.get(key);
    desired.set(key, { product: p, variant, quantity: amount((previous?.quantity || 0) + Number(line.qty) * Number(line.units_per_package || 1)) });
  }
  const reservationKey = (row: Row) => `${Number(row.product_id)}:${Number(row.variant_id) || 0}`;
  const byProduct = new Map(existing.map((r) => [reservationKey(r), r]));
  for (const [key, demand] of desired) {
    const reservation = byProduct.get(key);
    const current = reservation?.state === 'reserved' ? Number(reservation.quantity) || 0 : 0;
    const delta = amount(demand.quantity - current);
    const onHand = demand.variant ? demand.variant.stock_on_hand : demand.product.stock_on_hand;
    const reserved = demand.variant ? demand.variant.stock_reserved : demand.product.stock_reserved;
    if (delta > 0 && onHand - reserved < delta) {
      const label = demand.variant ? ` (${demand.variant.label})` : '';
      throw httpError(409, `Yetersiz stok: ${demand.product.name}${label}. Kullanılabilir ${amount(onHand - reserved)} ${demand.product.unit_name}, gereken ek miktar ${delta}.`);
    }
  }
  // Validate all products before mutating any row, then reconcile each order reservation.
  for (const [key, demand] of desired) {
    const { product: p, variant } = demand;
    const variantKey = variant?.variant_key || '';
    const reservation = byProduct.get(key);
    const current = reservation?.state === 'reserved' ? Number(reservation.quantity) || 0 : 0;
    const delta = amount(demand.quantity - current);
    if (delta) {
      const table = variant ? 'inventory_variants' : 'products';
      const targetId = variant ? variant.id : p.id;
      const targetReserved = variant ? variant.stock_reserved : p.stock_reserved;
      await db.store().update(table, [eq('id', targetId)], { stock_reserved: amount(targetReserved + delta), updated_at: now() });
      await addMovement(p, 'order_reservation', delta, { variant, reference: `Sipariş #${order.order_no}`, note: delta > 0 ? 'Sipariş için stok ayrıldı' : 'Sipariş satırı değişti; kullanılmayan rezervasyon bırakıldı' });
    }
    const values = { order_id: orderId, product_id: p.id, variant_id: variant?.id ?? null, variant_key: variantKey, quantity: demand.quantity, state: 'reserved', updated_at: now(), ...(db.kind() === 'local' ? { order_id_product_variant: `${orderId}:${p.id}:${variant?.id ?? 0}` } : {}) };
    if (reservation) await db.store().update('inventory_reservations', [eq('id', reservation.id)], values);
    else await db.store().insert('inventory_reservations', values);
  }
  for (const reservation of existing) {
    if (desired.has(reservationKey(reservation)) || reservation.state !== 'reserved') continue;
    const p = await products.get(reservation.product_id);
    if (!p) continue;
    const variant = reservation.variant_id ? (await db.store().select<InventoryVariant>({ table: 'inventory_variants', where: [eq('id', reservation.variant_id)], limit: 1 })).rows[0] || null : null;
    const qty = Number(reservation.quantity) || 0;
    await db.store().update(variant ? 'inventory_variants' : 'products', [eq('id', variant ? variant.id : p.id)], { stock_reserved: amount(Math.max(0, (variant ? variant.stock_reserved : p.stock_reserved) - qty)), updated_at: now() });
    await db.store().update('inventory_reservations', [eq('id', reservation.id)], { quantity: 0, state: 'released', updated_at: now() });
    await addMovement(p, 'reservation_release', -qty, { variant, reference: `Sipariş #${order.order_no}`, note: 'Sipariş satırı kaldırıldığı için rezervasyon bırakıldı' });
  }
}

export async function overview() {
  const items = await products.list();
  const allMovements = await db.selectAll<InventoryMovement>({ table: 'inventory_movements', columns: ['product_id', 'variant_id'] });
  const movedProducts = new Set(allMovements.filter((movement) => !movement.variant_id).map((movement) => movement.product_id));
  const movedVariants = new Set(allMovements.map((movement) => movement.variant_id).filter((id): id is number => id != null));
  const stockRows: StockRow[] = [];
  for (const p of items) {
    if (p.options.length) {
      const variants = (await db.store().select<InventoryVariant>({ table: 'inventory_variants', where: [eq('product_id', p.id)] })).rows;
      for (const variant of variants.filter((item) => item.active && (item.stock_on_hand > 0 || item.stock_reserved > 0 || movedVariants.has(item.id)))) stockRows.push({
        product_id: p.id, product_name: p.name, unit_name: p.unit_name, inventory_enabled: variant.inventory_enabled,
        variant_id: variant.id, variant_key: variant.variant_key, variant_label: variant.label, sku: variant.sku,
        stock_on_hand: variant.stock_on_hand, stock_reserved: variant.stock_reserved, low_stock_threshold: variant.low_stock_threshold,
      });
    } else if (p.stock_on_hand > 0 || p.stock_reserved > 0 || movedProducts.has(p.id)) stockRows.push({
      product_id: p.id, product_name: p.name, unit_name: p.unit_name, inventory_enabled: p.inventory_enabled,
      variant_id: null, variant_key: null, variant_label: null, sku: p.sku, stock_on_hand: p.stock_on_hand,
      stock_reserved: p.stock_reserved, low_stock_threshold: p.low_stock_threshold,
    });
  }
  const tracked = stockRows.filter((row) => row.inventory_enabled);
  const movements = (await db.store().select<InventoryMovement>({ table: 'inventory_movements', order: [{ col: 'id', asc: false }], limit: 100 })).rows;
  const names = new Map(items.map((p) => [p.id, p.name]));
  const variantLabels = new Map(stockRows.filter((row) => row.variant_id).map((row) => [row.variant_id!, row.variant_label]));
  return {
    products: items,
    stock_rows: stockRows,
    movements: movements.map((movement) => ({ ...movement, product_name: names.get(movement.product_id) || `Ürün #${movement.product_id}`, variant_label: movement.variant_id ? variantLabels.get(movement.variant_id) || movement.variant_label : movement.variant_label })),
    summary: {
      tracked_products: new Set(tracked.map((row) => row.product_id)).size,
      total_on_hand: round2(tracked.reduce((sum, p) => sum + p.stock_on_hand, 0)),
      total_reserved: round2(tracked.reduce((sum, p) => sum + p.stock_reserved, 0)),
      reserved_products: tracked.filter((p) => p.stock_reserved > 0).length,
      low_stock: tracked.filter((p) => p.stock_on_hand - p.stock_reserved <= p.low_stock_threshold).length,
      out_of_stock: tracked.filter((p) => p.stock_on_hand - p.stock_reserved <= 0).length,
    },
  };
}
