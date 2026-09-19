import { api, body } from '@/lib/api';
import { orders, customers, dhl } from '@/lib/services';
import { httpError, pick } from '@/lib/utils';

/** Kargo kaydı: takip no verilirse kaydeder; verilmezse DHL API ile gönderi oluşturur. */
export const POST = api(async (req, { id }) => {
  const b = await body(req);
  const existing = await orders.getRaw(id);
  if (!existing) throw httpError(404, 'Sipariş bulunamadı');
  const shipFields = pick(b, ['desi', 'package_count', 'shipping_payer', 'shipping_fee']);
  if (Object.keys(shipFields).length) await orders.update(id, shipFields);
  if (b.customer) await customers.update(existing.customer_id, b.customer);

  let trackingNo = String(b.tracking_no || '').trim();
  let shipmentRef: string | null = b.shipment_ref || null;
  if (!trackingNo) {
    if (!dhl.canCreate()) throw httpError(400, 'Takip numarası girin (DHL Online Şube) veya DHL API modunu etkinleştirin');
    const order = (await orders.getRaw(id))!;
    const customer = (await customers.get(order.customer_id))!;
    const created = await dhl.createShipment(order, customer);
    trackingNo = created.trackingNo;
    shipmentRef = created.shipmentRef;
    await orders.addEvent(id, 'kargo', 'DHL API ile gönderi oluşturuldu', { raw: created.raw });
  }
  return orders.recordShipment(id, { tracking_no: trackingNo, shipment_ref: shipmentRef });
});
