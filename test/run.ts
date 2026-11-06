import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { filterFinanceEntries } from '../components/finance/FinanceClient';
import { buildPoregoWorkbook, calculateHepsijetCodCommission, getHepsijetDesiFee, POREGO_HEADERS } from '../lib/integrations/porego/excel';
import { calcTotals, linesSummary, normalizeLines } from '../lib/services/orders';
import { packagePrice, parseProductOptions } from '../lib/services/products';
import * as productsService from '../lib/services/products';
import { fmtDay, fmtTime } from '../lib/format';
import * as db from '../lib/db';
import * as inventory from '../lib/services/inventory';
import * as customersService from '../lib/services/customers';
import * as ordersService from '../lib/services/orders';
import { formatTurkishPhone } from '../lib/phone';
import type { FinanceEntry } from '../lib/services/finance';

const entries: FinanceEntry[] = [
  { id: '1', type: 'income', category: 'Hizmet geliri', description: 'Yazılım geliri', amount: 1000, date: '2026-10-05', notes: 'Aylık destek', source: 'manual' },
  { id: '2', type: 'expense', category: 'Kargo', description: 'Kargo masrafı', amount: 200, date: '2026-10-06', notes: 'Gönderim', source: 'manual' },
  { id: '3', type: 'income', category: 'Diğer gelir', description: 'Ek gelir', amount: 150, date: '2026-10-08', notes: 'Düzeltme', source: 'order' },
];

assert.equal(filterFinanceEntries(entries, '', 'all', 'all').length, 3);
assert.equal(filterFinanceEntries(entries, '', 'income', 'all').length, 2);
assert.equal(filterFinanceEntries(entries, '', 'expense', 'Kargo').length, 1);
assert.equal(filterFinanceEntries(entries, 'yazılım', 'all', 'all').length, 1);
assert.equal(filterFinanceEntries(entries, '', 'all', 'Hizmet geliri').length, 1);

const totals = calcTotals([{ name: 'Hediye', qty: 2, price: 100, product_id: null, variant: null }], 10, 20);
assert.equal(totals.subtotal, 200);
assert.equal(totals.tax, 42);
assert.equal(totals.total, 252);
const totalsWithoutShipping = calcTotals([{ name: 'Hediye', qty: 2, price: 100, product_id: null, variant: null }], 0, 20);
assert.equal(totalsWithoutShipping.tax, 40);
assert.equal(packagePrice(2.5, 25), 62.5);
assert.equal(packagePrice(0.1, 3), 0.3);
assert.deepEqual(parseProductOptions(['Kırmızı', 'Mavi']), [{ name: 'Seçenek', values: ['Kırmızı', 'Mavi'] }]);
assert.deepEqual(parseProductOptions([{ name: 'Renk', values: ['Siyah', 'Beyaz'] }, { name: 'Beden', values: ['S', 'M'] }]), [
  { name: 'Renk', values: ['Siyah', 'Beyaz'] },
  { name: 'Beden', values: ['S', 'M'] },
]);
assert.deepEqual(parseProductOptions([{ name: 'Renk', values: ['Kırmızı', ' kırmızı '] }]), [{ name: 'Renk', values: ['Kırmızı'] }]);
const packageLine = normalizeLines([{ name: 'Fırça', qty: 4, price: 62.5, units_per_package: 25, unit_price: 2.5, package_name: 'paket', unit_name: 'adet' }])[0];
assert.equal(packageLine.qty * packageLine.units_per_package!, 100);
assert.match(linesSummary([packageLine]), /4 paket \(100 adet\)/);
assert.equal(normalizeLines([{ name: 'Fırça', qty: 1.04, price: 62.5, units_per_package: 25 }])[0].qty, 1.04);
assert.equal(fmtDay('2026-10-30T22:24:00.000Z'), '31 Eki 2026');
assert.equal(fmtTime('2026-10-30T22:24:00.000Z'), '01:24');
assert.equal(formatTurkishPhone('5321234567'), '0532 123 45 67');
assert.equal(formatTurkishPhone('+90 (532) 123-45-67'), '0532 123 45 67');
assert.equal(formatTurkishPhone('0532 123 45 67'), '0532 123 45 67');
assert.equal(formatTurkishPhone('0532'), '0532');

assert.equal(getHepsijetDesiFee(0), 119.79);
assert.equal(getHepsijetDesiFee(4), 119.79);
assert.equal(getHepsijetDesiFee(4.01), 171.38);
assert.equal(getHepsijetDesiFee(10), 171.38);
assert.equal(getHepsijetDesiFee(10.01), 238.92);
assert.equal(getHepsijetDesiFee(20), 238.92);
assert.equal(getHepsijetDesiFee(20.01), 349.47);
assert.equal(getHepsijetDesiFee(30), 349.47);
assert.equal(getHepsijetDesiFee(30.01), 405);
assert.equal(getHepsijetDesiFee(31), 405);
assert.equal(getHepsijetDesiFee(null), 119.79);

assert.equal(calculateHepsijetCodCommission(0), 20.76);
assert.equal(calculateHepsijetCodCommission(500), 20.76);
assert.equal(calculateHepsijetCodCommission(500.01), 34.39);
assert.equal(calculateHepsijetCodCommission(1000), 34.39);
assert.equal(calculateHepsijetCodCommission(1000.01), 51.58);
assert.equal(calculateHepsijetCodCommission(2000), 51.58);
assert.equal(calculateHepsijetCodCommission(2000.01), 97.03);
assert.equal(calculateHepsijetCodCommission(3000), 97.03);
assert.equal(calculateHepsijetCodCommission(3000.01), 116.68);
assert.equal(calculateHepsijetCodCommission(4000), 116.68);
assert.equal(calculateHepsijetCodCommission(4000.01), 147.38);
assert.equal(calculateHepsijetCodCommission(5000), 147.38);
assert.equal(calculateHepsijetCodCommission(5000.01), 245.64);
assert.equal(calculateHepsijetCodCommission(7000), 245.64);
assert.equal(calculateHepsijetCodCommission(7000.01), 343.90);
assert.equal(calculateHepsijetCodCommission(8000), 383.9);

function poregoCodAmount({ desi, payment_status, shipping_payer, total = 120 }: {
  desi: number | null;
  payment_status: 'bekleniyor' | 'alindi' | 'kapida_odeme';
  shipping_payer: 'gonderici' | 'alici';
  total?: number;
}): number {
  const item = {
    order: { desi, payment_status, shipping_payer, total, notes: '', labels: '' } as never,
    customer: { name: 'Ayşe Yılmaz', phone: '', email: '', address: '', city: '', district: '', postal_code: '' } as never,
  };
  const workbook = XLSX.read(buildPoregoWorkbook(item), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Sipariş İçe Aktarma'], { header: 1, raw: true }) as (string | number | null)[][];
  return Number(rows[1][POREGO_HEADERS.indexOf('Kapıda Ödeme Tutarı')]);
}

function poregoPaymentType(payment_status: 'bekleniyor' | 'alindi' | 'kapida_odeme', shipping_payer: 'gonderici' | 'alici' = 'alici'): string {
  const item = {
    order: { desi: 5, payment_status, shipping_payer, total: 120, notes: '', labels: '' } as never,
    customer: { name: 'Ayşe Yılmaz', phone: '', email: '', address: '', city: '', district: '', postal_code: '' } as never,
  };
  const workbook = XLSX.read(buildPoregoWorkbook(item), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Sipariş İçe Aktarma'], { header: 1, raw: true }) as (string | number | null)[][];
  return String(rows[1][POREGO_HEADERS.indexOf('Ödeme Tipi')]);
}

assert.equal(poregoCodAmount({ desi: 0, payment_status: 'kapida_odeme', shipping_payer: 'alici' }), 260.55);
assert.equal(poregoCodAmount({ desi: 31, payment_status: 'kapida_odeme', shipping_payer: 'alici' }), 545.76);
assert.equal(poregoCodAmount({ desi: 5, payment_status: 'bekleniyor', shipping_payer: 'alici' }), 192.14);
assert.equal(poregoCodAmount({ desi: 5, payment_status: 'alindi', shipping_payer: 'gonderici' }), 0);
assert.equal(poregoCodAmount({ desi: 5, payment_status: 'kapida_odeme', shipping_payer: 'gonderici' }), 0);
assert.equal(poregoPaymentType('kapida_odeme'), 'Kapıda Ödeme');
assert.equal(poregoPaymentType('bekleniyor'), 'Kapıda Ödeme');
assert.equal(poregoPaymentType('alindi'), 'Kapıda Ödeme');
assert.equal(poregoPaymentType('kapida_odeme', 'gonderici'), 'Peşin');

console.log('finance filter tests passed');
console.log('order tax tests passed');
console.log('product package pricing tests passed');
console.log('Porego HepsiJet tariff and COD export tests passed');

async function testCustomerDeduplication() {
  await db.ready({ memory: true });
  const existing = await customersService.create({ name: 'Ayşe Yılmaz', phone: '0500 111 22 33', email: 'ayse@example.com' });
  const match = await customersService.findMatch({ name: 'Ayşe Yılmaz', phone: '0500 111 22 33', email: 'ayse@example.com' });
  assert.ok(match, 'existing customer should be resolved by phone or name');
  assert.equal(match?.id, existing.id, 'same customer should be reused instead of creating a duplicate');
  const duplicate = await customersService.create({ name: 'Ayşe Yılmaz', phone: '0500 111 22 33' });
  assert.equal(duplicate.id, existing.id, 'duplicate customer should reuse existing record');
  const formatted = await customersService.create({ name: 'Telefon format testi', phone: '+90 532 765 43 21' });
  assert.equal(formatted.phone, '0532 765 43 21', 'customer phones should be stored in the canonical Turkish format');

  const taggedOrder = await db.store().insert<{ id: number }>('orders', {
    order_no: 999999, customer_id: formatted.id, status: 'yeni', lines_json: JSON.stringify([{ name: 'Etiket testi', qty: 1, price: 100 }]),
    labels: 'Paketleme notu', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  assert.equal((await ordersService.getRaw(taggedOrder.id))?.tag, '', 'new orders should start without an operational tag');
  await ordersService.update(taggedOrder.id, { tag: 'acil' });
  const listedTaggedOrder = (await ordersService.list()).rows.find((order) => order.id === taggedOrder.id);
  assert.equal(listedTaggedOrder?.tag, 'acil', 'operational tags should be persisted and visible in order lists');
  assert.equal(listedTaggedOrder?.labels, 'Paketleme notu', 'operational tags must not replace product/personalization notes');
  await assert.rejects(() => ordersService.update(taggedOrder.id, { tag: 'gecersiz' }), /Geçersiz sipariş etiketi/);
  await ordersService.update(taggedOrder.id, { tag: '' });
  assert.equal((await ordersService.getRaw(taggedOrder.id))?.tag, '', 'operational tags should be clearable');
}

async function testInventoryLifecycle() {
  await db.ready({ memory: true });
  const store = db.store();
  assert.equal((await inventory.overview()).stock_rows.length, 0, 'an untouched stock screen should remain empty');
  const untrackedProduct = await productsService.create({ name: 'Yeni takip kapalı ürün' });
  assert.equal(untrackedProduct.inventory_enabled, 0, 'new products should default to stock tracking off');
  const untrackedOrder = await store.insert<{ id: number }>('orders', {
    order_no: 990000, customer_id: 1, status: 'yeni', lines_json: JSON.stringify([{ name: untrackedProduct.name, product_id: untrackedProduct.id, qty: 1, units_per_package: 1 }]),
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  await inventory.syncOrder(untrackedOrder.id);
  assert.equal((await store.select({ table: 'inventory_reservations', where: [{ col: 'order_id', op: 'eq', val: untrackedOrder.id }] })).rows.length, 0, 'untracked new products should not block order submission');
  const product = await store.insert<{ id: number }>('products', {
    name: 'Stok testi', inventory_enabled: 1, stock_on_hand: 10, stock_reserved: 0,
    units_per_package: 3, unit_name: 'adet', package_name: 'paket', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  const order = await store.insert<{ id: number }>('orders', {
    order_no: 990001, customer_id: 1, status: 'yeni', lines_json: JSON.stringify([{ name: 'Stok testi', product_id: product.id, qty: 2, units_per_package: 3 }]),
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  await inventory.syncOrder(order.id);
  let stock = (await store.select<{ stock_on_hand: number; stock_reserved: number }>({ table: 'products', where: [{ col: 'id', op: 'eq', val: product.id }], limit: 1 })).rows[0];
  assert.equal(stock.stock_reserved, 6, 'package quantities should reserve base units');
  await inventory.syncOrder(order.id);
  stock = (await store.select<{ stock_on_hand: number; stock_reserved: number }>({ table: 'products', where: [{ col: 'id', op: 'eq', val: product.id }], limit: 1 })).rows[0];
  assert.equal(stock.stock_reserved, 6, 'repeating sync must not double reserve');

  await store.update('orders', [{ col: 'id', op: 'eq', val: order.id }], { lines_json: JSON.stringify([{ name: 'Stok testi', product_id: product.id, qty: 1, units_per_package: 3 }]) });
  await inventory.syncOrder(order.id);
  stock = (await store.select<{ stock_on_hand: number; stock_reserved: number }>({ table: 'products', where: [{ col: 'id', op: 'eq', val: product.id }], limit: 1 })).rows[0];
  assert.equal(stock.stock_reserved, 3, 'line edits should reconcile reservation differences');

  await store.update('orders', [{ col: 'id', op: 'eq', val: order.id }], { status: 'iptal' });
  await inventory.syncOrder(order.id);
  stock = (await store.select<{ stock_on_hand: number; stock_reserved: number }>({ table: 'products', where: [{ col: 'id', op: 'eq', val: product.id }], limit: 1 })).rows[0];
  assert.equal(stock.stock_reserved, 0, 'cancellation should release unshipped reservations');
  assert.equal(stock.stock_on_hand, 10, 'cancellation should not alter physical on-hand stock');

  await store.update('orders', [{ col: 'id', op: 'eq', val: order.id }], { status: 'yeni', lines_json: JSON.stringify([{ name: 'Stok testi', product_id: product.id, qty: 2, units_per_package: 3 }]) });
  await inventory.syncOrder(order.id);
  stock = (await store.select<{ stock_on_hand: number; stock_reserved: number }>({ table: 'products', where: [{ col: 'id', op: 'eq', val: product.id }], limit: 1 })).rows[0];
  assert.equal(stock.stock_reserved, 6, 'reactivating an order should restore its reservation');
  await store.update('orders', [{ col: 'id', op: 'eq', val: order.id }], { status: 'kargoya_verildi' });
  await inventory.syncOrder(order.id);
  await inventory.syncOrder(order.id);
  stock = (await store.select<{ stock_on_hand: number; stock_reserved: number }>({ table: 'products', where: [{ col: 'id', op: 'eq', val: product.id }], limit: 1 })).rows[0];
  assert.equal(stock.stock_reserved, 0, 'shipment should consume the reservation');
  assert.equal(stock.stock_on_hand, 4, 'shipment should deduct base units exactly once');

  const paint = await store.insert<{ id: number }>('products', {
    name: 'Akrilik boya', inventory_enabled: 1, options_json: JSON.stringify([{ name: 'Renk', values: ['Kırmızı', 'Mavi'] }]),
    stock_on_hand: 50, stock_reserved: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  await inventory.overview();
  assert.equal((await inventory.overview()).stock_rows.some((row) => row.product_id === paint.id), false, 'legacy product-level stock must not appear as a variant row');
  let variants = (await store.select<{ id: number; variant_key: string; stock_on_hand: number; stock_reserved: number; inventory_enabled: number }>({ table: 'inventory_variants', where: [{ col: 'product_id', op: 'eq', val: paint.id }] })).rows;
  assert.equal(variants.length, 0, 'opening stock overview must not create variation records');
  await inventory.recordMovement({ product_id: paint.id, variant_key: 'Renk: Kırmızı', type: 'receipt', quantity: 8 });
  variants = (await store.select<{ id: number; variant_key: string; stock_on_hand: number; stock_reserved: number; inventory_enabled: number }>({ table: 'inventory_variants', where: [{ col: 'product_id', op: 'eq', val: paint.id }] })).rows;
  assert.equal(variants.length, 1, 'receiving stock creates only the selected variation');
  const red = variants.find((variant) => variant.variant_key === 'Renk: Kırmızı')!;
  const missingColorOrder = await store.insert<{ id: number }>('orders', {
    order_no: 990004, customer_id: 1, status: 'yeni',
    lines_json: JSON.stringify([{ name: 'Akrilik boya', product_id: paint.id, variant: 'Renk: Mavi', qty: 1, units_per_package: 1 }]),
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  await assert.rejects(() => inventory.syncOrder(missingColorOrder.id), /stok kaydı bulunamadı/);
  variants = (await store.select<{ id: number; variant_key: string; stock_on_hand: number; stock_reserved: number; inventory_enabled: number }>({ table: 'inventory_variants', where: [{ col: 'product_id', op: 'eq', val: paint.id }] })).rows;
  assert.equal(variants.length, 1, 'an order must not create an unreceived variation record');
  await inventory.recordMovement({ product_id: paint.id, variant_key: 'Renk: Mavi', type: 'receipt', quantity: 3 });
  variants = (await store.select<{ id: number; variant_key: string; stock_on_hand: number; stock_reserved: number; inventory_enabled: number }>({ table: 'inventory_variants', where: [{ col: 'product_id', op: 'eq', val: paint.id }] })).rows;
  assert.equal(variants.length, 2, 'the second variation is created only when it receives stock');
  const blue = variants.find((variant) => variant.variant_key === 'Renk: Mavi')!;
  const paintOrder = await store.insert<{ id: number }>('orders', {
    order_no: 990002, customer_id: 1, status: 'yeni',
    lines_json: JSON.stringify([{ name: 'Akrilik boya', product_id: paint.id, variant: 'Renk: Kırmızı', qty: 2, units_per_package: 1 }]),
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  await inventory.syncOrder(paintOrder.id);
  let colorRows = (await store.select<{ id: number; variant_key: string; stock_on_hand: number; stock_reserved: number; inventory_enabled: number }>({ table: 'inventory_variants', where: [{ col: 'product_id', op: 'eq', val: paint.id }] })).rows;
  assert.equal(colorRows.find((variant) => variant.id === red.id)?.stock_reserved, 2, 'the selected color should reserve its own stock');
  assert.equal(colorRows.find((variant) => variant.id === blue.id)?.stock_reserved, 0, 'other colors should remain untouched');
  const insufficientBlueOrder = await store.insert<{ id: number }>('orders', {
    order_no: 990003, customer_id: 1, status: 'yeni',
    lines_json: JSON.stringify([{ name: 'Akrilik boya', product_id: paint.id, variant: 'Renk: Mavi', qty: 4, units_per_package: 1 }]),
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  await assert.rejects(() => inventory.syncOrder(insufficientBlueOrder.id), /Yetersiz stok/);
  await store.update('orders', [{ col: 'id', op: 'eq', val: paintOrder.id }], { status: 'kargoya_verildi' });
  await inventory.syncOrder(paintOrder.id);
  colorRows = (await store.select<{ id: number; variant_key: string; stock_on_hand: number; stock_reserved: number; inventory_enabled: number }>({ table: 'inventory_variants', where: [{ col: 'product_id', op: 'eq', val: paint.id }] })).rows;
  assert.equal(colorRows.find((variant) => variant.id === red.id)?.stock_on_hand, 6, 'shipping red paint should deduct only red stock');
  assert.equal(colorRows.find((variant) => variant.id === blue.id)?.stock_on_hand, 3, 'blue paint stock should not be deducted');
  await inventory.setVariantSettings(red.id, { enabled: false });
  colorRows = (await store.select<{ id: number; variant_key: string; stock_on_hand: number; stock_reserved: number; inventory_enabled: number }>({ table: 'inventory_variants', where: [{ col: 'product_id', op: 'eq', val: paint.id }] })).rows;
  assert.equal(colorRows.find((variant) => variant.id === red.id)?.inventory_enabled, 0, 'tracking can be disabled for one color');
  assert.equal(colorRows.find((variant) => variant.id === red.id)?.stock_on_hand, 6, 'disabling tracking must preserve stock');
  await inventory.setVariantSettings(red.id, { enabled: true });
  colorRows = (await store.select<{ id: number; variant_key: string; stock_on_hand: number; stock_reserved: number; inventory_enabled: number }>({ table: 'inventory_variants', where: [{ col: 'product_id', op: 'eq', val: paint.id }] })).rows;
  assert.equal(colorRows.find((variant) => variant.id === red.id)?.inventory_enabled, 1, 'tracking can be re-enabled later');
  assert.equal(colorRows.find((variant) => variant.id === red.id)?.stock_on_hand, 6, 're-enabling tracking preserves stock');
  await db.close();
}

testCustomerDeduplication().then(() => console.log('customer deduplication tests passed')).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

testInventoryLifecycle().then(() => console.log('inventory lifecycle tests passed')).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
