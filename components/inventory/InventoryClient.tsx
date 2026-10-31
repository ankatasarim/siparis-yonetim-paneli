'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Boxes, Check, ChevronDown, CircleAlert, History, PackageCheck, Plus, Search, Settings2, ShieldCheck, X } from 'lucide-react';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { PageHeader } from '@/components/PageHeader';
import { Field, Empty } from '@/components/ui';
import { Spinner } from '@/components/Loading';
import type { InventoryMovement, Product } from '@/lib/types';

type StockRow = { product_id: number; product_name: string; unit_name: string; inventory_enabled: number; variant_id: number | null; variant_key: string | null; variant_label: string | null; sku: string; stock_on_hand: number; stock_reserved: number; low_stock_threshold: number; legacy?: boolean };
type Overview = {
  products: Product[];
  stock_rows: StockRow[];
  movements: InventoryMovement[];
  summary: { tracked_products: number; total_on_hand: number; total_reserved: number; reserved_products: number; low_stock: number; out_of_stock: number };
};
type Action = 'receipt' | 'adjustment' | 'return' | 'settings';
const numberText = (n: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n || 0);
const ACTIONS: { id: Action; title: string; caption: string; icon: typeof ArrowDownToLine }[] = [
  { id: 'receipt', title: 'Stok girişi', caption: 'Tedarikçi teslimatı veya satın alma', icon: ArrowDownToLine },
  { id: 'adjustment', title: 'Sayım düzeltmesi', caption: 'Fiziksel sayım farkını +/- olarak işle', icon: ArrowLeftRight },
  { id: 'return', title: 'İade girişi', caption: 'Kontrol edilip tekrar satılabilir ürün', icon: ArrowUpFromLine },
];

export function InventoryClient({ initial }: { initial: Overview }) {
  const { toast, fail } = useToast();
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'untracked'>('all');
  const [product, setProduct] = useState<StockRow | null>(null);
  const [action, setAction] = useState<Action>('receipt');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [note, setNote] = useState('');
  const [sku, setSku] = useState('');
  const [threshold, setThreshold] = useState('');
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);

  const shown = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('tr');
    return data.stock_rows.filter((p) => {
      const matchesTerm = !term || p.product_name.toLocaleLowerCase('tr').includes(term) || p.sku.toLocaleLowerCase('tr').includes(term) || (p.variant_label || '').toLocaleLowerCase('tr').includes(term);
      const available = p.stock_on_hand - p.stock_reserved;
      return matchesTerm && (p.legacy ? filter === 'all' : filter === 'all' ? p.inventory_enabled : filter === 'low' ? p.inventory_enabled && available <= p.low_stock_threshold : !p.inventory_enabled);
    });
  }, [data.stock_rows, query, filter]);

  const reload = async () => setData(await api.get<Overview>('/api/inventory'));
  const openAction = (p: StockRow, next: Action) => {
    setProduct(p); setAction(next); setQuantity(''); setUnitCost(''); setNote('');
    setSku(p.sku || ''); setThreshold(String(p.low_stock_threshold || 0));
    setTrackingEnabled(Boolean(p.inventory_enabled));
  };
  const close = () => { if (!busy) setProduct(null); };

  const save = async () => {
    if (!product) return;
    setBusy(true);
    try {
      if (action === 'settings') {
        if (product.variant_id) await api.put(`/api/inventory/variants/${product.variant_id}`, { enabled: trackingEnabled, sku, low_stock_threshold: threshold });
        else await api.put(`/api/inventory/products/${product.product_id}`, { enabled: trackingEnabled, sku, low_stock_threshold: threshold });
        toast(trackingEnabled ? 'Stok takibi etkinleştirildi' : 'Stok takibi kapatıldı; mevcut miktarlar korundu', 'ok');
      } else {
        const result = await api.post<Product>('/api/inventory', {
          product_id: product.product_id, variant_id: product.variant_id, variant_key: product.variant_key, type: action, quantity,
          unit_cost: unitCost.trim() ? unitCost : null, note,
        });
        toast(`${product.product_name}: stok hareketi kaydedildi`, 'ok');
      }
      await reload();
      setProduct(null);
    } catch (e) { fail(e); }
    finally { setBusy(false); }
  };

  const labelForMovement = (movement: InventoryMovement) => ({
    receipt: 'Stok girişi', adjustment: 'Sayım düzeltmesi', return: 'İade girişi', shipment: 'Sipariş çıkışı',
    order_reservation: 'Sipariş rezervasyonu', reservation_release: 'Rezervasyon bırakıldı',
  }[movement.movement_type] || movement.movement_type);

  return (
    <>
      <PageHeader title="Stok Yönetimi" info="Stok girişi yapmak için ürün ve gerekiyorsa renk/beden seçin. Varyasyon kaydı yalnızca ilk stok girişi kaydedildiğinde oluşturulur." subtitle={`${data.summary.tracked_products} stok takipli ürün · son 100 hareket`} actions={<><button onClick={() => setEntryOpen(true)} className="btn btn-primary"><Plus className="h-4 w-4" />Stok Girişi</button><button onClick={() => reload().catch(fail)} className="btn"><History className="h-4 w-4" />Yenile</button></>} />

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric icon={<Boxes className="h-5 w-5" />} label="Takipli ürün" value={numberText(data.summary.tracked_products)} detail="stok takibi açık" tone="neutral" />
        <Metric icon={<PackageCheck className="h-5 w-5" />} label="Rezervasyonlu" value={numberText(data.summary.reserved_products)} detail="sipariş için stok ayrılmış ürün" tone="blue" />
        <Metric icon={<CircleAlert className="h-5 w-5" />} label="Kritik seviye" value={numberText(data.summary.low_stock)} detail="minimum seviyede veya altında" tone="amber" />
        <Metric icon={<ShieldCheck className="h-5 w-5" />} label="Stokta yok" value={numberText(data.summary.out_of_stock)} detail="siparişe uygun değil" tone="red" />
      </div>

      <section className="card mb-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
          <div><h2 className="font-semibold">Ürün ve varyasyon stokları</h2><p className="text-xs text-neutral-500">Renk/beden seçeneklerinin stoğu ayrı izlenir. Sipariş seçilen varyasyondan düşer.</p></div>
          <div className="flex flex-wrap gap-2">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input className="input h-9 w-48 pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ürün veya SKU ara" />{query && <button className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400" onClick={() => setQuery('')} aria-label="Aramayı temizle"><X className="h-4 w-4" /></button>}</div>
            <select className="input h-9 w-auto" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option value="all">Tüm ürünler</option><option value="low">Kritik stok</option><option value="untracked">Takip edilmeyen</option></select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px]">
            <thead><tr><th className="th">Ürün / SKU</th><th className="th text-right">Depoda</th><th className="th text-right">Ayrılmış</th><th className="th text-right">Kullanılabilir</th><th className="th text-right">Minimum</th><th className="th">Durum</th><th className="th text-right">İşlemler</th></tr></thead>
            <tbody>
              {shown.map((p) => {
                const available = p.stock_on_hand - p.stock_reserved;
                const low = !p.legacy && p.inventory_enabled && available <= p.low_stock_threshold;
                return <tr key={`${p.product_id}-${p.variant_id || 'base'}`}>
                  <td className="td"><p className="font-medium">{p.product_name}</p><p className={`text-xs ${p.legacy ? 'text-amber-700' : 'text-primary-text'}`}>{p.variant_label || 'Standart ürün'}</p><p className="text-xs text-neutral-500">{p.sku || 'SKU tanımsız'} · {p.unit_name}</p></td>
                  <td className="td text-right font-medium">{numberText(p.stock_on_hand)}</td>
                  <td className="td text-right text-neutral-600">{numberText(p.stock_reserved)}</td>
                  <td className={`td text-right font-semibold ${available <= 0 && p.inventory_enabled ? 'text-red-600' : ''}`}>{numberText(available)}</td>
                  <td className="td text-right text-neutral-600">{numberText(p.low_stock_threshold)}</td>
                  <td className="td">{p.legacy ? <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">Dağıtılmamış eski stok</span> : p.inventory_enabled ? <span className={`rounded-full px-2 py-1 text-xs font-medium ${low ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{low ? 'Kritik stok' : 'Takipte'}</span> : <span className="text-xs text-neutral-400">Takip kapalı</span>}</td>
                  <td className="td"><div className="flex justify-end gap-1.5">{p.legacy ? <span className="text-xs text-amber-700">Dağıtım için sayım yapın</span> : p.inventory_enabled ? <><button onClick={() => openAction(p, 'receipt')} className="btn btn-xs" title="Stok girişi"><Plus className="h-3 w-3" />Giriş</button><button onClick={() => openAction(p, 'adjustment')} className="btn btn-xs" title="Sayım düzeltmesi"><ArrowLeftRight className="h-3 w-3" /></button><button onClick={() => openAction(p, 'return')} className="btn btn-xs" title="İade girişi"><ArrowUpFromLine className="h-3 w-3" /></button><button onClick={() => openAction(p, 'settings')} className="btn btn-xs" title="Stok takibi ayarları"><Settings2 className="h-3 w-3" /></button></> : <button onClick={() => openAction(p, 'settings')} className="btn btn-xs btn-primary"><Plus className="h-3 w-3" />Takibi aç</button>}</div></td>
                </tr>;
              })}
              {!shown.length && <tr><td colSpan={7} className="td"><Empty icon={<Boxes className="mx-auto h-8 w-8 text-neutral-300" />} title={filter === 'all' && !query ? 'Henüz stok kaydı yok' : 'Ürün bulunamadı'} text={filter === 'all' && !query ? 'Başlamak için üstteki Stok Girişi düğmesine tıklayın; ürün ve varyasyon seçip miktarı kaydedin.' : 'Arama veya filtreyi değiştirebilirsiniz.'} /></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3"><History className="h-4 w-4 text-neutral-500" /><h2 className="font-semibold">Stok hareket geçmişi</h2></div>
        {data.movements.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px]"><thead><tr><th className="th">Tarih</th><th className="th">Ürün / varyasyon</th><th className="th">Hareket</th><th className="th text-right">Miktar</th><th className="th">Referans / Açıklama</th></tr></thead><tbody>{data.movements.map((m) => <tr key={m.id}><td className="td whitespace-nowrap text-xs text-neutral-500">{new Date(m.created_at).toLocaleString('tr-TR')}</td><td className="td font-medium">{m.product_name || `Ürün #${m.product_id}`}{m.variant_label && <span className="block text-xs font-normal text-primary-text">{m.variant_label}</span>}</td><td className="td">{labelForMovement(m)}</td><td className={`td text-right font-semibold ${m.quantity < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{m.quantity > 0 ? '+' : ''}{numberText(m.quantity)}</td><td className="td text-sm text-neutral-600">{m.reference || '—'}{m.note && <span className="block text-xs text-neutral-400">{m.note}</span>}</td></tr>)}</tbody></table></div> : <div className="px-4 py-8 text-center text-sm text-neutral-500">Henüz stok hareketi yok.</div>}
      </section>

      <Modal open={Boolean(product)} onClose={close} title={action === 'settings' ? 'Stok takibi ve eşik ayarları' : ACTIONS.find((x) => x.id === action)?.title || 'Stok hareketi'} footer={<><button onClick={close} className="btn" disabled={busy}>Vazgeç</button><button onClick={save} className="btn btn-primary" disabled={busy}>{busy && <Spinner />}{action === 'settings' ? 'Ayarları kaydet' : 'Hareketi kaydet'}</button></>}>
        {product && <div className="space-y-3">
          <div className="rounded-lg bg-neutral-50 px-3 py-2"><p className="font-medium">{product.product_name}</p>{product.variant_label && <p className="text-sm text-primary-text">{product.variant_label}</p>}<p className="text-xs text-neutral-500">{product.sku || 'SKU tanımsız'} · stok birimi: {product.unit_name}{product.inventory_enabled ? ` · kullanılabilir: ${numberText(product.stock_on_hand - product.stock_reserved)}` : ''}</p></div>
          {action === 'settings' ? <>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 p-3"><input type="checkbox" checked={trackingEnabled} onChange={(e) => setTrackingEnabled(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary" /><span><span className="block text-sm font-medium">Bu ürün/varyasyon için stok takibi açık</span><span className="mt-0.5 block text-xs text-neutral-500">Kapattığınızda mevcut stok ve hareket geçmişi korunur; yeni siparişlerde stok rezervasyonu yapılmaz. Açık siparişlerde önceden ayrılmış stoklar mevcut sipariş yaşam döngüsünde işlenmeye devam eder.</span></span></label>
            <Field label="SKU / Barkod"><input className="input" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Örn. URN-001" maxLength={64} /></Field>
            <Field label={`Minimum stok (${product.unit_name})`} hint="Bu seviyeye gelindiğinde stok kritik olarak işaretlenir."><input className="input" type="number" min="0" step="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></Field>
            <p className="rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">Takibi istediğiniz zaman açıp kapatabilirsiniz. Kapattığınızda mevcut miktar, SKU ve hareket geçmişi silinmez.</p>
          </> : <>
            <Field label={`Miktar (${product.unit_name})`} hint={action === 'adjustment' ? 'Sayım farkını artı veya eksi olarak girin.' : 'Yalnızca kontrol edilmiş, satılabilir ürünleri ekleyin.'}><input autoFocus className="input" type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={action === 'adjustment' ? 'Örn. -2 veya 5' : 'Örn. 25'} /></Field>
            {action === 'receipt' && <Field label="Birim maliyet (₺, isteğe bağlı)"><input className="input" type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="0,00" /></Field>}
            <Field label="Belge / referans (isteğe bağlı)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Fatura no, tedarikçi veya açıklama" /></Field>
          </>}
        </div>}
      </Modal>
      <StockEntryModal open={entryOpen} products={data.products} onClose={() => setEntryOpen(false)} onSaved={async () => { await reload(); setEntryOpen(false); }} />
    </>
  );
}

function StockEntryModal({ open, products, onClose, onSaved }: { open: boolean; products: Product[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const { toast, fail } = useToast();
  const [productId, setProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const productPickerRef = useRef<HTMLDivElement>(null);
  const selectedProduct = products.find((item) => item.id === Number(productId));
  const matchingProducts = products
    .filter((item) => item.active)
    .filter((item) => {
      const query = productSearch.trim().toLocaleLowerCase('tr');
      return !query || item.name.toLocaleLowerCase('tr').includes(query) || item.sku.toLocaleLowerCase('tr').includes(query) || item.description.toLocaleLowerCase('tr').includes(query);
    })
    .slice(0, 40);
  const variantKey = selectedProduct?.options.map((group) => `${group.name}: ${selections[group.name] || ''}`).join(' · ') || '';
  const ready = Boolean(selectedProduct && quantity.trim() && Number(quantity.replace(',', '.')) > 0 && selectedProduct.options.every((group) => selections[group.name]));

  useEffect(() => {
    if (!productMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !productPickerRef.current?.contains(event.target)) setProductMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setProductMenuOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [productMenuOpen]);

  const close = () => {
    if (busy) return;
    setProductId(''); setProductSearch(''); setProductMenuOpen(false); setSelections({}); setQuantity(''); setUnitCost(''); setReference(''); onClose();
  };

  const submit = async () => {
    if (!selectedProduct || !ready) return;
    setBusy(true);
    try {
      await api.post('/api/inventory', {
        product_id: selectedProduct.id,
        variant_key: selectedProduct.options.length ? variantKey : null,
        type: 'receipt', quantity,
        unit_cost: unitCost.trim() ? unitCost : null,
        reference: reference.trim(), note: reference.trim(),
      });
      toast(`Stok girişi kaydedildi · ${selectedProduct.name}${selectedProduct.options.length ? ` · ${variantKey}` : ''}`, 'ok');
      await onSaved();
      setProductId(''); setProductSearch(''); setProductMenuOpen(false); setSelections({}); setQuantity(''); setUnitCost(''); setReference('');
    } catch (e) { fail(e); }
    finally { setBusy(false); }
  };

  return <Modal open={open} onClose={close} title="Stok Girişi" footer={<><button className="btn" onClick={close} disabled={busy}>Vazgeç</button><button className="btn btn-primary" onClick={submit} disabled={!ready || busy}>{busy && <Spinner />}Stok girişini kaydet</button></>}>
    <div className="space-y-3">
      <Field label="Ürün *">
        <div ref={productPickerRef} className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            role="combobox"
            aria-label="Ürün ara ve seç"
            aria-expanded={productMenuOpen}
            aria-controls="stock-product-options"
            aria-autocomplete="list"
            className={`input h-11 pl-10 pr-10 ${productMenuOpen ? 'border-primary ring-2 ring-primary/10' : ''}`}
            value={productMenuOpen ? productSearch : selectedProduct?.name || productSearch}
            onFocus={() => { setProductSearch(''); setProductMenuOpen(true); }}
            onChange={(e) => { setProductSearch(e.target.value); setProductId(''); setSelections({}); setProductMenuOpen(true); }}
            placeholder="Ürün adı, SKU veya açıklama yazın…"
          />
          <button type="button" onClick={() => { setProductSearch(''); setProductMenuOpen((open) => !open); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700" aria-label="Ürün listesini aç">
            <ChevronDown className={`h-4 w-4 transition-transform ${productMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {productMenuOpen && <div id="stock-product-options" role="listbox" className="absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl shadow-neutral-900/10">
            <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{productSearch ? 'Arama sonuçları' : 'Ürünler'}</p>
            {matchingProducts.length ? matchingProducts.map((item) => <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === selectedProduct?.id}
              onClick={() => { setProductId(String(item.id)); setProductSearch(''); setProductMenuOpen(false); setSelections({}); }}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${item.id === selectedProduct?.id ? 'bg-primary/5' : 'hover:bg-neutral-50'}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-500"><Boxes className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-neutral-800">{item.name}</span><span className="mt-0.5 block truncate text-xs text-neutral-500">{item.sku ? `SKU ${item.sku} · ` : ''}{item.options.length ? `${item.options.map((group) => group.name).join(' / ')} · ${item.options.reduce((count, group) => count * group.values.length, 1)} varyasyon` : item.description || `Stok birimi: ${item.unit_name}`}</span></span>
              {item.id === selectedProduct?.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>) : <div className="px-3 py-7 text-center"><Search className="mx-auto h-5 w-5 text-neutral-300" /><p className="mt-2 text-sm font-medium text-neutral-600">Ürün bulunamadı</p><p className="mt-0.5 text-xs text-neutral-400">Arama kelimesini değiştirebilirsiniz.</p></div>}
            {matchingProducts.length === 40 && <p className="px-2.5 py-1.5 text-center text-xs text-neutral-400">Daha fazla sonuç için aramanızı daraltın.</p>}
          </div>}
        </div>
      </Field>
      {selectedProduct?.options.map((group) => <Field key={group.name} label={`${group.name} *`}><select className="input" value={selections[group.name] || ''} onChange={(e) => setSelections((current) => ({ ...current, [group.name]: e.target.value }))}><option value="">{group.name} seçin…</option>{group.values.map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>)}
      {selectedProduct && <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-600">Stok birimi: <b>{selectedProduct.unit_name}</b>{selectedProduct.options.length ? <span className="block pt-1">Varyasyon kaydı yalnızca bu stok girişi kaydedilince oluşturulur.</span> : null}</p>}
      <Field label={`Miktar${selectedProduct ? ` (${selectedProduct.unit_name})` : ''} *`}><input className="input" type="number" min="0.0001" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Örn. 25" /></Field>
      <Field label="Birim maliyet (₺, isteğe bağlı)"><input className="input" type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="0,00" /></Field>
      <Field label="Belge / referans (isteğe bağlı)"><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={500} placeholder="Fatura no, tedarikçi veya açıklama" /></Field>
    </div>
  </Modal>;
}

function Metric({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: string; detail: string; tone: 'neutral' | 'blue' | 'amber' | 'red' }) {
  const colors = { neutral: 'bg-neutral-100 text-neutral-600', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700' };
  return <div className="card flex items-start gap-3 p-4"><div className={`rounded-lg p-2 ${colors[tone]}`}>{icon}</div><div className="min-w-0"><p className="text-xs text-neutral-500">{label}</p><p className="text-xl font-semibold">{value}</p><p className="text-xs text-neutral-400">{detail}</p></div></div>;
}
