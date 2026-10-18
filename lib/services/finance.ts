import * as db from '../db';
import { eq, gte, isIn, lt, neq } from '../store';
import { httpError, now, round2, toNumber } from '../utils';

export interface FinanceEntry {
  id: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  date: string;
  notes: string;
  source: 'manual' | 'order';
  order_no?: number;
}

const validMonth = (value: string | null) => value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : new Date().toISOString().slice(0, 7);

function monthBounds(month: string) {
  const [year, m] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, m, 1)).toISOString().slice(0, 10);
  return { start: `${month}-01`, end: next };
}

export async function list(monthInput: string | null) {
  const month = validMonth(monthInput);
  const { start, end } = monthBounds(month);
  const [transactions, orders, accountPayments] = await Promise.all([
    db.store().select({ table: 'finance_transactions', where: [gte('date', start), lt('date', end)], order: [{ col: 'date', asc: false }, { col: 'id', asc: false }], limit: 2000 }),
    db.store().select<{ id: number; order_no: number; total: number; created_at: string }>({
      table: 'orders', columns: ['id', 'order_no', 'total', 'created_at'],
      where: [eq('payment_status', 'alindi'), neq('status', 'iptal'), gte('created_at', `${start}T00:00:00.000Z`), lt('created_at', `${end}T00:00:00.000Z`)],
      order: [{ col: 'created_at', asc: false }], limit: 2000,
    }),
    db.store().select<{ id: number; customer_id: number; description: string; amount: number; date: string }>({
      table: 'account_transactions', columns: ['id', 'customer_id', 'description', 'amount', 'date'],
      where: [eq('type', 'payment'), gte('date', start), lt('date', end)], order: [{ col: 'date', asc: false }], limit: 2000,
    }),
  ]);

  const manual: FinanceEntry[] = transactions.rows.map((row) => ({
    id: `manual-${row.id}`, type: row.type, category: row.category, description: row.description,
    amount: Number(row.amount), date: row.date, notes: row.notes || '', source: 'manual',
  }));
  const sales: FinanceEntry[] = orders.rows.map((order) => ({
    id: `order-${order.id}`, type: 'income', category: 'Sipariş satışı', description: `Sipariş #${order.order_no}`,
    amount: Number(order.total) || 0, date: String(order.created_at).slice(0, 10), notes: 'Ödemesi alınan sipariş', source: 'order', order_no: order.order_no,
  }));
  const customerIds = [...new Set(accountPayments.rows.map((entry) => entry.customer_id))];
  const customers = customerIds.length ? await db.store().select<{ id: number; name: string }>({ table: 'customers', columns: ['id', 'name'], where: [isIn('id', customerIds)], limit: customerIds.length }) : { rows: [] };
  const customerNames = new Map(customers.rows.map((customer) => [customer.id, customer.name]));
  const receipts: FinanceEntry[] = accountPayments.rows.map((payment) => ({
    id: `account-payment-${payment.id}`, type: 'income', category: 'Cari tahsilat',
    description: `${customerNames.get(payment.customer_id) || 'Müşteri'} · ${payment.description}`,
    amount: Number(payment.amount) || 0, date: payment.date, notes: 'Cari hesaptan tahsilat', source: 'order',
  }));
  const entries = [...manual, ...sales, ...receipts].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const income = round2(entries.filter((entry) => entry.type === 'income').reduce((sum, entry) => sum + entry.amount, 0));
  const expense = round2(entries.filter((entry) => entry.type === 'expense').reduce((sum, entry) => sum + entry.amount, 0));
  return { month, entries, income, expense, net: round2(income - expense) };
}

export async function create(input: unknown) {
  const data = input as Record<string, unknown> | null;
  if (!data || !['income', 'expense'].includes(String(data.type))) throw httpError(400, 'Gelir veya gider türü seçin');
  const amount = toNumber(data.amount);
  if (amount == null || Number.isNaN(amount) || amount <= 0) throw httpError(400, 'Tutar sıfırdan büyük olmalıdır');
  const date = String(data.date || '').trim();
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) throw httpError(400, 'Geçerli bir tarih girin');
  const category = String(data.category || '').trim().slice(0, 60);
  const description = String(data.description || '').trim().slice(0, 160);
  if (!category || !description) throw httpError(400, 'Kategori ve açıklama zorunludur');
  const notes = String(data.notes || '').trim().slice(0, 500);
  return db.store().insert('finance_transactions', {
    type: data.type, category, description, amount: round2(amount), date, notes, created_at: now(),
  });
}

export async function remove(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Geçersiz kayıt');
  const count = await db.store().remove('finance_transactions', [eq('id', id)]);
  if (!count) throw httpError(404, 'Kayıt bulunamadı');
  return { ok: true };
}
