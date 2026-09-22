'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Search, X, Instagram } from 'lucide-react';
import { api, startNav } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { Card, Field, Avatar } from '@/components/ui';
import { Spinner } from '@/components/Loading';
import { UnsavedGuard } from '@/components/UnsavedGuard';
import { PAYMENT_STATUSES, SHIPPING_PAYERS, PAYMENT_METHODS, ORDER_SOURCES, DEFAULT_SOURCE } from '@/lib/constants';
import { money } from '@/lib/format';
import type { Customer, CustomerRow, OrderFull, OrderLine, OrderSource, PaymentStatus, Product, ShippingPayer } from '@/lib/types';

interface LineDraft { name: string; qty: string; price: string; product_id?: number | null; variant: string }
const toDraft = (l: OrderLine): LineDraft => ({ name: l.name, qty: String(l.qty), price: l.price != null ? String(l.price) : '', product_id: l.product_id ?? null, variant: l.variant || '' });
const emptyLine = (name = ''): LineDraft => ({ name, qty: '1', price: '', product_id: null, variant: '' });
const norm = (s: string | null | undefined) => (s || '').toLocaleLowerCase('tr');
const num = (v: string) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };

export function OrderForm({ order, customer, prefillText }: { order?: OrderFull; customer?: Customer | null; prefillText?: string }) {
  const router = useRouter();
  const { toast, fail } = useToast();
  const isEdit = Boolean(order);
  const c0 = customer || order?.customer || null;

  const [lines, setLines] = useState<LineDraft[]>(order?.lines.length ? order.lines.map(toDraft) : [emptyLine(prefillText || '')]);
  const [custId, setCustId] = useState<number | null>(c0?.id ?? null);
  const [cust, setCust] = useState({ name: c0?.name || '', email: c0?.email || '', phone: c0?.phone || '', address: c0?.address || '', city: c0?.city || '', district: c0?.district || '', postal_code: c0?.postal_code || '', ig_username: c0?.ig_username || '' });
  const [igLinked, setIgLinked] = useState(Boolean(c0?.ig_user_id));
  const [f, setF] = useState({
    notes: order?.notes || '', labels: order?.labels || '', desi: order?.desi != null ? String(order.desi) : '', package_count: String(order?.package_count || 1),
    shipping_payer: (order?.shipping_payer || 'gonderici') as ShippingPayer, shipping_fee: String(order?.shipping_fee || 0),
    payment_status: (order?.payment_status || 'bekleniyor') as PaymentStatus, payment_method: order?.payment_method || '',
    source: (order?.source && order.source in ORDER_SOURCES ? order.source : DEFAULT_SOURCE) as OrderSource,
  });
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<CustomerRow[]>([]);
  const [busy, setBusy] = useState(false);
  // Ürün kataloğu: satırdaki ürün alanına tıklayınca öneri listesi açılır.
  const [products, setProducts] = useState<Product[]>([]);
  const [openSug, setOpenSug] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  // Kaydedilmemiş değişiklik: formun ilk haliyle karşılaştırılır. Kaydedildikten sonra yönlendirme sorulmaz.
  const snapshot = JSON.stringify({ lines, custId, cust, f });
  const initialSnap = useRef(snapshot);
  const [saved, setSaved] = useState(false);
  const dirty = !saved && snapshot !== initialSnap.current;
  useEffect(() => { api.get<Product[]>('/api/products?active=1').then(setProducts).catch(() => { /* katalog yoksa öneri gösterilmez */ }); }, []);

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
    setIgLinked(Boolean(x.ig_user_id));
    setCust({ name: x.name || '', email: x.email || '', phone: x.phone || '', address: x.address || '', city: x.city || '', district: x.district || '', postal_code: x.postal_code || '', ig_username: x.ig_username || '' });
    setSearch(''); setResults([]);
  };
  // "değiştir": kayıtlı müşteri bağını kaldırır; alanlar temizlenir, arama ile başka müşteri seçilir ya da yeni müşteri girilir.
  const changeCustomer = () => {
    setCustId(null); setIgLinked(false);
    setCust({ name: '', email: '', phone: '', address: '', city: '', district: '', postal_code: '', ig_username: '' });
  };

  const subtotal = lines.reduce((s, l) => s + num(l.qty) * num(l.price), 0);
  const total = subtotal + num(f.shipping_fee);
  const setLine = (i: number, patch: Partial<LineDraft>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : [emptyLine()]);
  const addLine = () => { setLines([...lines, emptyLine()]); setFocusIdx(lines.length); };
  // Satırın ürününde seçenek (renk vb.) tanımlıysa listesi; kayıtlı ama listede olmayan eski seçenek de gösterilir.
  const optionsFor = (l: LineDraft): string[] => {
    const p = l.product_id ? products.find((x) => x.id === l.product_id) : null;
    const opts = p?.options || [];
    if (!opts.length) return [];
    return l.variant && !opts.includes(l.variant) ? [l.variant, ...opts] : opts;
  };
  const suggestionsFor = (text: string) => { const t = norm(text.trim()); return (t ? products.filter((p) => norm(p.name).includes(t) || norm(p.description).includes(t)) : products).slice(0, 8); };
  const pickProduct = (i: number, p: Product) => { setLine(i, { name: p.name, price: p.price != null ? String(p.price) : '', product_id: p.id, variant: '' }); setOpenSug(null); };

  const submit = async () => {
    const validLines = lines.filter((l) => l.name.trim());
    if (!validLines.length) return toast('En az bir ürün girin', 'err');
    const noVariant = validLines.find((l) => optionsFor(l).length > 0 && !l.variant.trim());
    if (noVariant) return toast(`"${noVariant.name.trim()}" için renk / seçenek seçin`, 'err');
    if (!cust.name.trim() && !custId) return toast('Müşteri adı gerekli', 'err');
    setBusy(true);
    const payload = {
      customer: cust, lines: validLines.map((l) => ({ name: l.name.trim(), qty: num(l.qty) || 1, price: l.price.trim() === '' ? null : num(l.price), product_id: l.product_id ?? null, variant: l.variant.trim() || null })),
      notes: f.notes, labels: f.labels, desi: f.desi, package_count: f.package_count, shipping_payer: f.shipping_payer, shipping_fee: f.shipping_fee,
      payment_status: f.payment_status, payment_method: f.payment_method, source: f.source,
    };
    try {
      if (isEdit) {
        await api.put(`/api/orders/${order!.id}`, { ...payload, customer_id: custId });
        toast('Sipariş güncellendi', 'ok');
        setSaved(true);
        startNav();
        router.push(`/siparisler/${order!.id}`);
      } else {
        const o = await api.post('/api/orders', custId ? { ...payload, customer_id: custId } : payload);
        toast(`Sipariş #${o.order_no} oluşturuldu`, 'ok');
        setSaved(true);
        startNav();
        router.push(`/siparisler/${o.id}`);
      }
      router.refresh();
    } catch (e) { fail(e); setBusy(false); }
  };


  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:px-6 md:pb-6">
      <UnsavedGuard when={dirty} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 space-y-5">
          <Card title="Ürünler" pad={false}>
            <div className="divide-y divide-neutral-100">
              {lines.map((l, i) => (
                <div key={i} className="px-4 py-3">
                  {/* Üst satır: ürün alanı tam genişlik + sil düğmesi. Alt satır: adet, birim fiyat, satır toplamı. */}
                  <div className="flex items-end gap-2">
                  <div className="relative min-w-0 flex-1">
                    <label className="label">Ürün / açıklama</label>
                    <input value={l.name} onChange={(e) => { setLine(i, { name: e.target.value, product_id: null, variant: '' }); setOpenSug(i); }} onFocus={() => setOpenSug(i)} onBlur={() => setTimeout(() => setOpenSug((v) => (v === i ? null : v)), 150)}
                      placeholder={products.length ? 'Listeden seçin veya yazın' : 'Örn: İsimli kolye (gümüş)'} className="input" autoComplete="off" autoFocus={i === focusIdx || (focusIdx === null && i === 0 && !isEdit)} />
                    {openSug === i && suggestionsFor(l.name).length > 0 && (
                      <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-lg">
                        {suggestionsFor(l.name).map((p) => (
                          <button key={p.id} type="button" onMouseDown={(e) => { e.preventDefault(); pickProduct(i, p); }} className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-50 ${l.product_id === p.id ? 'bg-primary/5' : ''}`}>
                            <span className="flex min-w-0 items-center gap-2">{p.image && <img src={p.image} alt="" className="h-7 w-7 shrink-0 rounded border border-neutral-200 object-cover" />}<span className="min-w-0"><span className="block truncate font-medium">{p.name}</span>{p.description && <span className="block truncate text-xs text-neutral-500">{p.description}</span>}{p.options && p.options.length > 0 && <span className="block truncate text-xs text-primary-text">{p.options.length} seçenek: {p.options.join(', ')}</span>}</span></span>
                            <span className="shrink-0 text-neutral-600">{p.price != null ? money(p.price) : '—'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => removeLine(i)} className="mb-1 shrink-0 rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600" title="Satırı sil"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className={`mt-3 grid grid-cols-1 gap-3 sm:items-end ${optionsFor(l).length ? 'sm:grid-cols-[minmax(150px,220px)_110px_150px_minmax(0,1fr)]' : 'sm:grid-cols-[110px_150px_minmax(0,1fr)]'}`}>
                    {optionsFor(l).length > 0 && (
                      <div>
                        <label className="label">Renk / seçenek</label>
                        <select value={l.variant} onChange={(e) => setLine(i, { variant: e.target.value })} className={`input ${l.variant ? '' : 'text-neutral-500'}`}>
                          <option value="">Seçin…</option>
                          {optionsFor(l).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    )}
                    <div><label className="label">Adet</label><input type="number" min={1} value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} className="input" /></div>
                    <div><label className="label">Birim fiyat (₺)</label><input value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} inputMode="decimal" placeholder="0,00" className="input" /></div>
                    <div className="flex items-center justify-between gap-3 rounded-md bg-neutral-50 px-3 py-2 text-sm sm:justify-end"><span className="text-neutral-500">Satır toplamı</span><span className="font-medium">{money(num(l.qty) * num(l.price))}</span></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 px-4 py-3">
              <button onClick={addLine} className="btn btn-sm"><Plus className="h-3.5 w-3.5" />Ürün ekle</button>
              <p className="text-xs text-neutral-500">{products.length ? `${products.length} tanımlı ürün · ürün alanına tıklayınca liste açılır` : 'Tanımlı ürün yok'} · <Link href="/urunler" className="text-primary-text hover:underline">Ürünleri yönet</Link></p>
            </div>
          </Card>

          <Card title="Müşteri" actions={custId ? <span className="text-xs text-neutral-500">Kayıtlı #{custId}{!customer && <button onClick={changeCustomer} className="ml-2 text-primary-text hover:underline">değiştir</button>}</span> : <span className="text-xs text-neutral-500">Yeni müşteri</span>}>
            {!customer && !custId && (
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
                <p className="mt-1 text-xs text-neutral-500">{isEdit ? 'Bir müşteri seçin ya da aşağıya yeni müşteri bilgilerini girin; sipariş bu müşteriye bağlanır.' : 'Boş bırakırsanız aşağıdaki bilgilerle yeni müşteri oluşturulur.'}</p>
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
          <Card title="Sipariş Kanalı">
            <select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as OrderSource })} className="input">{(Object.keys(ORDER_SOURCES) as OrderSource[]).map((k) => <option key={k} value={k}>{ORDER_SOURCES[k].label}</option>)}</select>
            <p className="mt-1.5 text-xs text-neutral-500">Siparişin geldiği yer: Instagram DM, WhatsApp ya da Shopier.</p>
          </Card>
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
        <button disabled={busy} onClick={submit} className="btn btn-primary flex-1 md:flex-none">{busy && <Spinner />}{isEdit ? 'Kaydet' : 'Siparişi oluştur'}</button>
      </div>
    </div>
  );
}
