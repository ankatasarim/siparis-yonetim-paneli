import { api, body } from '@/lib/api';
import { orders, customers, messaging } from '@/lib/services';
import { httpError } from '@/lib/utils';

export const GET = api(async (_req, { id }) => {
  const o = await orders.get(id);
  if (!o) throw httpError(404, 'Sipariş bulunamadı');
  o.templates_preview = {
    kargo_bildirimi: await messaging.renderForOrder(o, 'kargo_bildirimi'),
    memnuniyet: await messaging.renderForOrder(o, 'memnuniyet'),
    siparis_alindi: await messaging.renderForOrder(o, 'siparis_alindi'),
  };
  return o;
});

export const PUT = api(async (req, { id }) => {
  const b = await body(req);
  const o = await orders.getRaw(id);
  if (!o) throw httpError(404, 'Sipariş bulunamadı');
  if (b.customer) await customers.update(o.customer_id, b.customer);
  return orders.update(id, b);
});

export const DELETE = api(async (_req, { id }) => {
  await orders.remove(id);
  return { ok: true };
});
