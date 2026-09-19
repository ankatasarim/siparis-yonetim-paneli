import { api, body } from '@/lib/api';
import { orders } from '@/lib/services';

export const POST = api(async (req, { id }) => {
  const b = await body(req);
  return orders.setPayment(id, b.payment_status, b.payment_method);
});
