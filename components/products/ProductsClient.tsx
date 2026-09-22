'use client';
import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Tag, X } from 'lucide-react';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { PageHeader } from '@/components/PageHeader';
import { Field, Empty } from '@/components/ui';
import { Spinner } from '@/components/Loading';
import { money } from '@/lib/format';
import { STANDARD_COLORS } from '@/lib/constants';
import type { Product } from '@/lib/types';

interface Draft { name: string; price: string; description: string; image: string; desi: string; options: string; active: boolean }
const EMPTY: Draft = { name: '', price: '', description: '', image: '', desi: '0', options: '', active: true };
const toDraft = (p: Product): Draft => ({ name: p.name, price: p.price != null ? String(p.price) : '', description: p.description || '', image: p.image || '', desi: String(p.desi ?? 0), options: (p.options || []).join(', '), active: p.active !== 0 });
const optionsText = (p: Product) => (p.options || []).join(', ');
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
    setBusy(true);
    const payload = { name: draft.name, price: draft.price.trim() === '' ? null : draft.price, description: draft.description, image: draft.image, desi: draft.desi.trim() === '' ? 0 : draft.desi, options: draft.options, active: draft.active };
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
              <p className="shrink-0 font-semibold">{p.price != null ? money(p.price) : <span className="font-normal text-neutral-400">fiyat yok</span>}</p>
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
                  <td className="td text-right font-medium">{p.price != null ? money(p.price) : <span className="font-normal text-neutral-400">—</span>}</td>
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
          <Field label="Fiyat (₺)" hint="Boş bırakılırsa siparişte elle girilir."><input value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} inputMode="decimal" className="input" placeholder="0,00" /></Field>
          <Field label="Desi" hint="Kargo hesabı için; şimdilik 0 bırakabilirsiniz."><input value={draft.desi} onChange={(e) => setDraft({ ...draft, desi: e.target.value })} inputMode="decimal" className="input" placeholder="0" /></Field>
          <Field label="Görsel adresi (URL)" hint="Şimdilik boş kalabilir." className="sm:col-span-2"><input value={draft.image} onChange={(e) => setDraft({ ...draft, image: e.target.value })} className="input" placeholder="https://…/urun.jpg" /></Field>
          <Field label="Açıklama" className="sm:col-span-2"><textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="input min-h-[60px]" placeholder="Malzeme, ölçü…" /></Field>
          <Field label="Seçenekler (renk vb.)" hint="Virgülle ayırın. Sipariş formunda bu ürün seçilince satırda seçim kutusu çıkar." className="sm:col-span-2">
            <div className="flex gap-2">
              <input value={draft.options} onChange={(e) => setDraft({ ...draft, options: e.target.value })} className="input" placeholder="Kırmızı, Sarı, Mavi…" />
              <button type="button" onClick={() => setDraft({ ...draft, options: STANDARD_COLORS.join(', ') })} className="btn btn-sm shrink-0" title={STANDARD_COLORS.join(', ')}>9 renk</button>
            </div>
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="h-4 w-4 rounded border-neutral-300 text-primary" />Aktif (sipariş formunda önerilsin)</label>
        </div>
      </Modal>
      <ConfirmDialog open={Boolean(del)} text={del ? `"${del.name}" silinsin mi? Eski siparişlerdeki satırlar etkilenmez.` : ''} okLabel="Sil" danger busy={busy} onCancel={() => setDel(null)} onConfirm={remove} />
    </>
  );
}
