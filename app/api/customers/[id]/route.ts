import { api, body } from '@/lib/api';
import { customers, orders, db } from '@/lib/services';
import { eq } from '@/lib/store';
import { httpError } from '@/lib/utils';

export const GET = api(async (_req, { id }) => {
  const c = await customers.get(id);
  if (!c) throw httpError(404, 'Müşteri bulunamadı');
  const { count } = await db.store().select({ table: 'messages', columns: ['id'], where: [eq('customer_id', c.id)], limit: 1, count: true });
  return { ...c, orders: (await orders.list({ customer_id: c.id, pageSize: 100 })).rows, message_count: count || 0 };
});

export const PUT = api(async (req, { id }) => customers.update(id, await body(req)));

export const DELETE = api(async (_req, { id }) => {
  await customers.remove(id);
  return { ok: true };
});
