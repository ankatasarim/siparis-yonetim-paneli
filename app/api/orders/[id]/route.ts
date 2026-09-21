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
  // customer_id: verilmezse mevcut müşteri; sayı ise o müşteriye bağlanır; null ise `customer` alanlarıyla yeni müşteri açılır.
  let customerId = o.customer_id;
  if ('customer_id' in b && (b.customer_id === null || b.customer_id === '')) {
    if (!b.customer) throw httpError(400, 'Müşteri bilgisi gerekli');
    customerId = (await customers.create(b.customer)).id;
  } else {
    if (b.customer_id) customerId = parseInt(String(b.customer_id), 10);
    if (b.customer) await customers.update(customerId, b.customer);
    else if (customerId !== o.customer_id && !(await customers.get(customerId))) throw httpError(404, 'Müşteri bulunamadı');
  }
  return orders.update(id, { ...b, customer_id: customerId });
});

export const DELETE = api(async (_req, { id }) => {
  await orders.remove(id);
  return { ok: true };
});
