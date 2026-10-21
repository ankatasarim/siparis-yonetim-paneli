import assert from 'node:assert/strict';
import { filterFinanceEntries } from '../components/finance/FinanceClient';
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

console.log('finance filter tests passed');
