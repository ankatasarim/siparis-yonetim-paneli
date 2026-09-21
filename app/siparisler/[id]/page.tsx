import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Instagram, MessageCircle, Pencil, Truck, User } from 'lucide-react';
import { ready, orders, messaging, dhl, instagram } from '@/lib/services';
import { cfg } from '@/lib/config';
import { FullscreenHeader } from '@/components/FullscreenHeader';
import { StatusPill, PaymentPill } from '@/components/Pills';
import { Card } from '@/components/ui';
import { ShipmentCard, StatusActions, PaymentCard, SatisfactionCard, NotificationsCard, Timeline, OrderActionsMenu } from '@/components/orders/detail';
import { STATUSES, SHIPPING_PAYERS, ONLINE_SUBE_URL } from '@/lib/constants';
import { money, fmtDate } from '@/lib/format';
import type { OrderFull } from '@/lib/types';

function copyBlock(o: OrderFull): string {
  const c = o.customer;
  return [
    `Alıcı: ${c.name || ''}`,
    `Telefon: ${c.phone || ''}`,
    `Adres: ${c.address || ''}${c.district || c.city ? ' · ' + [c.district, c.city].filter(Boolean).join(' / ') : ''}${c.postal_code ? ' ' + c.postal_code : ''}`,
    `Desi: ${o.desi != null ? o.desi : '-'} · Parça: ${o.package_count || 1}`,
    `Kargo ödemesi: ${SHIPPING_PAYERS[o.shipping_payer]}${o.payment_status === 'kapida_odeme' ? ` · KAPIDA ÖDEME (tahsilat ${money(o.total)})` : ''}`,
    `Referans: #${o.order_no}`,
    o.items ? `İçerik: ${o.items}` : null,
    o.labels ? `Etiket notu: ${o.labels}` : null,
  ].filter(Boolean).join('\n');
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ready();
  const o = await orders.get(id);
  if (!o) notFound();
  const nb = await orders.neighbors(o.id);
  const previews = {
    kargo_bildirimi: await messaging.renderForOrder(o, 'kargo_bildirimi'),
    memnuniyet: await messaging.renderForOrder(o, 'memnuniyet'),
    siparis_alindi: await messaging.renderForOrder(o, 'siparis_alindi'),
  };
  const igOk = await instagram.isConfigured();
  const c = o.customer;
  const count = o.lines.reduce((s, l) => s + l.qty, 0);
  const closed = o.status === 'kapandi' || o.status === 'iptal';
  const custName = c.name || (c.ig_username ? '@' + c.ig_username : 'İsimsiz müşteri');
  const navBtn = 'btn btn-dark hidden sm:inline-flex';

  return (
    <div className="min-h-screen bg-page">
      <FullscreenHeader
        back="/siparisler"
        crumbs={[{ label: 'Siparişler', href: '/siparisler' }, { label: `Sipariş #${o.order_no}` }]}
        pills={<><StatusPill status={o.status} className="!border-neutral-600 !bg-transparent !text-white" /><PaymentPill status={o.payment_status} className="!bg-transparent" /></>}
        right={<>
          {nb.prev ? <Link href={`/siparisler/${nb.prev}`} className={navBtn}><ArrowLeft className="h-4 w-4" />Önceki</Link> : <span className={`${navBtn} opacity-40`}><ArrowLeft className="h-4 w-4" />Önceki</span>}
          {nb.next ? <Link href={`/siparisler/${nb.next}`} className={navBtn}>Sonraki<ArrowRight className="h-4 w-4" /></Link> : <span className={`${navBtn} opacity-40`}>Sonraki<ArrowRight className="h-4 w-4" /></span>}
          <Link href={`/siparisler/${o.id}/duzenle`} className="btn btn-dark" title="Siparişi düzenle"><Pencil className="h-4 w-4" /><span className="hidden sm:inline">Düzenle</span></Link>
          <OrderActionsMenu id={o.id} orderNo={o.order_no} />
        </>}
      />

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-3 py-4 sm:px-4 sm:py-6 md:px-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 space-y-5">
          <Card pad={false} title={<><StatusPill status={o.status} /><span className="hidden sm:inline">{STATUSES[o.status].label}</span> <span className="font-normal text-neutral-500">({count} ürün)</span></>} actions={<Link href={`/siparisler/${o.id}/duzenle`} className="btn btn-sm"><Pencil className="h-3.5 w-3.5" />Ürünleri düzenle</Link>}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><th className="th">Ürün</th><th className="th w-14 text-right sm:w-20">Adet</th><th className="th w-24 text-right sm:w-28">Fiyat</th><th className="th w-24 text-right sm:w-32">Toplam</th></tr></thead>
                <tbody>
                  {o.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="td"><div className="flex items-center gap-3"><div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-lg sm:flex">🎨</div><span className="font-medium">{l.name}</span></div></td>
                      <td className="td text-right">{l.qty}</td>
                      <td className="td text-right">{l.price != null ? money(l.price) : <span className="text-neutral-400">—</span>}</td>
                      <td className="td text-right font-medium">{l.price != null ? money(l.qty * l.price) : <span className="text-neutral-400">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {o.labels && <div className="mx-4 my-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm sm:mx-5"><span className="font-medium">🏷 Etiket / kişiselleştirme notu:</span> {o.labels}</div>}
          </Card>

          <Card title={<><Truck className="h-4 w-4 text-neutral-500" />Kargo</>} actions={o.dhl_tracking_no ? <span className="rounded bg-[#ffcc00] px-1.5 py-0.5 text-[10px] font-bold text-[#d40511]">DHL</span> : <span className="text-xs text-neutral-500">Henüz kargoya verilmedi</span>}>
            <ShipmentCard order={{ id: o.id, status: o.status, desi: o.desi, package_count: o.package_count, shipping_payer: o.shipping_payer, shipping_fee: o.shipping_fee, dhl_tracking_no: o.dhl_tracking_no, dhl_status_text: o.dhl_status_text, dhl_last_check: o.dhl_last_check, shipped_at: o.shipped_at, delivered_at: o.delivered_at, tracking_url: o.tracking_url }} copyBlock={copyBlock(o)} canCreate={dhl.canCreate()} canTrack={dhl.canTrack()} onlineSubeUrl={ONLINE_SUBE_URL} />
          </Card>

          <Card title={<><User className="h-4 w-4 text-neutral-500" />Müşteri</>} actions={<><Link href={`/mesajlar/${c.id}`} className="btn btn-sm"><MessageCircle className="h-3.5 w-3.5" />Mesajlar</Link><Link href={`/musteriler/${c.id}`} className="btn btn-sm"><Pencil className="h-3.5 w-3.5" />Düzenle</Link></>}>
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <Link href={`/musteriler/${c.id}`} className="font-medium text-primary-text hover:underline">{custName}</Link>
                <p className="mt-1 text-sm text-neutral-700">{c.email || <span className="text-neutral-400">e-posta yok</span>}</p>
                <p className="text-sm text-neutral-700">{c.phone || <span className="text-neutral-400">telefon yok</span>}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-600"><Instagram className="h-3.5 w-3.5 text-pink-600" />{c.ig_username ? '@' + c.ig_username : 'Instagram adı yok'}{c.ig_user_id ? <span className="ml-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">bağlı</span> : <span className="ml-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">bağlı değil</span>}</p>
              </div>
              <div className="md:border-l md:border-neutral-100 md:pl-6">
                <p className="mb-1 text-sm font-medium">Sevkiyat Adresi</p>
                {c.address ? <p className="text-sm text-neutral-600">{c.name}<br />{c.address}<br />{c.postal_code && `${c.postal_code} `}{[c.district, c.city].filter(Boolean).join(' / ')}<br />Türkiye</p> : <p className="text-sm text-amber-700">Adres girilmemiş · <Link href={`/musteriler/${c.id}`} className="underline">ekle</Link></p>}
              </div>
              <div className="md:border-l md:border-neutral-100 md:pl-6">
                <p className="mb-1 text-sm font-medium">Notlar</p>
                <p className="text-sm text-neutral-600">{o.notes || <span className="text-neutral-400">İç not yok</span>}</p>
                {c.notes && <p className="mt-2 text-xs text-neutral-500">Müşteri notu: {c.notes}</p>}
              </div>
            </div>
          </Card>

          <Card title="Zaman Çizelgesi">
            <Timeline id={o.id} events={o.events} author={cfg.business.ownerName || cfg.business.name} />
          </Card>
        </div>

        <aside className="min-w-0 space-y-5">
          <Card title="Sipariş Özeti">
            <p className="text-sm">{fmtDate(o.created_at)}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm"><Instagram className="h-4 w-4 text-pink-600" />Instagram</p>
            <dl className="mt-4 space-y-2 border-t border-neutral-100 pt-3 text-sm">
              <div className="flex justify-between text-neutral-600"><dt>Ara Toplam</dt><dd>{money(o.subtotal)}</dd></div>
              <div className="flex justify-between text-neutral-600"><dt>{o.shipping_payer === 'alici' ? 'Kargo (alıcı öder)' : 'Kargo'}</dt><dd>{money(o.shipping_fee)}</dd></div>
              <div className="flex justify-between border-t border-neutral-100 pt-2 text-base font-semibold"><dt>Toplam</dt><dd>{money(o.total)}</dd></div>
            </dl>
          </Card>
          <Card title="Ödeme">
            <PaymentCard id={o.id} payment_status={o.payment_status} payment_method={o.payment_method} total={o.total} closed={closed} />
          </Card>
          <Card title="Durum İşlemleri">
            <StatusActions id={o.id} status={o.status} next={o.next_statuses} />
          </Card>
          {(o.status === 'teslim_edildi' || o.status === 'kapandi') && (
            <Card title="Memnuniyet">
              <SatisfactionCard id={o.id} status={o.status} satisfaction={o.satisfaction} note={o.satisfaction_note} askedAt={o.satisfaction_asked_at} preview={previews.memnuniyet} customerName={custName} igLinked={Boolean(c.ig_user_id)} igConfigured={igOk} />
            </Card>
          )}
          <Card title="Bildirimler">
            <NotificationsCard id={o.id} messages={o.messages} previews={previews} igLinked={Boolean(c.ig_user_id)} igConfigured={igOk} customerName={custName} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
