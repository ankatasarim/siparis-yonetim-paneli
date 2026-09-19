import { api } from '@/lib/api';
import { orders, dhl, automation } from '@/lib/services';
import { httpError } from '@/lib/utils';

export const POST = api(async (_req, { id }) => {
  const o = await orders.getRaw(id);
  if (!o) throw httpError(404, 'Sipariş bulunamadı');
  if (!o.dhl_tracking_no) throw httpError(400, 'Takip numarası yok');
  if (!dhl.canTrack()) return { tracked: false, message: 'Takip API yapılandırılmadı; teslimatı elle işaretleyin', order: await orders.get(id) };
  const result = await automation.checkOrder(id);
  return { tracked: true, result, order: await orders.get(id) };
});
