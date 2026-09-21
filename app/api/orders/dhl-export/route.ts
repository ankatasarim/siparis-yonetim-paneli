import { NextResponse } from 'next/server';
import { api } from '@/lib/api';
import { orders, db } from '@/lib/services';
import { buildWorkbook, checkItem, FORMATS, type FileFormat } from '@/lib/integrations/dhl/excel';
import { STATUSES } from '@/lib/constants';
import { now } from '@/lib/utils';
import type { OrderStatus } from '@/lib/types';

/**
 * DHL toplu gönderi Excel'i.
 *  ?durum=yeni,hazirlaniyor  hangi durumlar (varsayılan: yeni + hazırlanıyor)
 *  ?atla=1                   takip numarası girilmiş siparişleri dışarıda bırak (varsayılan: 1)
 *  ?onizle=1                 dosya yerine özet JSON döndür (sayı + eksik bilgili siparişler)
 *  ?bicim=xls|xlsx           dosya biçimi (varsayılan xls, DHL şablonu gibi)
 * İndirmede eksik zorunlu alanı olan siparişler dosyaya yazılmaz (DHL zaten yok sayardı); diğerlerine olay notu düşülür.
 */
export const GET = api(async (req) => {
  const sp = req.nextUrl.searchParams;
  const statuses = (sp.get('durum') || 'yeni,hazirlaniyor').split(',').map((s) => s.trim()).filter((s) => STATUSES[s as OrderStatus]) as OrderStatus[];
  const skipTracked = sp.get('atla') !== '0';
  const format: FileFormat = sp.get('bicim') === 'xlsx' ? 'xlsx' : 'xls';
  const items = await orders.listForDhlExport({ statuses: statuses.length ? statuses : ['yeni', 'hazirlaniyor'], skipTracked });
  const problems = items.map(checkItem).filter((p): p is NonNullable<typeof p> => p !== null);
  const blocked = new Set(problems.filter((p) => p.missing.length).map((p) => p.id));
  const ready = items.filter((x) => !blocked.has(x.order.id));

  if (sp.get('onizle') === '1') {
    return { total: items.length, ready: ready.length, problems };
  }
  if (!ready.length) return NextResponse.json({ error: 'Aktarılacak sipariş yok' }, { status: 400 });

  const buf = buildWorkbook(ready, format);
  const t = now();
  await db.store().insertMany('order_events', ready.map(({ order }) => ({
    order_id: order.id, type: 'kargo', description: 'DHL toplu gönderi dosyasına eklendi', meta: JSON.stringify({ exported_at: t }), created_at: t,
  })));
  const day = t.slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': FORMATS[format].mime,
      'Content-Disposition': `attachment; filename="dhl-toplu-gonderi-${day}.${format}"`,
      'Cache-Control': 'no-store',
    },
  });
});
