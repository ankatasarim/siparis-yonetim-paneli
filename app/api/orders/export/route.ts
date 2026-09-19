import { api } from '@/lib/api';
import { orders } from '@/lib/services';
import { STATUSES, PAYMENT_STATUSES, SHIPPING_PAYERS } from '@/lib/constants';
import type { OrderRow } from '@/lib/types';

const esc = (v: unknown) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export const GET = api(async () => {
  const all: OrderRow[] = [];
  for (let page = 1; page < 500; page++) {
    const r = (await orders.list({ pageSize: 200, page })).rows;
    if (!r.length) break;
    all.push(...r);
  }
  const head = ['Sipariş No', 'Tarih', 'Müşteri', 'Telefon', 'Instagram', 'İl', 'İlçe', 'Ürünler', 'Etiket Notu', 'Durum', 'Ödeme Durumu', 'Ödeme Yöntemi', 'Ara Toplam', 'Kargo Ücreti', 'Toplam', 'Kargo Ödeyen', 'Desi', 'Parça', 'DHL Takip No', 'Memnuniyet'];
  const lines = all.map((o) => [
    o.order_no, o.created_at, o.customer_name, o.customer_phone, o.customer_ig || '', o.customer_city, o.customer_district, o.items, o.labels,
    STATUSES[o.status].label, PAYMENT_STATUSES[o.payment_status].label, o.payment_method, o.subtotal, o.shipping_fee, o.total,
    SHIPPING_PAYERS[o.shipping_payer], o.desi ?? '', o.package_count, o.dhl_tracking_no || '', o.satisfaction || '',
  ].map(esc).join(';'));
  const csv = '﻿' + [head.join(';'), ...lines].join('\n');
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="siparisler-${new Date().toISOString().slice(0, 10)}.csv"` } });
});
