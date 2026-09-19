import { api, body } from '@/lib/api';
import { orders, messaging } from '@/lib/services';
import { httpError } from '@/lib/utils';

export const POST = api(async (req, { id }) => {
  const b = await body(req);
  const o = await orders.get(id);
  if (!o) throw httpError(404, 'Sipariş bulunamadı');
  const message = await messaging.sendOrderNotification(o, b.kind || 'manual', { text: b.text });
  return { message, order: await orders.get(id) };
});
