import { ready, customers } from '@/lib/services';
import { FullscreenHeader } from '@/components/FullscreenHeader';
import { OrderForm } from '@/components/orders/OrderForm';

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await ready();
  const customer = sp.musteri ? await customers.get(sp.musteri) : null;
  return (
    <div className="min-h-screen bg-page">
      <FullscreenHeader back="/siparisler" crumbs={[{ label: 'Siparişler', href: '/siparisler' }, { label: 'Yeni Sipariş' }]} />
      <OrderForm customer={customer} prefillText={sp.mesaj || ''} />
    </div>
  );
}
