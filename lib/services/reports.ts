import * as db from '../db';
import { gte, lte, lt } from '../store';
import { round2 } from '../utils';

type ReportOrder = {
  id: number; order_no: number; status: string; payment_status: string; payment_method: string;
  subtotal: number; total: number; shipping_fee: number; lines_json: string | null; created_at: string;
};
type FinanceRow = { id: number; type: 'income' | 'expense'; category: string; description: string; amount: number; date: string };
type AccountRow = { id: number; customer_id: number; type: 'charge' | 'payment'; description: string; amount: number; date: string };

const validDate = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;
const nextDate = (value: string) => new Date(Date.parse(`${value}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

export async function get(fromInput: string | null, toInput: string | null) {
  const from = validDate(fromInput) ? fromInput : monthStart();
  const to = validDate(toInput) ? toInput : today();
  if (from > to) throw Object.assign(new Error('Başlangıç tarihi bitiş tarihinden sonra olamaz'), { status: 400 });
  const spanDays = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  if (spanDays > 365) throw Object.assign(new Error('Rapor aralığı en fazla 366 gün olabilir'), { status: 400 });

  const until = nextDate(to);
  const [orders, finance, accountPeriod, allAccount] = await Promise.all([
    db.selectAll<ReportOrder>({
      table: 'orders', columns: ['id', 'order_no', 'status', 'payment_status', 'payment_method', 'subtotal', 'total', 'shipping_fee', 'lines_json', 'created_at'],
      where: [gte('created_at', `${from}T00:00:00.000Z`), lt('created_at', `${until}T00:00:00.000Z`)], order: [{ col: 'created_at', asc: true }],
    }),
    db.selectAll<FinanceRow>({ table: 'finance_transactions', where: [gte('date', from), lte('date', to)], order: [{ col: 'date', asc: false }] }),
    db.selectAll<AccountRow>({ table: 'account_transactions', where: [gte('date', from), lte('date', to)], order: [{ col: 'date', asc: false }] }),
    db.selectAll<AccountRow>({ table: 'account_transactions' }),
  ]);

  const activeOrders = orders.filter((order) => order.status !== 'iptal');
  const cancelled = orders.filter((order) => order.status === 'iptal');
  const amount = (n: unknown) => Number(n) || 0;
  const salesSubtotal = round2(activeOrders.reduce((sum, order) => sum + amount(order.subtotal), 0));
  const salesTotal = round2(activeOrders.reduce((sum, order) => sum + amount(order.total), 0));
  const shippingTotal = round2(activeOrders.reduce((sum, order) => sum + amount(order.shipping_fee), 0));
  const paidOrders = activeOrders.filter((order) => order.payment_status === 'alindi');
  const unpaidOrders = activeOrders.filter((order) => order.payment_status !== 'alindi');
  const orderCollections = round2(paidOrders.reduce((sum, order) => sum + amount(order.total), 0));
  const accountCollections = round2(accountPeriod.filter((row) => row.type === 'payment').reduce((sum, row) => sum + amount(row.amount), 0));
  const manualIncome = round2(finance.filter((row) => row.type === 'income').reduce((sum, row) => sum + amount(row.amount), 0));
  const expenses = round2(finance.filter((row) => row.type === 'expense').reduce((sum, row) => sum + amount(row.amount), 0));
  const recordedIncome = round2(orderCollections + accountCollections + manualIncome);

  const days = new Map<string, { date: string; sales: number; collections: number; expenses: number }>();
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += 86400000) {
    const date = new Date(time).toISOString().slice(0, 10);
    days.set(date, { date, sales: 0, collections: 0, expenses: 0 });
  }
  for (const order of activeOrders) {
    const row = days.get(String(order.created_at).slice(0, 10));
    if (row) {
      row.sales += amount(order.total);
      if (order.payment_status === 'alindi') row.collections += amount(order.total);
    }
  }
  for (const row of accountPeriod) {
    const day = days.get(row.date);
    if (day && row.type === 'payment') day.collections += amount(row.amount);
  }
  for (const row of finance) {
    const day = days.get(row.date);
    if (day && row.type === 'income') day.collections += amount(row.amount);
    if (day && row.type === 'expense') day.expenses += amount(row.amount);
  }

  const categoryTotals = new Map<string, number>();
  for (const row of finance.filter((item) => item.type === 'expense')) categoryTotals.set(row.category, (categoryTotals.get(row.category) || 0) + amount(row.amount));
  const products = new Map<string, { name: string; quantity: number; amount: number }>();
  for (const order of activeOrders) {
    try {
      const lines = JSON.parse(order.lines_json || '[]') as Array<{ name?: string; qty?: number; price?: number | null }>;
      for (const line of lines) {
        const name = String(line.name || 'Ürün');
        const item = products.get(name) || { name, quantity: 0, amount: 0 };
        item.quantity += amount(line.qty);
        item.amount += amount(line.qty) * amount(line.price);
        products.set(name, item);
      }
    } catch { /* bozuk eski satır raporu engellemesin */ }
  }
  let receivableCharges = 0;
  let receivablePayments = 0;
  for (const row of allAccount) {
    if (row.type === 'charge') receivableCharges += amount(row.amount);
    else receivablePayments += amount(row.amount);
  }
  const methods = new Map<string, number>();
  for (const order of activeOrders) {
    const method = order.payment_method || 'Belirtilmemiş';
    methods.set(method, (methods.get(method) || 0) + 1);
  }

  return {
    from, to,
    orders: { count: activeOrders.length, cancelled: cancelled.length, avg: activeOrders.length ? round2(salesTotal / activeOrders.length) : 0, unpaidCount: unpaidOrders.length, unpaidAmount: round2(unpaidOrders.reduce((sum, order) => sum + amount(order.total), 0)) },
    sales: { net: salesSubtotal, revenue: salesTotal, shipping: shippingTotal },
    cash: { orderCollections, accountCollections, manualIncome, income: recordedIncome, expenses, result: round2(recordedIncome - expenses) },
    receivable: round2(Math.max(0, receivableCharges - receivablePayments)),
    daily: [...days.values()].map((row) => ({ ...row, sales: round2(row.sales), collections: round2(row.collections), expenses: round2(row.expenses) })),
    expenseCategories: [...categoryTotals].map(([category, total]) => ({ category, amount: round2(total) })).sort((a, b) => b.amount - a.amount),
    topProducts: [...products.values()].map((item) => ({ ...item, amount: round2(item.amount) })).sort((a, b) => b.quantity - a.quantity).slice(0, 6),
    paymentMethods: [...methods].map(([method, count]) => ({ method, count })).sort((a, b) => b.count - a.count),
  };
}