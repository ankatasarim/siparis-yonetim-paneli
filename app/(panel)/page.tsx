import Link from 'next/link';
import { ArrowRight, MessageCircle, Package, Truck, AlertTriangle, Banknote } from 'lucide-react';
import { ready, orders } from '@/lib/services';
import { cfg } from '@/lib/config';
import { PageHeader } from '@/components/PageHeader';
import { Card, Stat, Alert, Empty } from '@/components/ui';
import { PaymentPill } from '@/components/Pills';
import { money, fmtShort, fmtDate, trunc } from '@/lib/format';
import type { OrderRow } from '@/lib/types';

function OrderList({ items, empty }: { items: OrderRow[]; empty: string }) {
  if (!items.length) return <p className="px-5 py-6 text-center text-sm text-neutral-500">{empty}</p>;
  return (
    <ul className="divide-y divide-neutral-100">
      {items.map((o) => (
        <li key={o.id}>
          <Link href={`/siparisler/${o.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-50">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm"><span className="font-semibold">#{o.order_no}</span> · {o.customer_name || (o.customer_ig ? '@' + o.customer_ig : 'İsimsiz')}</p>
              <p className="truncate text-xs text-neutral-500">{trunc(o.items, 70)}{o.dhl_tracking_no ? ` · 📦 ${o.dhl_tracking_no}` : ''}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{money(o.total)}</p>
              <p className="text-xs text-neutral-500">{fmtShort(o.created_at)}</p>
            </div>
            <PaymentPill status={o.payment_status} className="hidden 2xl:inline-flex" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function HomePage() {
  await ready();
  const d = await orders.dashboard();
  const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const a = d.attention;
  const hasAttention = a.unread || a.no_tracking || a.pending_messages || a.unhappy || a.unpaid;

  return (
    <>
      <PageHeader title="Giriş" subtitle={`${today} · Bugün ${d.today_count} yeni sipariş`} actions={<Link href="/siparisler/yeni" className="btn btn-primary">Sipariş Oluştur</Link>} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Yeni sipariş" value={d.counts.yeni} href="/siparisler?durum=yeni" accent="bg-blue-500" />
        <Stat label="Hazırlanıyor" value={d.counts.hazirlaniyor} href="/siparisler?durum=hazirlaniyor" accent="bg-amber-500" />
        <Stat label="Kargoda" value={d.counts.kargoya_verildi} href="/siparisler?durum=kargoya_verildi" accent="bg-violet-500" />
        <Stat label="Teslim edildi" value={d.counts.teslim_edildi} href="/siparisler?durum=teslim_edildi" accent="bg-emerald-500" />
        <Stat label="Bu ay ciro" value={money(d.month_revenue)} sub={`${d.month_count} sipariş`} href="/siparisler" accent="bg-primary" />
      </div>

      {hasAttention ? (
        <div className="mb-5">
          <Alert kind="warn">
            <AlertTriangle className="h-4 w-4" />
            {a.unread > 0 && <Link href="/mesajlar" className="hover:underline">💬 {a.unread} okunmamış mesaj</Link>}
            {a.no_tracking > 0 && <Link href="/siparisler?durum=hazirlaniyor" className="hover:underline">📦 {a.no_tracking} sipariş kargo bekliyor</Link>}
            {a.unpaid > 0 && <Link href="/siparisler?odeme=bekleniyor" className="hover:underline">💸 {a.unpaid} sipariş ödeme bekliyor</Link>}
            {a.pending_messages > 0 && <Link href="/ayarlar#giden" className="hover:underline">✉️ {a.pending_messages} bildirim elle gönderilmeli</Link>}
            {a.unhappy > 0 && <Link href="/siparisler?durum=teslim_edildi" className="hover:underline">⚠️ {a.unhappy} müşteri cevabı değerlendirilmeli</Link>}
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-3">
        <Card pad={false} title={<><Package className="h-4 w-4 text-blue-500" />Yeni siparişler</>} actions={<Link href="/siparisler?durum=yeni" className="text-xs text-primary-text hover:underline">Tümü <ArrowRight className="inline h-3 w-3" /></Link>}>
          <OrderList items={d.new_orders} empty="Bekleyen yeni sipariş yok." />
        </Card>
        <Card pad={false} title={<><Banknote className="h-4 w-4 text-amber-500" />Kargo bekleyenler</>} actions={<Link href="/siparisler?durum=hazirlaniyor" className="text-xs text-primary-text hover:underline">Tümü <ArrowRight className="inline h-3 w-3" /></Link>}>
          <OrderList items={d.awaiting_shipment} empty="Hazırlanan sipariş yok." />
        </Card>
        <Card pad={false} title={<><Truck className="h-4 w-4 text-violet-500" />Kargodakiler</>} actions={<Link href="/siparisler?durum=kargoya_verildi" className="text-xs text-primary-text hover:underline">Tümü <ArrowRight className="inline h-3 w-3" /></Link>}>
          <OrderList items={d.in_transit} empty="Kargoda sipariş yok." />
        </Card>
      </div>

      <div className="mt-5">
        <Card pad={false} title={<><MessageCircle className="h-4 w-4 text-neutral-500" />Son hareketler</>}>
          {d.recent_events.length ? (
            <ul className="divide-y divide-neutral-100">
              {d.recent_events.map((e) => (
                <li key={e.id} className="flex gap-4 px-5 py-2.5 text-sm">
                  <span className="w-32 shrink-0 text-xs text-neutral-500">{fmtDate(e.created_at)}</span>
                  <span className="min-w-0"><Link href={`/siparisler/${e.order_id}`} className="font-semibold text-primary-text hover:underline">#{e.order_no}</Link> · {e.description}</span>
                </li>
              ))}
            </ul>
          ) : <Empty icon="🪶" title="Henüz hareket yok" text={`${cfg.business.name} paneline hoş geldiniz. İlk siparişi "Sipariş Oluştur" ile ekleyin ya da Gelen Kutusu'ndan bir mesajı siparişe dönüştürün.`} action={<Link href="/siparisler/yeni" className="btn btn-primary">Sipariş Oluştur</Link>} />}
        </Card>
      </div>
    </>
  );
}
