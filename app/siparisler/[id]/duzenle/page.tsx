import { notFound } from 'next/navigation';
import { ready, orders } from '@/lib/services';
import { FullscreenHeader } from '@/components/FullscreenHeader';
import { OrderForm } from '@/components/orders/OrderForm';

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ready();
  const o = await orders.get(id);
  if (!o) notFound();
  return (
    <div className="min-h-screen bg-page">
      <FullscreenHeader back={`/siparisler/${o.id}`} crumbs={[{ label: 'Siparişler', href: '/siparisler' }, { label: `Sipariş #${o.order_no}`, href: `/siparisler/${o.id}` }, { label: 'Düzenle' }]} />
      <OrderForm order={o} />
    </div>
  );
}
