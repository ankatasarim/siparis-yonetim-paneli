import { NextResponse } from 'next/server';
import { api, body } from '@/lib/api';
import { db, orders } from '@/lib/services';
import { buildPoregoWorkbook } from '@/lib/integrations/porego/excel';
import { httpError, now } from '@/lib/utils';

async function exportItems(items: Awaited<ReturnType<typeof orders.listForPoregoExport>>, filename: string) {
  if (!items.length) return NextResponse.json({ error: 'Excel’e aktarılacak sipariş bulunamadı' }, { status: 400 });
  const buffer = buildPoregoWorkbook(items);
  const exportedAt = now();
  await db.store().insertMany('order_events', items.map(({ order }) => ({
    order_id: order.id,
    type: 'kargo',
    description: 'Porego sipariş aktarım Excel dosyasına eklendi',
    meta: JSON.stringify({ exported_at: exportedAt }),
    created_at: exportedAt,
  })));

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}-${exportedAt.slice(0, 10)}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}

/** Porego şablonuna tüm hazırlandı siparişlerini aktarır. */
export const GET = api(async () => exportItems(await orders.listForPoregoExport(), 'porego-siparis-aktarim'));

/** Seçili siparişleri Porego Excel şablonuna aktarır. */
export const POST = api(async (req) => {
  const payload = await body<{ ids?: unknown }>(req);
  if (!Array.isArray(payload.ids) || payload.ids.length === 0 || payload.ids.length > 200) {
    throw httpError(400, '1 ile 200 arasında sipariş seçin');
  }
  const ids = [...new Set(payload.ids.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) throw httpError(400, 'Sipariş seçimi geçersiz');
  return exportItems(await orders.listForPoregoExport(ids), 'porego-secili-siparisler');
});