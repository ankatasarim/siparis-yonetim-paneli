'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Minus, Trash2, Search, X, Instagram, Check } from 'lucide-react';
import { api, startNav } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { Card, Field, Avatar } from '@/components/ui';
import { Spinner } from '@/components/Loading';
import { UnsavedGuard } from '@/components/UnsavedGuard';
import { PAYMENT_STATUSES, SHIPPING_PAYERS, PAYMENT_METHODS, ACCOUNT_PAYMENT_METHOD, ORDER_SOURCES, DEFAULT_SOURCE } from '@/lib/constants';
import { money } from '@/lib/format';
import type { Customer, CustomerRow, OrderFull, OrderLine, OrderSource, PaymentStatus, Product, ProductOptionGroup, ShippingPayer } from '@/lib/types';

interface LineDraft { name: string; qty: string; unit_qty: string; price: string; product_id?: number | null; variant: string; units_per_package?: number; unit_name?: string; package_name?: string; unit_price: string }
const toDraft = (l: OrderLine): LineDraft => {
  const unitsPerPackage = l.units_per_package || 1;
  const unitPrice = l.unit_price ?? (l.price != null ? l.price / unitsPerPackage : null);
  return { name: l.name, qty: fmtQty(l.qty), unit_qty: fmtQty(l.qty * unitsPerPackage), price: fmtPrice(l.price), product_id: l.product_id ?? null, variant: l.variant || '', units_per_package: unitsPerPackage, unit_name: l.unit_name || 'adet', package_name: l.package_name || 'adet', unit_price: fmtPrice(unitPrice) };
};
const emptyLine = (name = ''): LineDraft => ({ name, qty: '1', unit_qty: '1', price: '', product_id: null, variant: '', units_per_package: 1, unit_name: 'adet', package_name: 'adet', unit_price: '' });
const norm = (s: string | null | undefined) => (s || '').toLocaleLowerCase('tr');
const num = (v: string) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
/** Fiyatı Türkçe ondalık ayraçla gösterir (62.5 → 62,5); num() geri çevirir. */
const fmtPrice = (n: number | null | undefined) => (n != null ? String(n).replace('.', ',') : '');
const fmtQty = (n: number) => String(Number(n.toFixed(4))).replace('.', ',');
const variantValue = (variant: string, group: ProductOptionGroup, groups: ProductOptionGroup[]) => {
  const prefix = `${group.name}:`;
  const labelled = variant.split(' · ').find((part) => part.startsWith(prefix));
  if (labelled) return labelled.slice(prefix.length).trim();
  return groups.length === 1 && group.values.includes(variant) ? variant : '';
};
const formatVariant = (groups: ProductOptionGroup[], selected: Record<string, string>) => groups
  .filter((group) => selected[group.name])
  .map((group) => `${group.name}: ${selected[group.name]}`)
  .join(' · ');

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
    notes: order?.notes || '', labels: order?.labels || '', desi: order?.desi != null ? String(order.desi) : '', package_count: String(order?.package_count || 1), tax_rate: String(order?.tax_rate ?? 0),
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
  const taxRate = num(f.tax_rate);
  const tax = (subtotal + num(f.shipping_fee)) * (taxRate / 100);
  const total = subtotal + tax + num(f.shipping_fee);
  const setLine = (i: number, patch: Partial<LineDraft>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : [emptyLine()]);
  const addLine = () => { setLines([...lines, emptyLine()]); setFocusIdx(lines.length); };
  const stepQty = (i: number, d: number) => setPackageQty(i, String(Math.max(1, (parseInt(lines[i].qty, 10) || 1) + d)));
  const lineCount = lines.reduce((sum, l) => sum + (l.name.trim() ? num(l.qty) || 1 : 0), 0);
  const unitCount = lines.reduce((sum, l) => sum + (l.name.trim() ? num(l.unit_qty) || 0 : 0), 0);
  const setPackageQty = (i: number, value: string) => {
    const size = lines[i].units_per_package || 1;
    const qty = Number(value.replace(',', '.'));
    setLine(i, { qty: value, unit_qty: value.trim() && Number.isFinite(qty) ? fmtQty(qty * size) : '' });
  };
  const setUnitQty = (i: number, value: string) => {
    const size = lines[i].units_per_package || 1;
    const qty = Number(value.replace(',', '.'));
    setLine(i, { unit_qty: value, qty: value.trim() && Number.isFinite(qty) ? fmtQty(qty / size) : '' });
  };
  const setUnitPrice = (i: number, value: string) => {
    const size = lines[i].units_per_package || 1;
    const price = Number(value.replace(',', '.'));
    setLine(i, { unit_price: value, price: !value.trim() ? '' : Number.isFinite(price) ? fmtPrice(Math.round(price * size * 100) / 100) : lines[i].price });
  };
  const setPackagePrice = (i: number, value: string) => {
    const size = lines[i].units_per_package || 1;
    const price = Number(value.replace(',', '.'));
    setLine(i, { price: value, unit_price: !value.trim() ? '' : Number.isFinite(price) ? fmtPrice(Number((price / size).toFixed(4))) : lines[i].unit_price });
  };
  // Sipariş satırında seçim metni saklanır; mevcut ürünün varyasyon grupları form seçeneklerini sağlar.
  const optionGroupsFor = (l: LineDraft): ProductOptionGroup[] => {
    const p = l.product_id ? products.find((x) => x.id === l.product_id) : null;
    return p?.options || [];
  };
  const suggestionsFor = (text: string) => { const t = norm(text.trim()); return (t ? products.filter((p) => norm(p.name).includes(t) || norm(p.description).includes(t)) : products).slice(0, 8); };
  const pickProduct = (i: number, p: Product) => {
    const size = p.units_per_package || 1;
    const qty = num(lines[i].qty) || 1;
    setLine(i, { name: p.name, qty: fmtQty(qty), unit_qty: fmtQty(qty * size), price: fmtPrice(p.price), product_id: p.id, variant: '', units_per_package: size, unit_name: p.unit_name || 'adet', package_name: p.package_name || 'adet', unit_price: fmtPrice(p.unit_price) });
    setOpenSug(null);
  };

  const submit = async () => {
    const validLines = lines.filter((l) => l.name.trim());
    if (!validLines.length) return toast('En az bir ürün girin', 'err');
    const incompleteVariant = validLines.find((l) => {
      const groups = optionGroupsFor(l);
      return groups.some((group) => !variantValue(l.variant, group, groups));
    });
    if (incompleteVariant) return toast(`"${incompleteVariant.name.trim()}" için tüm ürün varyasyonlarını seçin`, 'err');
    if (!cust.name.trim() && !custId) return toast('Müşteri adı gerekli', 'err');
    setBusy(true);
    const payload = {
      customer: cust, lines: validLines.map((l) => ({ name: l.name.trim(), qty: num(l.qty) || 1, price: l.price.trim() === '' ? null : num(l.price), product_id: l.product_id ?? null, variant: l.variant.trim() || null, units_per_package: l.units_per_package || 1, unit_name: l.unit_name || 'adet', package_name: l.package_name || 'adet', unit_price: l.unit_price.trim() === '' ? null : num(l.unit_price) })),
      notes: f.notes, labels: f.labels, desi: f.desi, package_count: f.package_count, tax_rate: num(f.tax_rate), shipping_payer: f.shipping_payer, shipping_fee: f.shipping_fee,
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
          <Card title="Müşteri" actions={custId ? <span className="text-xs text-neutral-500">Kayıtlı #{custId}{!customer && <button onClick={changeCustomer} className="ml-2 text-primary-text hover:underline">değiştir</button>}</span> : <span className="text-xs text-neutral-500">Yeni müşteri</span>}>
            {!customer && !custId && (
              <div className="mb-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kayıtlı müşteri ara (isim, telefon, @instagram)" className="input pl-9 pr-8" autoFocus={!isEdit} />
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

          <Card title="Ürünler" pad={false} actions={<span className="text-xs text-neutral-500">{products.length ? `${products.length} tanımlı ürün` : 'Tanımlı ürün yok'} · <Link href="/urunler" className="text-primary-text hover:underline">Ürünleri yönet</Link></span>}>
            <div className="hidden border-b border-neutral-100 bg-neutral-50/70 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500 sm:block">Ürün ve paket tanımı</div>
            <div className="divide-y divide-neutral-100">
              {lines.map((l, i) => {
                const optionGroups = optionGroupsFor(l);
                const sugs = openSug === i ? suggestionsFor(l.name) : [];
                return (
                  <div key={i} className="px-4 py-3">
                    {/* Ürün adı (+ katalog önerileri) ve varsa renk / seçenek */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="relative min-w-0 flex-1">
                          <input value={l.name} onChange={(e) => { setLine(i, { name: e.target.value, product_id: null, variant: '', units_per_package: 1, unit_name: 'adet', package_name: 'adet', unit_price: '', unit_qty: l.qty }); setOpenSug(i); }} onFocus={() => setOpenSug(i)} onBlur={() => setTimeout(() => setOpenSug((v) => (v === i ? null : v)), 150)}
                            placeholder={products.length ? 'Ürün adı yazın veya listeden seçin' : 'Örn: İsimli kolye (gümüş)'} className={`input ${l.product_id ? 'pr-8' : ''}`} autoComplete="off" autoFocus={i === focusIdx} />
                          {l.product_id != null && <Check className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" aria-label="Katalogdan seçildi" />}
                          {sugs.length > 0 && (
                            <div className="absolute left-0 top-full z-20 mt-1 w-full min-w-[280px] max-h-72 overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-lg">
                          {sugs.map((p) => (
                            <button key={p.id} type="button" onMouseDown={(e) => { e.preventDefault(); pickProduct(i, p); }} className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-50 ${l.product_id === p.id ? 'bg-primary/5' : ''}`}>
                              {p.image ? <img src={p.image} alt="" className="h-8 w-8 shrink-0 rounded border border-neutral-200 object-cover" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-neutral-200 bg-neutral-50 text-base">🎨</span>}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{p.name}</span>
                                {p.options?.length > 0 ? <span className="block truncate text-xs text-primary-text">{p.options.map((group) => `${group.name} (${group.values.length})`).join(' · ')}</span> : p.description ? <span className="block truncate text-xs text-neutral-500">{p.description}</span> : null}
                              </span>
                              <span className="shrink-0 text-right font-medium text-neutral-700">{p.price != null ? money(p.price) : '—'}{p.units_per_package > 1 && <span className="block text-[10px] font-normal text-neutral-500">{p.unit_price != null ? `${money(p.unit_price)} / ${p.unit_name}` : ''} · {p.units_per_package} {p.unit_name}/{p.package_name}</span>}</span>
                            </button>
                          ))}
                            </div>
                          )}
                        </div>
                        <button type="button" onClick={() => removeLine(i)} className="shrink-0 rounded-md p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 sm:hidden" title="Satırı sil" aria-label="Satırı sil"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      {optionGroups.length > 0 && <div className="mt-2 grid gap-2 sm:grid-cols-2">{optionGroups.map((group) => {
                        const selected = variantValue(l.variant, group, optionGroups);
                        return <label key={group.name} className="min-w-0 text-xs text-neutral-500">{group.name}<select value={selected} onChange={(e) => {
                          const selections = Object.fromEntries(optionGroups.map((item) => [item.name, item === group ? e.target.value : variantValue(l.variant, item, optionGroups)]));
                          setLine(i, { variant: formatVariant(optionGroups, selections) });
                        }} aria-label={group.name} className={`input mt-1 ${selected ? '' : 'border-amber-300 text-neutral-500'}`}>
                          <option value="">{group.name} seçin…</option>
                          {group.values.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select></label>;
                      })}</div>}
                      {l.units_per_package && l.units_per_package > 1 && <p className="mt-1 text-xs text-neutral-500">1 {l.package_name || 'paket'} = {l.units_per_package} {l.unit_name || 'adet'}</p>}
                    </div>
                    <div className="mt-3 grid grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(90px,1fr)_minmax(90px,1fr)_minmax(110px,1fr)_minmax(110px,1fr)_minmax(90px,1fr)_32px] sm:gap-3">
                      <label className="min-w-0 text-xs text-neutral-500">Paket adedi
                        <div className="mt-1 flex items-stretch overflow-hidden rounded-md border border-neutral-300 bg-white">
                          <button type="button" onClick={() => stepQty(i, -1)} className="px-2 text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900" aria-label="Paket azalt"><Minus className="h-3.5 w-3.5" /></button>
                          <input value={l.qty} onChange={(e) => setPackageQty(i, e.target.value)} inputMode="decimal" aria-label={l.package_name || 'Paket adedi'} className="min-w-0 w-full border-x border-neutral-300 py-2 text-center text-sm tabular-nums outline-none focus:bg-primary/5" />
                          <button type="button" onClick={() => stepQty(i, 1)} className="px-2 text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900" aria-label="Paket artır"><Plus className="h-3.5 w-3.5" /></button>
                        </div>
                      </label>
                      <label className="min-w-0 text-xs text-neutral-500">Toplam {l.unit_name || 'adet'}
                        <input value={l.unit_qty} onChange={(e) => setUnitQty(i, e.target.value)} inputMode="numeric" aria-label={`Toplam ${l.unit_name || 'adet'}`} className="input mt-1 text-right tabular-nums" />
                      </label>
                      <label className="min-w-0 text-xs text-neutral-500">Birim fiyatı
                        <div className="relative mt-1"><input value={l.unit_price} onChange={(e) => setUnitPrice(i, e.target.value)} inputMode="decimal" placeholder="0,00" aria-label={`${l.unit_name || 'Birim'} fiyatı`} className="input pr-7 text-right tabular-nums" /><span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400">₺</span></div>
                      </label>
                      <label className="min-w-0 text-xs text-neutral-500">Paket fiyatı
                        <div className="relative mt-1"><input value={l.price} onChange={(e) => setPackagePrice(i, e.target.value)} inputMode="decimal" placeholder="0,00" aria-label="Paket fiyatı" className="input pr-7 text-right tabular-nums" /><span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400">₺</span></div>
                      </label>
                      <div className="col-span-2 flex items-center justify-between border-t border-neutral-100 pt-2 text-xs text-neutral-500 sm:col-span-1 sm:block sm:border-0 sm:pt-0 sm:text-right">Satır toplamı <span className="ml-2 text-sm font-semibold tabular-nums text-neutral-900 sm:mt-1 sm:block">{money(num(l.qty) * num(l.price))}</span></div>
                      <button type="button" onClick={() => removeLine(i)} className="hidden shrink-0 rounded-md p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 sm:block" title="Satırı sil" aria-label="Satırı sil"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50/40 px-4 py-3">
              <button type="button" onClick={addLine} className="btn btn-sm"><Plus className="h-3.5 w-3.5" />Ürün ekle</button>
              <p className="text-right text-sm text-neutral-600">{fmtQty(lineCount)} satış birimi · {fmtQty(unitCount)} adet · Ara toplam <span className="ml-1 font-semibold text-neutral-900">{money(subtotal)}</span></p>
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
              <div className="flex items-center justify-between gap-2 text-neutral-600"><dt>KDV</dt><dd className="flex items-center gap-2"><input value={f.tax_rate} onChange={(e) => setF({ ...f, tax_rate: e.target.value })} inputMode="decimal" className="input w-20 py-1 text-right" /><span>%</span></dd></div>
              <div className="flex items-center justify-between text-neutral-600"><dt>Kargo ücreti</dt><dd><input value={f.shipping_fee} onChange={(e) => setF({ ...f, shipping_fee: e.target.value })} inputMode="decimal" className="input w-28 py-1 text-right" /></dd></div>
              <div className="flex justify-between text-neutral-600"><dt>KDV tutarı</dt><dd>{money(tax)}</dd></div>
              <div className="flex justify-between border-t border-neutral-100 pt-2 text-base font-semibold"><dt>Toplam</dt><dd>{money(total)}</dd></div>
            </dl>
          </Card>
          <Card title="Ödeme">
            <div className="space-y-3">
              <Field label="Ödeme durumu"><select disabled={f.payment_method === ACCOUNT_PAYMENT_METHOD} value={f.payment_status} onChange={(e) => setF({ ...f, payment_status: e.target.value as PaymentStatus })} className="input disabled:cursor-not-allowed disabled:bg-neutral-100">{(Object.keys(PAYMENT_STATUSES) as PaymentStatus[]).map((k) => <option key={k} value={k}>{PAYMENT_STATUSES[k].label}</option>)}</select></Field>
              <Field label="Ödeme yöntemi"><input list="pm" value={f.payment_method} onChange={(e) => setF({ ...f, payment_method: e.target.value, ...(e.target.value === ACCOUNT_PAYMENT_METHOD ? { payment_status: 'bekleniyor' as PaymentStatus } : {}) })} className="input" placeholder="Havale / EFT veya Cari Hesap" /><datalist id="pm">{PAYMENT_METHODS.map((m) => <option key={m} value={m} />)}<option value={ACCOUNT_PAYMENT_METHOD} /></datalist></Field>
              {f.payment_method === ACCOUNT_PAYMENT_METHOD && <p className="-mt-1 rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 md:col-span-2">Sipariş toplamı müşterinin cari hesabına borç yazılır ve “Cari Hesapta” olarak görünür. Tahsilat geldiğinde Cari Hesaplar ekranından kaydedin. Böylece gelir yalnızca tahsil edildiği tarihte raporlanır.</p>}
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
