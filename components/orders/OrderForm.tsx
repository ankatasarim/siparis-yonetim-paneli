'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Search, X, Instagram } from 'lucide-react';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { Card, Field, Avatar } from '@/components/ui';
import { PAYMENT_STATUSES, SHIPPING_PAYERS, PAYMENT_METHODS } from '@/lib/constants';
import { money } from '@/lib/format';
import type { Customer, CustomerRow, OrderFull, OrderLine, PaymentStatus, ShippingPayer } from '@/lib/types';

interface LineDraft { name: string; qty: string; price: string }
const toDraft = (l: OrderLine): LineDraft => ({ name: l.name, qty: String(l.qty), price: l.price != null ? String(l.price) : '' });
const num = (v: string) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };

export function OrderForm({ order, customer, prefillText }: { order?: OrderFull; customer?: Customer | null; prefillText?: string }) {
  const router = useRouter();
  const { toast, fail } = useToast();
  const isEdit = Boolean(order);
  const c0 = customer || order?.customer || null;

  const [lines, setLines] = useState<LineDraft[]>(order?.lines.length ? order.lines.map(toDraft) : [{ name: prefillText || '', qty: '1', price: '' }]);
  const [custId, setCustId] = useState<number | null>(c0?.id ?? null);
  const [cust, setCust] = useState({ name: c0?.name || '', email: c0?.email || '', phone: c0?.phone || '', address: c0?.address || '', city: c0?.city || '', district: c0?.district || '', postal_code: c0?.postal_code || '', ig_username: c0?.ig_username || '' });
  const igLinked = Boolean(c0?.ig_user_id);
  const [f, setF] = useState({
    notes: order?.notes || '', labels: order?.labels || '', desi: order?.desi != null ? String(order.desi) : '', package_count: String(order?.package_count || 1),
    shipping_payer: (order?.shipping_payer || 'gonderici') as ShippingPayer, shipping_fee: String(order?.shipping_fee || 0),
    payment_status: (order?.payment_status || 'bekleniyor') as PaymentStatus, payment_method: order?.payment_method || '',
  });
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<CustomerRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      try { setResults(await api.get(`/api/customers?q=${encodeURIComponent(search.trim())}&limit=8`)); } catch (e) { fail(e); }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const pick = (x: CustomerRow) => {
    setCustId(x.id);
    setCust({ name: x.name || '', email: x.email || '', phone: x.phone || '', address: x.address || '', city: x.city || '', district: x.district || '', postal_code: x.postal_code || '', ig_username: x.ig_username || '' });
    setSearch(''); setResults([]);
  };

  const subtotal = lines.reduce((s, l) => s + num(l.qty) * num(l.price), 0);
  const total = subtotal + num(f.shipping_fee);
  const setLine = (i: number, patch: Partial<LineDraft>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : [{ name: '', qty: '1', price: '' }]);

  const submit = async () => {
    const validLines = lines.filter((l) => l.name.trim());
    if (!validLines.length) return toast('En az bir ürün girin', 'err');
    if (!cust.name.trim() && !custId) return toast('Müşteri adı gerekli', 'err');
    setBusy(true);
    const payload = {
      customer: cust, lines: validLines.map((l) => ({ name: l.name.trim(), qty: num(l.qty) || 1, price: l.price.trim() === '' ? null : num(l.price) })),
      notes: f.notes, labels: f.labels, desi: f.desi, package_count: f.package_count, shipping_payer: f.shipping_payer, shipping_fee: f.shipping_fee,
      payment_status: f.payment_status, payment_method: f.payment_method,
    };
    try {
      if (isEdit) {
        await api.put(`/api/orders/${order!.id}`, payload);
        toast('Sipariş güncellendi', 'ok');
        router.push(`/siparisler/${order!.id}`);
      } else {
        const o = await api.post('/api/orders', custId ? { ...payload, customer_id: custId } : payload);
        toast(`Sipariş #${o.order_no} oluşturuldu`, 'ok');
        router.push(`/siparisler/${o.id}`);
      }
      router.refresh();
    } catch (e) { fail(e); setBusy(false); }
  };

  const cols = 'md:grid-cols-[minmax(0,1fr)_88px_130px_110px_36px]';

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:px-6 md:pb-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 space-y-5">
          <Card title="Ürünler" pad={false}>
            <div className={`hidden gap-3 bg-neutral-50 px-4 py-2 text-xs font-medium text-neutral-500 md:grid ${cols}`}>
              <span>Ürün / açıklama</span><span>Adet</span><span>Birim fiyat (₺)</span><span className="text-right">Toplam</span><span />
            </div>
            <div className="divide-y divide-neutral-100">
              {lines.map((l, i) => (
                <div key={i} className={`grid grid-cols-[minmax(0,1fr)_36px] items-end gap-x-2 gap-y-3 px-4 py-3 md:items-center md:gap-3 ${cols}`}>
                  <div className="min-w-0">
                    <label className="label md:hidden">Ürün / açıklama</label>
                    <input value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} placeholder="Örn: İsimli kolye (gümüş)" className="input" autoFocus={i === 0 && !isEdit} />
                  </div>
                  <button onClick={() => removeLine(i)} className="mb-1 justify-self-end rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 md:col-start-5 md:mb-0" title="Satırı sil"><Trash2 className="h-4 w-4" /></button>
                  {/* Mobilde alt alta: adet, birim fiyat, toplam. Geniş ekranda aynı satırın sütunları. */}
                  <div className="col-span-2 grid grid-cols-1 gap-3 md:contents">
                    <div><label className="label md:hidden">Adet</label><input type="number" min={1} value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} className="input" /></div>
                    <div><label className="label md:hidden">Birim fiyat (₺)</label><input value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} inputMode="decimal" placeholder="0,00" className="input" /></div>
                    <div className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2 text-sm md:block md:bg-transparent md:p-0 md:text-right"><span className="text-neutral-500 md:hidden">Satır toplamı</span><span className="font-medium">{money(num(l.qty) * num(l.price))}</span></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-neutral-100 px-4 py-3"><button onClick={() => setLines([...lines, { name: '', qty: '1', price: '' }])} className="btn btn-sm"><Plus className="h-3.5 w-3.5" />Ürün ekle</button></div>
          </Card>

          <Card title="Müşteri" actions={custId ? <span className="text-xs text-neutral-500">Kayıtlı #{custId}{!isEdit && !customer && <button onClick={() => { setCustId(null); }} className="ml-2 text-primary-text hover:underline">değiştir</button>}</span> : <span className="text-xs text-neutral-500">Yeni müşteri</span>}>
            {!isEdit && !customer && !custId && (
              <div className="mb-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kayıtlı müşteri ara (isim, telefon, @instagram)" className="input pl-9 pr-8" />
                  {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400"><X className="h-4 w-4" /></button>}
                  {results.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg">
                      {results.map((x) => (
                        <button key={x.id} onClick={() => pick(x)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-neutral-50">
                          <Avatar name={x.name || x.ig_username} src={x.profile_pic} size="sm" />
                          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{x.name || '@' + x.ig_username}</p><p className="truncate text-xs text-neutral-500">{[x.phone, x.ig_username ? '@' + x.ig_username : '', x.city].filter(Boolean).join(' · ')}</p></div>
                          <span className="shrink-0 text-xs text-neutral-500">{x.order_count} sipariş</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-neutral-500">Boş bırakırsanız aşağıdaki bilgilerle yeni müşteri oluşturulur.</p>
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Ad Soyad *"><input value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} className="input" /></Field>
              <Field label="Telefon"><input type="tel" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} className="input" placeholder="05xx xxx xx xx" /></Field>
              <Field label="E-posta"><input type="email" value={cust.email} onChange={(e) => setCust({ ...cust, email: e.target.value })} className="input" /></Field>
              <Field label={<span className="flex items-center gap-1"><Instagram className="h-3 w-3 text-pink-600" />Instagram kullanıcı adı</span>}><input value={cust.ig_username} onChange={(e) => setCust({ ...cust, ig_username: e.target.value })} readOnly={igLinked} title={igLinked ? 'Instagram bağlantısından geldi' : ''} className="input" placeholder="kullanici_adi" /></Field>
              <Field label="Adres" className="md:col-span-2"><textarea value={cust.address} onChange={(e) => setCust({ ...cust, address: e.target.value })} className="input min-h-[60px]" placeholder="Mahalle, sokak, no, daire" /></Field>
              <Field label="İl"><input value={cust.city} onChange={(e) => setCust({ ...cust, city: e.target.value })} className="input" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="İlçe"><input value={cust.district} onChange={(e) => setCust({ ...cust, district: e.target.value })} className="input" /></Field>
                <Field label="Posta kodu"><input value={cust.postal_code} onChange={(e) => setCust({ ...cust, postal_code: e.target.value })} className="input" /></Field>
              </div>
            </div>
          </Card>

          <Card title="Notlar">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Etiket / kişiselleştirme notu" hint="Ürün üzerine yazılacak isim, hediye paketi, renk vb. Kargo kopyasında da görünür."><textarea value={f.labels} onChange={(e) => setF({ ...f, labels: e.target.value })} className="input min-h-[70px]" /></Field>
              <Field label="İç not" hint="Sadece siz görürsünüz."><textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className="input min-h-[70px]" /></Field>
            </div>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card title="Özet">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between text-neutral-600"><dt>Ara Toplam</dt><dd>{money(subtotal)}</dd></div>
              <div className="flex items-center justify-between text-neutral-600"><dt>Kargo ücreti</dt><dd><input value={f.shipping_fee} onChange={(e) => setF({ ...f, shipping_fee: e.target.value })} inputMode="decimal" className="input w-28 py-1 text-right" /></dd></div>
              <div className="flex justify-between border-t border-neutral-100 pt-2 text-base font-semibold"><dt>Toplam</dt><dd>{money(total)}</dd></div>
            </dl>
          </Card>
          <Card title="Ödeme">
            <div className="space-y-3">
              <Field label="Ödeme durumu"><select value={f.payment_status} onChange={(e) => setF({ ...f, payment_status: e.target.value as PaymentStatus })} className="input">{(Object.keys(PAYMENT_STATUSES) as PaymentStatus[]).map((k) => <option key={k} value={k}>{PAYMENT_STATUSES[k].label}</option>)}</select></Field>
              <Field label="Ödeme yöntemi"><input list="pm" value={f.payment_method} onChange={(e) => setF({ ...f, payment_method: e.target.value })} className="input" placeholder="Havale / EFT" /><datalist id="pm">{PAYMENT_METHODS.map((m) => <option key={m} value={m} />)}</datalist></Field>
            </div>
          </Card>
          <Card title="Kargo">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Desi"><input value={f.desi} onChange={(e) => setF({ ...f, desi: e.target.value })} inputMode="decimal" className="input" /></Field>
                <Field label="Parça"><input type="number" min={1} value={f.package_count} onChange={(e) => setF({ ...f, package_count: e.target.value })} className="input" /></Field>
              </div>
              <Field label="Kargo ödemesi"><select value={f.shipping_payer} onChange={(e) => setF({ ...f, shipping_payer: e.target.value as ShippingPayer })} className="input">{(Object.keys(SHIPPING_PAYERS) as ShippingPayer[]).map((k) => <option key={k} value={k}>{SHIPPING_PAYERS[k]}</option>)}</select></Field>
            </div>
          </Card>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur md:sticky md:mt-6 md:justify-end md:border-0 md:bg-transparent md:px-0 md:backdrop-blur-0">
        <Link href={isEdit ? `/siparisler/${order!.id}` : '/siparisler'} className="btn flex-1 md:flex-none">Vazgeç</Link>
        <button disabled={busy} onClick={submit} className="btn btn-primary flex-1 md:flex-none">{isEdit ? 'Kaydet' : 'Siparişi oluştur'}</button>
      </div>
    </div>
  );
}
