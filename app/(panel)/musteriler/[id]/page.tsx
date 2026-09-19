import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Instagram, MessageCircle, Plus } from 'lucide-react';
import { ready, customers, orders } from '@/lib/services';
import { PageHeader } from '@/components/PageHeader';
import { Card, Avatar } from '@/components/ui';
import { PaymentPill } from '@/components/Pills';
import { StatusMenu } from '@/components/orders/StatusMenu';
import { RowLink } from '@/components/RowLink';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { money, fmtDay, fmtDate, trunc } from '@/lib/format';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ready();
  const c = await customers.get(id);
  if (!c) notFound();
  const list = (await orders.list({ customer_id: c.id, pageSize: 100 })).rows;
  const spent = list.filter((o) => o.status !== 'iptal').reduce((s, o) => s + o.total, 0);
  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-3"><Avatar name={c.name || c.ig_username} src={c.profile_pic} />{c.name || (c.ig_username ? '@' + c.ig_username : 'İsimsiz müşteri')}</span>}
        subtitle={<>{c.ig_username && <span className="mr-3 inline-flex items-center gap-1"><Instagram className="h-3.5 w-3.5 text-pink-600" />@{c.ig_username}</span>}Kayıt: {fmtDate(c.created_at)}</>}
        actions={<><Link href={`/mesajlar/${c.id}`} className="btn"><MessageCircle className="h-4 w-4" />Mesajlar</Link><Link href={`/siparisler/yeni?musteri=${c.id}`} className="btn btn-primary"><Plus className="h-4 w-4" />Sipariş Oluştur</Link></>}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="card px-4 py-3"><p className="text-xs text-neutral-500">Sipariş</p><p className="text-xl font-semibold">{list.length}</p></div>
            <div className="card px-4 py-3"><p className="text-xs text-neutral-500">Toplam harcama</p><p className="text-xl font-semibold">{money(spent)}</p></div>
            <div className="card px-4 py-3"><p className="text-xs text-neutral-500">Son sipariş</p><p className="text-xl font-semibold">{list[0] ? fmtDay(list[0].created_at) : '—'}</p></div>
          </div>
          <Card title="Siparişler" pad={false}>
            <div className="overflow-x-auto"><table className="w-full min-w-[560px]">
              <thead><tr><th className="th">No</th><th className="th">Ürünler</th><th className="th">Durum</th><th className="th">Ödeme</th><th className="th text-right">Tutar</th><th className="th">Tarih</th></tr></thead>
              <tbody>
                {list.map((o) => (
                  <RowLink key={o.id} href={`/siparisler/${o.id}`}>
                    <td className="td font-semibold">#{o.order_no}</td>
                    <td className="td">{trunc(o.items, 50)}</td>
                    <td className="td"><StatusMenu id={o.id} orderNo={o.order_no} status={o.status} hasTracking={Boolean(o.dhl_tracking_no)} /></td>
                    <td className="td"><PaymentPill status={o.payment_status} /></td>
                    <td className="td text-right font-medium">{money(o.total)}</td>
                    <td className="td whitespace-nowrap text-neutral-600">{fmtDay(o.created_at)}</td>
                  </RowLink>
                ))}
                {!list.length && <tr><td colSpan={6} className="td text-center text-neutral-500">Henüz sipariş yok.</td></tr>}
              </tbody>
            </table></div>
          </Card>
        </div>
        <Card title="Müşteri bilgileri"><CustomerForm customer={c} /></Card>
      </div>
    </>
  );
}
