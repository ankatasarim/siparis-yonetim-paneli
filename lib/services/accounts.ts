import * as db from '../db';
import * as customers from './customers';
import { eq } from '../store';
import { httpError, now, round2, toNumber } from '../utils';
import type { Customer, Order, OrderLine } from '../types';

export interface AccountTransaction {
  id: number;
  customer_id: number;
  order_id: number | null;
  type: 'charge' | 'payment';
  description: string;
  amount: number;
  date: string;
  notes: string;
  created_at: string;
}

export interface CustomerAccount extends Customer {
  balance: number;
  charges: number;
  payments: number;
}

const validId = (id: number | string) => Number.isInteger(Number(id)) && Number(id) > 0;

function validDate(value: unknown): string {
  const date = String(value || '').trim();
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw httpError(400, 'Geçerli bir tarih girin');
  }
  return date;
}

export async function list(customerId?: number | string | null) {
  if (customerId != null && customerId !== '') {
    const customer = await customers.get(customerId);
    if (!customer) throw httpError(404, 'Müşteri bulunamadı');
    const transactions = await db.selectAll<AccountTransaction>({
      table: 'account_transactions', where: [eq('customer_id', customer.id)], order: [{ col: 'date', asc: false }, { col: 'id', asc: false }],
    });
    const charges = round2(transactions.filter((entry) => entry.type === 'charge').reduce((sum, entry) => sum + Number(entry.amount), 0));
    const payments = round2(transactions.filter((entry) => entry.type === 'payment').reduce((sum, entry) => sum + Number(entry.amount), 0));
    return { customer: { ...customer, charges, payments, balance: round2(charges - payments) }, transactions };
  }

  const [customerRows, transactions] = await Promise.all([
    customers.list({ limit: 1000 }),
    db.selectAll<AccountTransaction>({ table: 'account_transactions', order: [{ col: 'date', asc: false }] }),
  ]);
  const totals = new Map<number, { charges: number; payments: number }>();
  for (const entry of transactions) {
    let sum = totals.get(entry.customer_id);
    if (!sum) { sum = { charges: 0, payments: 0 }; totals.set(entry.customer_id, sum); }
    if (entry.type === 'charge') sum.charges += Number(entry.amount) || 0;
    else sum.payments += Number(entry.amount) || 0;
  }
  const accounts: CustomerAccount[] = customerRows.map((customer) => {
    const sum = totals.get(customer.id) || { charges: 0, payments: 0 };
    const charges = round2(sum.charges);
    const payments = round2(sum.payments);
    return { ...customer, charges, payments, balance: round2(charges - payments) };
  }).sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name, 'tr'));
  return { accounts, total_receivable: round2(accounts.reduce((sum, account) => sum + Math.max(0, account.balance), 0)) };
}

export async function create(input: unknown) {
  const data = input as Record<string, unknown> | null;
  const customerId = Number(data?.customer_id);
  if (!data || !validId(customerId)) throw httpError(400, 'Müşteri seçin');
  const customer = await customers.get(customerId);
  if (!customer) throw httpError(404, 'Müşteri bulunamadı');
  if (data.type !== 'charge' && data.type !== 'payment') throw httpError(400, 'Borç veya tahsilat türü seçin');
  const amount = toNumber(data.amount);
  if (amount == null || Number.isNaN(amount) || amount <= 0) throw httpError(400, 'Tutar sıfırdan büyük olmalıdır');
  const description = String(data.description || '').trim().slice(0, 160);
  if (!description) throw httpError(400, 'Açıklama zorunludur');
  const date = validDate(data.date);
  const notes = String(data.notes || '').trim().slice(0, 500);
  return db.store().insert<AccountTransaction>('account_transactions', {
    customer_id: customer.id, order_id: null, type: data.type, amount: round2(amount), description, date, notes, created_at: now(),
  });
}

/** Sipariş vadeli açıldığında müşteri ekstresine sipariş borcunu ekler veya sipariş düzenlenince günceller. */
export async function syncOrderCharge(order: Pick<Order, 'id' | 'order_no' | 'customer_id' | 'total' | 'created_at' | 'lines'>) {
  const existing = (await db.store().select<AccountTransaction>({
    table: 'account_transactions', where: [eq('order_id', order.id), eq('type', 'charge')], limit: 1,
  })).rows[0];
  const description = `Sipariş #${order.order_no} · ${order.lines.map((line: OrderLine) => `${line.qty}× ${line.name}`).join(', ')}`.slice(0, 160);
  const patch = {
    customer_id: order.customer_id, order_id: order.id, type: 'charge' as const,
    amount: round2(Number(order.total) || 0), description,
    date: String(order.created_at).slice(0, 10), notes: 'Vadeli sipariş borcu',
  };
  if (existing) {
    await db.store().update('account_transactions', [eq('id', existing.id)], patch);
    return { ...existing, ...patch };
  }
  return db.store().insert<AccountTransaction>('account_transactions', { ...patch, created_at: now() });
}
