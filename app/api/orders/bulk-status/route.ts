import { api, body } from '@/lib/api';
import { orders } from '@/lib/services';

export const POST = api(async (req) => {
  const b = await body(req);
  const ids = Array.isArray(b.ids) ? b.ids : [];
  if (!ids.length) throw new Error('En az bir sipariş seçilmelidir');
  const status = b.status;
  if (!status) throw new Error('Durum seçilmelidir');
  return orders.setStatuses(ids, status, { note: b.note, force: true, by: 'panel' });
});
