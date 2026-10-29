import assert from 'node:assert/strict';
import { filterFinanceEntries } from '../components/finance/FinanceClient';
import { calcTotals, linesSummary, normalizeLines } from '../lib/services/orders';
import { packagePrice, parseProductOptions } from '../lib/services/products';
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

console.log('finance filter tests passed');
console.log('order tax tests passed');
console.log('product package pricing tests passed');
