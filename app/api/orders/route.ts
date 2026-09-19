import { api, body, status } from '@/lib/api';
import { orders, customers } from '@/lib/services';
import type { OrderStatus } from '@/lib/types';
import { STATUSES } from '@/lib/constants';

export const GET = api((req) => {
  const sp = req.nextUrl.searchParams;
  const st = sp.get('durum') || sp.get('status');
  const statuses = st ? (st.split(',').filter((s) => STATUSES[s as OrderStatus]) as OrderStatus[]) : null;
  return orders.list({ statuses, q: sp.get('q'), customer_id: sp.get('customer_id'), payment_status: sp.get('odeme'), page: Number(sp.get('sayfa') || sp.get('page') || 1), pageSize: Number(sp.get('adet') || sp.get('pageSize') || 20) });
});

export const POST = api(async (req) => {
  const b = await body(req);
  let customerId = b.customer_id ? parseInt(String(b.customer_id), 10) : null;
  if (customerId && b.customer) await customers.update(customerId, b.customer);
  if (!customerId && b.customer) customerId = (await customers.create(b.customer)).id;
  const order = await orders.create({ ...b, customer_id: customerId });
  return status(order, 201);
});
