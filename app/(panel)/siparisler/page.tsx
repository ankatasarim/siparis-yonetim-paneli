import Link from 'next/link';
import { Upload, Instagram, Package, ChevronRight } from 'lucide-react';
import { ready, orders } from '@/lib/services';
import { PageHeader } from '@/components/PageHeader';
import { OrdersToolbar } from '@/components/orders/OrdersToolbar';
import { Pagination } from '@/components/Pagination';
import { RowLink } from '@/components/RowLink';
import { PaymentPill } from '@/components/Pills';
import { StatusMenu } from '@/components/orders/StatusMenu';
import { Empty } from '@/components/ui';
import { SATISFACTION_LABELS } from '@/lib/constants';
import { money, fmtDay, fmtTime, fmtShort, trunc } from '@/lib/format';

type SP = Record<string, string | undefined>;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  await ready();
  const durum = sp.durum || '';
  const q = sp.q || '';
  const odeme = sp.odeme || '';
  const { rows, total, page, pageSize } = await orders.list({ status: durum, q, payment_status: odeme, page: Number(sp.sayfa) || 1, pageSize: 20 });
  const custName = (o: (typeof rows)[number]) => o.customer_name || (o.customer_ig ? '@' + o.customer_ig : 'İsimsiz müşteri');
  const empty = (
    <Empty icon={<Package className="mx-auto h-8 w-8 text-neutral-300" />} title="Sipariş bulunamadı" text={q || durum || odeme ? 'Filtreleri değiştirip tekrar deneyin.' : 'İlk siparişinizi oluşturun.'} action={!q && !durum && !odeme ? <Link href="/siparisler/yeni" className="btn btn-primary">Sipariş Oluştur</Link> : undefined} />
  );

  return (
    <>
      <PageHeader
        title="Siparişler"
        info="Satıra tıklayarak detaya gidin; durum rozetine tıklayarak durumu listeden değiştirin."
        actions={<>
          <a href="/api/orders/export" className="btn"><Upload className="h-4 w-4" /><span className="hidden sm:inline">Dışa Aktar</span><span className="sm:hidden">CSV</span></a>
          <Link href="/siparisler/yeni" className="btn btn-primary">Sipariş Oluştur</Link>
        </>}
      />
      <OrdersToolbar />

      {/* Mobil: kart listesi */}
      <div className="space-y-3 md:hidden">
        {rows.map((o) => (
          <div key={o.id} className="card px-4 py-3">
            <Link href={`/siparisler/${o.id}`} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm"><span className="font-semibold">#{o.order_no}</span> <span className="text-neutral-500">· {fmtShort(o.created_at)}</span></p>
                <p className="truncate font-medium">{custName(o)}</p>
                <p className="truncate text-xs text-neutral-500">{o.items || '—'}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1"><span className="font-semibold">{money(o.total)}</span><ChevronRight className="h-4 w-4 text-neutral-400" /></div>
            </Link>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <StatusMenu id={o.id} orderNo={o.order_no} status={o.status} hasTracking={Boolean(o.dhl_tracking_no)} />
              <PaymentPill status={o.payment_status} />
              {o.dhl_tracking_no && <span className="font-mono text-[11px] text-neutral-500">📦 {o.dhl_tracking_no}</span>}
            </div>
          </div>
        ))}
        {!rows.length && <div className="card">{empty}</div>}
        <div className="card"><Pagination total={total} page={page} pageSize={pageSize} basePath="/siparisler" params={{ durum, q, odeme }} label="Sipariş" /></div>
      </div>

      {/* Masaüstü: tablo */}
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr>
                <th className="th">Sipariş</th>
                <th className="th">Tarih</th>
                <th className="th">Müşteri</th>
                <th className="th">Sipariş Durumu</th>
                <th className="th">Ödeme Durumu</th>
                <th className="th">Toplam Tutar</th>
                <th className="th">Satış Kanalı</th>
                <th className="th">Kargo</th>
                <th className="th">Etiket Notu</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const count = o.lines.reduce((s, l) => s + l.qty, 0);
                return (
                  <RowLink key={o.id} href={`/siparisler/${o.id}`}>
                    <td className="td font-semibold">{o.order_no}</td>
                    <td className="td whitespace-nowrap">{fmtDay(o.created_at)}<div className="text-xs text-neutral-500">{fmtTime(o.created_at)}</div></td>
                    <td className="td">
                      <div className="font-medium">{custName(o)}</div>
                      <div className="text-xs text-neutral-500">{o.customer_email || o.customer_phone || (o.customer_ig ? '@' + o.customer_ig : '')}</div>
                    </td>
                    <td className="td">
                      <StatusMenu id={o.id} orderNo={o.order_no} status={o.status} hasTracking={Boolean(o.dhl_tracking_no)} />
                      {o.satisfaction && o.status === 'teslim_edildi' && <div className="mt-1 text-xs text-neutral-500">{SATISFACTION_LABELS[o.satisfaction]}</div>}
                    </td>
                    <td className="td"><PaymentPill status={o.payment_status} /></td>
                    <td className="td whitespace-nowrap"><div className="font-medium">{money(o.total)}</div><div className="text-xs text-primary-text">{count} ürün</div></td>
                    <td className="td whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100"><Instagram className="h-3.5 w-3.5 text-pink-600" /></span>Instagram</span></td>
                    <td className="td text-xs">{o.dhl_tracking_no ? <><div className="font-mono">{o.dhl_tracking_no}</div><div className="text-neutral-500">{o.dhl_status_text || ''}</div></> : <span className="text-neutral-400">—</span>}</td>
                    <td className="td text-xs text-neutral-600">{o.labels ? trunc(o.labels, 48) : <span className="text-neutral-400">—</span>}</td>
                  </RowLink>
                );
              })}
              {!rows.length && <tr><td colSpan={9} className="td">{empty}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-neutral-100">
          <Pagination total={total} page={page} pageSize={pageSize} basePath="/siparisler" params={{ durum, q, odeme }} label="Sipariş" />
        </div>
      </div>
    </>
  );
}
