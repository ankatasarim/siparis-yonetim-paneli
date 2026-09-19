import { api, body } from '@/lib/api';
import { orders } from '@/lib/services';

export const POST = api(async (req, { id }) => {
  const b = await body(req);
  return orders.setSatisfaction(id, b.verdict, b.note, { by: 'panel', autoClose: b.auto_close !== false });
});
