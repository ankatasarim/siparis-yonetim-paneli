'use client';
import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Tag, X, Layers } from 'lucide-react';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { PageHeader } from '@/components/PageHeader';
import { Field, Empty } from '@/components/ui';
import { Spinner } from '@/components/Loading';
import { money } from '@/lib/format';
import { STANDARD_COLORS } from '@/lib/constants';
import type { Product, ProductOptionGroup } from '@/lib/types';

interface Draft { name: string; unit_price: string; units_per_package: string; unit_name: string; package_name: string; description: string; image: string; desi: string; options: ProductOptionGroup[]; active: boolean }
const EMPTY: Draft = { name: '', unit_price: '', units_per_package: '1', unit_name: 'adet', package_name: 'adet', description: '', image: '', desi: '0', options: [], active: true };
const toDraft = (p: Product): Draft => ({ name: p.name, unit_price: p.unit_price != null ? String(p.unit_price) : '', units_per_package: String(p.units_per_package || 1), unit_name: p.unit_name || 'adet', package_name: p.package_name || 'adet', description: p.description || '', image: p.image || '', desi: String(p.desi ?? 0), options: p.options || [], active: p.active !== 0 });
const optionsText = (p: Product) => (p.options || []).map((group) => `${group.name}: ${group.values.join(', ')}`).join(' · ');
const fmtDesi = (d: number | null | undefined) => (d ? String(d).replace('.', ',') : '0');
const norm = (s: string | null | undefined) => (s || '').toLocaleLowerCase('tr');
const byName = (a: Product, b: Product) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'tr');

export function ProductsClient({ initial }: { initial: Product[] }) {
  const { toast, fail } = useToast();
  const [list, setList] = useState<Product[]>(initial);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<Product | null>(null);

  const shown = useMemo(() => {
    const t = norm(q.trim());
    return t ? list.filter((p) => norm(p.name).includes(t) || norm(p.description).includes(t)) : list;
  }, [list, q]);

  const openNew = () => { setDraft(EMPTY); setEditing('new'); };
  const openEdit = (p: Product) => { setDraft(toDraft(p)); setEditing(p); };
  const close = () => { if (!busy) setEditing(null); };

  const save = async () => {
    if (!draft.name.trim()) return toast('Ürün adı gerekli', 'err');
    const invalidGroup = draft.options.find((group) => !group.name.trim() || !group.values.length);
    if (invalidGroup) return toast('Her varyasyon özelliğine bir ad ve en az bir değer ekleyin', 'err');
    const groupNames = draft.options.map((group) => group.name.trim().toLocaleLowerCase('tr'));
    if (new Set(groupNames).size !== groupNames.length) return toast('Varyasyon özellik adları birbirinden farklı olmalı', 'err');
    setBusy(true);
    const payload = { name: draft.name, unit_price: draft.unit_price.trim() === '' ? null : draft.unit_price, units_per_package: draft.units_per_package, unit_name: draft.unit_name, package_name: draft.package_name, description: draft.description, image: draft.image, desi: draft.desi.trim() === '' ? 0 : draft.desi, options: draft.options, active: draft.active };
    try {
      if (editing === 'new') {
        const p = await api.post<Product>('/api/products', payload);
        setList([...list, p].sort(byName));
        toast('Ürün eklendi', 'ok');
      } else if (editing) {
        const p = await api.put<Product>(`/api/products/${editing.id}`, payload);
        setList(list.map((x) => (x.id === p.id ? p : x)).sort(byName));
        toast('Ürün güncellendi', 'ok');
      }
      setEditing(null);
    } catch (e) { fail(e); }
    setBusy(false);
  };

  const toggle = async (p: Product) => {
    try {
      const r = await api.put<Product>(`/api/products/${p.id}`, { active: p.active === 0 });
      setList(list.map((x) => (x.id === r.id ? r : x)));
    } catch (e) { fail(e); }
  };

  const remove = async () => {
    if (!del) return;
    setBusy(true);
    try {
      await api.del(`/api/products/${del.id}`);
      setList(list.filter((x) => x.id !== del.id));
      toast('Ürün silindi', 'ok');
      setDel(null);
    } catch (e) { fail(e); }
    setBusy(false);
  };

  const activePill = (p: Product) => (
    <button onClick={() => toggle(p)} title={p.active ? 'Pasife al (sipariş formunda önerilmez)' : 'Aktife al'} className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}>
      {p.active ? 'Aktif' : 'Pasif'}
    </button>
  );
  const emptyState = <Empty icon={<Tag className="mx-auto h-8 w-8 text-neutral-300" />} title={q ? 'Eşleşen ürün yok' : 'Henüz ürün tanımlanmadı'} text={q ? undefined : 'Sık sattığınız ürünleri ekleyin; sipariş oluştururken listeden seçersiniz.'} action={q ? undefined : <button onClick={openNew} className="btn btn-primary"><Plus className="h-4 w-4" />Ürün ekle</button>} />;

  return (
    <>
      <PageHeader title="Ürünler" info="Tanımlı ürünler sipariş formunda ürün alanına tıklayınca listelenir; seçince ad ve fiyat satıra kopyalanır." subtitle={`${list.length} ürün · ${list.filter((p) => p.active).length} aktif`} actions={<button onClick={openNew} className="btn btn-primary"><Plus className="h-4 w-4" />Ürün Ekle</button>} />
      <div className="mb-4">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ürün adı, açıklama…" className="input pl-9 pr-8" />
          {q && <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400" aria-label="Temizle"><X className="h-4 w-4" /></button>}
        </div>
      </div>

      {/* Mobil: kartlar */}
      <div className="space-y-3 md:hidden">
        {shown.map((p) => (
          <div key={p.id} className={`card px-4 py-3 ${p.active ? '' : 'opacity-70'}`}>
            <div className="flex items-start justify-between gap-3">
              {p.image ? <img src={p.image} alt="" className="h-12 w-12 shrink-0 rounded-md border border-neutral-200 object-cover" /> : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-lg">🎨</div>}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-neutral-500">{p.description || '—'}</p>
                {optionsText(p) && <p className="text-xs text-primary-text">Seçenekler: {optionsText(p)}</p>}
                <p className="text-xs text-neutral-500">Desi: {fmtDesi(p.desi)}</p>
              </div>
                <p className="shrink-0 text-right font-semibold">{p.unit_price != null ? <>{money(p.unit_price)}<span className="font-normal text-neutral-500"> / {p.unit_name}</span></> : <span className="font-normal text-neutral-400">fiyat yok</span>}{p.units_per_package > 1 && <span className="block text-xs font-normal text-neutral-500">{p.units_per_package} {p.unit_name} / {p.package_name} · paket {p.price != null ? money(p.price) : 'fiyat yok'}</span>}</p>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {activePill(p)}
              <button onClick={() => openEdit(p)} className="btn btn-xs ml-auto"><Pencil className="h-3 w-3" />Düzenle</button>
              <button onClick={() => setDel(p)} className="btn btn-xs btn-danger" aria-label="Sil"><Trash2 className="h-3 w-3" /></button>
            </div>
          </div>
        ))}
        {!shown.length && <div className="card">{emptyState}</div>}
      </div>

      {/* Masaüstü: tablo */}
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead><tr><th className="th">Ürün</th><th className="th text-right">Fiyat</th><th className="th text-right">Desi</th><th className="th">Durum</th><th className="th w-40" /></tr></thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className={p.active ? '' : 'opacity-60'}>
                  <td className="td">
                    <div className="flex items-center gap-3">
                      {p.image ? <img src={p.image} alt="" className="h-9 w-9 shrink-0 rounded-md border border-neutral-200 object-cover" /> : <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-base">🎨</div>}
                      <div className="min-w-0"><p className="font-medium">{p.name}</p>{p.description && <p className="max-w-md truncate text-xs text-neutral-500">{p.description}</p>}{optionsText(p) && <p className="max-w-md truncate text-xs text-primary-text">Seçenekler: {optionsText(p)}</p>}</div>
                    </div>
                  </td>
                  <td className="td text-right"><span className="font-medium">{p.unit_price != null ? `${money(p.unit_price)} / ${p.unit_name}` : <span className="font-normal text-neutral-400">—</span>}</span>{p.units_per_package > 1 && <span className="block text-xs font-normal text-neutral-500">{p.units_per_package} {p.unit_name} / {p.package_name} · {p.price != null ? money(p.price) : '—'}</span>}</td>
                  <td className="td text-right text-neutral-600">{fmtDesi(p.desi)}</td>
                  <td className="td">{activePill(p)}</td>
                  <td className="td">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => openEdit(p)} className="btn btn-xs"><Pencil className="h-3 w-3" />Düzenle</button>
                      <button onClick={() => setDel(p)} className="btn btn-xs btn-danger" aria-label="Sil"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={5} className="td">{emptyState}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={editing !== null} onClose={close} title={editing === 'new' ? 'Yeni ürün' : 'Ürünü düzenle'}
        footer={<><button className="btn" onClick={close} disabled={busy}>Vazgeç</button><button className="btn btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />}{editing === 'new' ? 'Ekle' : 'Kaydet'}</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ürün adı *" className="sm:col-span-2"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} className="input" placeholder="Örn: İsimli kolye (gümüş)" autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <Field label={`Birim fiyatı (₺ / ${draft.unit_name || 'adet'})`} hint="Satış paketinin fiyatı içerik adediyle otomatik hesaplanır."><input value={draft.unit_price} onChange={(e) => setDraft({ ...draft, unit_price: e.target.value })} inputMode="decimal" className="input" placeholder="0,00" /></Field>
            <Field label="Pakette kaç birim var?" hint="Tekli ürünlerde 1 bırakın."><input value={draft.units_per_package} onChange={(e) => { const value = e.target.value; const size = Number(value); const package_name = draft.package_name === 'adet' && size > 1 ? 'paket' : draft.package_name === 'paket' && size === 1 ? 'adet' : draft.package_name; setDraft({ ...draft, units_per_package: value, package_name }); }} inputMode="numeric" className="input" placeholder="1" /></Field>
            <Field label="İç birim adı" hint="Örn. adet, metre, gram"><input value={draft.unit_name} onChange={(e) => setDraft({ ...draft, unit_name: e.target.value })} className="input" placeholder="adet" /></Field>
            <Field label="Satış birimi adı" hint="Örn. paket, kutu, koli; tekli ürünlerde adet"><input value={draft.package_name} onChange={(e) => setDraft({ ...draft, package_name: e.target.value })} className="input" placeholder="paket" /></Field>
          </div>
          <p className="-mt-2 text-xs text-neutral-500 sm:col-span-2">Paket fiyatı önizleme: {draft.unit_price.trim() && Number(draft.units_per_package) > 0 ? money(Math.round((Number(draft.unit_price.replace(',', '.')) || 0) * Number(draft.units_per_package) * 100) / 100) : 'Birim fiyat girilmedi'}</p>
          <Field label="Desi" hint="Kargo hesabı için; şimdilik 0 bırakabilirsiniz."><input value={draft.desi} onChange={(e) => setDraft({ ...draft, desi: e.target.value })} inputMode="decimal" className="input" placeholder="0" /></Field>
          <Field label="Görsel adresi (URL)" hint="Şimdilik boş kalabilir." className="sm:col-span-2"><input value={draft.image} onChange={(e) => setDraft({ ...draft, image: e.target.value })} className="input" placeholder="https://…/urun.jpg" /></Field>
          <Field label="Açıklama" className="sm:col-span-2"><textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="input min-h-[60px]" placeholder="Malzeme, ölçü…" /></Field>
          <div className="space-y-2 sm:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="label mb-0">Ürün varyasyonları</p><p className="mt-1 text-xs text-neutral-500">Renk, beden, ölçü gibi özellikleri gruplar halinde tanımlayın. Siparişte her grup ayrı seçilir.</p></div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { const colors: ProductOptionGroup = { name: 'Renk', values: STANDARD_COLORS }; const exists = draft.options.some((group) => group.name.toLocaleLowerCase('tr') === 'renk'); setDraft({ ...draft, options: exists ? draft.options.map((group) => group.name.toLocaleLowerCase('tr') === 'renk' ? colors : group) : [...draft.options, colors] }); }} className="btn btn-sm">Renk şablonu</button>
                <button type="button" onClick={() => setDraft({ ...draft, options: [...draft.options, { name: 'Yeni özellik', values: [] }] })} className="btn btn-sm"><Plus className="h-3.5 w-3.5" />Özellik ekle</button>
              </div>
            </div>
            {draft.options.length ? <div className="space-y-2">{draft.options.map((group, index) => <OptionGroupEditor key={index} group={group} onChange={(next) => setDraft({ ...draft, options: draft.options.map((item, i) => i === index ? next : item) })} onRemove={() => setDraft({ ...draft, options: draft.options.filter((_, i) => i !== index) })} />)}</div> : <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 px-4 py-5 text-center"><Layers className="mx-auto h-5 w-5 text-neutral-400" /><p className="mt-1 text-sm font-medium text-neutral-700">Henüz varyasyon eklenmedi</p><p className="mt-0.5 text-xs text-neutral-500">Tek ürün olarak satılıyorsa boş bırakabilirsiniz.</p></div>}
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="h-4 w-4 rounded border-neutral-300 text-primary" />Aktif (sipariş formunda önerilsin)</label>
        </div>
      </Modal>
      <ConfirmDialog open={Boolean(del)} text={del ? `"${del.name}" silinsin mi? Eski siparişlerdeki satırlar etkilenmez.` : ''} okLabel="Sil" danger busy={busy} onCancel={() => setDel(null)} onConfirm={remove} />
    </>
  );
}

function OptionGroupEditor({ group, onChange, onRemove }: { group: ProductOptionGroup; onChange: (group: ProductOptionGroup) => void; onRemove: () => void }) {
  const [valueDraft, setValueDraft] = useState('');
  const addValues = (input: string) => {
    const additions = input.split(/[,\n;]/).map((value) => value.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (!additions.length) return;
    const values = [...group.values];
    for (const value of additions) if (!values.some((existing) => existing.toLocaleLowerCase('tr') === value.toLocaleLowerCase('tr'))) values.push(value.slice(0, 40));
    onChange({ ...group, values });
    setValueDraft('');
  };
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1"><label className="label">Özellik adı</label><input value={group.name} onChange={(e) => onChange({ ...group, name: e.target.value })} className="input" placeholder="Örn. Renk, Beden, Ölçü" maxLength={40} /></div>
        <button type="button" onClick={onRemove} className="mt-5 rounded-md p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600" aria-label={`${group.name} özelliğini kaldır`} title="Özelliği kaldır"><X className="h-4 w-4" /></button>
      </div>
      <label className="label mt-3">Değerler</label>
      {group.values.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{group.values.map((value, index) => <span key={`${value}-${index}`} className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 py-1 pl-2.5 pr-1 text-xs text-neutral-700">{value}<button type="button" onClick={() => onChange({ ...group, values: group.values.filter((_, i) => i !== index) })} className="rounded-full p-0.5 text-neutral-400 hover:bg-white hover:text-red-600" aria-label={`${value} değerini kaldır`}><X className="h-3 w-3" /></button></span>)}</div>}
      <div className="flex gap-2"><input value={valueDraft} onChange={(e) => setValueDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addValues(valueDraft); } }} className="input" placeholder="Değer yazın, Enter ile ekleyin" /><button type="button" onClick={() => addValues(valueDraft)} disabled={!valueDraft.trim()} className="btn btn-sm shrink-0"><Plus className="h-3.5 w-3.5" />Ekle</button></div>
      <p className="mt-1 text-xs text-neutral-500">Birden fazla değeri virgülle ayırarak da ekleyebilirsiniz.</p>
    </div>
  );
}
