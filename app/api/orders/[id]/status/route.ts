import { api, body } from '@/lib/api';
import { orders } from '@/lib/services';

export const POST = api(async (req, { id }) => {
  const b = await body(req);
  return orders.setStatus(id, b.status, { note: b.note, force: Boolean(b.force) });
});
