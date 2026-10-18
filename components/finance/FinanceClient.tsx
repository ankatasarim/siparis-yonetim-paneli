'use client';

import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Check, CircleDollarSign, LoaderCircle, Plus, Search, Trash2, Wallet, X } from 'lucide-react';
import { api } from '@/lib/client';
import { money, fmtDay } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import type { FinanceEntry } from '@/lib/services/finance';

type Data = { month: string; entries: FinanceEntry[]; income: number; expense: number; net: number };
const EXPENSE_CATEGORIES = ['Ürün / malzeme', 'Kargo', 'Paketleme', 'Reklam', 'Ofis / kira', 'Ulaşım', 'Diğer'];
const INCOME_CATEGORIES = ['Diğer gelir', 'İade', 'Hizmet geliri', 'Diğer'];
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const dateForMonth = (month: string) => today().startsWith(`${month}-`) ? today() : `${month}-01`;

export function FinanceClient({ initial }: { initial: Data }) {
  const [data, setData] = useState(initial);
  const [month, setMonth] = useState(initial.month);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async (selectedMonth: string) => {
    setLoading(true);
    try {
      setData(await api.get<Data>(`/api/finance?month=${encodeURIComponent(selectedMonth)}`));
      setError('');
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  const entries = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    return data.entries.filter((entry) => !q || `${entry.description} ${entry.category} ${entry.notes}`.toLocaleLowerCase('tr-TR').includes(q));
  }, [data.entries, query]);

  const switchType = (next: 'income' | 'expense') => {
    setType(next);
    setCategory(next === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/api/finance', { type, category, description, amount, date, notes });
      setShowForm(false);
      setDescription(''); setAmount(''); setNotes('');
      await load(month);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const remove = async (entry: FinanceEntry) => {
    if (entry.source !== 'manual' || !window.confirm('Bu gelir/gider kaydı silinsin mi?')) return;
    try {
      await api.del(`/api/finance/${entry.id.replace('manual-', '')}`);
      await load(month);
    } catch (e) { setError((e as Error).message); }
  };

  const netPositive = data.net >= 0;
  const max = Math.max(data.income, data.expense, 1);
  const categoryOptions = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <>
      <PageHeader title="Gelir / Gider" subtitle="İşletmenin nakit akışını ve aylık kârlılığını takip edin."
        actions={<button onClick={() => { setError(''); setDate(dateForMonth(month)); setShowForm(true); }} className="btn btn-primary"><Plus className="h-4 w-4" />Kayıt ekle</button>} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-neutral-500"><CalendarDays className="h-4 w-4" /><span>Dönem</span>
          <input aria-label="Ay seç" type="month" value={month} onChange={(event) => { setMonth(event.target.value); void load(event.target.value); }} className="input w-auto py-1.5" />
        </div>
        <p className="text-xs text-neutral-500">Ödemesi alınan siparişler otomatik gelir olarak eklenir.</p>
      </div>

      {error && !showForm && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="card flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ArrowUpRight className="h-5 w-5" /></div>
          <div><p className="text-xs font-medium text-neutral-500">Toplam gelir</p><p className="mt-1 text-xl font-semibold tracking-tight">{money(data.income)}</p></div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-700"><ArrowDownLeft className="h-5 w-5" /></div>
          <div><p className="text-xs font-medium text-neutral-500">Toplam gider</p><p className="mt-1 text-xl font-semibold tracking-tight">{money(data.expense)}</p></div>
        </div>
        <div className={`card flex items-center gap-4 p-5 sm:col-span-2 xl:col-span-1 ${netPositive ? 'border-emerald-200' : 'border-rose-200'}`}>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${netPositive ? 'bg-primary-soft text-primary-text' : 'bg-rose-50 text-rose-700'}`}><Wallet className="h-5 w-5" /></div>
          <div><p className="text-xs font-medium text-neutral-500">Net durum</p><p className={`mt-1 text-xl font-semibold tracking-tight ${netPositive ? 'text-emerald-700' : 'text-rose-700'}`}>{money(data.net)}</p></div>
        </div>
      </div>

      <section className="card mb-5 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><CircleDollarSign className="h-4 w-4 text-neutral-500" />Gelir-gider dengesi</div>
        <div className="space-y-3">
          <div><div className="mb-1.5 flex justify-between text-xs"><span className="text-neutral-500">Gelir</span><span className="font-medium">{money(data.income)}</span></div><div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${data.income ? Math.max(4, (data.income / max) * 100) : 0}%` }} /></div></div>
          <div><div className="mb-1.5 flex justify-between text-xs"><span className="text-neutral-500">Gider</span><span className="font-medium">{money(data.expense)}</span></div><div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-rose-400 transition-all" style={{ width: `${data.expense ? Math.max(4, (data.expense / max) * 100) : 0}%` }} /></div></div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
          <div><h2 className="text-[15px] font-semibold">Hareketler</h2><p className="mt-0.5 text-xs text-neutral-500">{entries.length} kayıt</p></div>
          <label className="relative w-full sm:w-64"><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kayıtlarda ara" className="input pl-9" /></label>
        </header>
        {loading ? <div className="flex justify-center py-12 text-neutral-400"><LoaderCircle className="h-5 w-5 animate-spin" /></div> : entries.length ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left">
            <thead><tr><th className="th">Tarih</th><th className="th">Açıklama</th><th className="th">Kategori</th><th className="th text-right">Tutar</th><th className="th w-12" /></tr></thead>
            <tbody>{entries.map((entry) => <tr key={entry.id} className="group hover:bg-neutral-50">
              <td className="td whitespace-nowrap text-neutral-500">{fmtDay(`${entry.date}T12:00:00`)}</td>
              <td className="td"><div className="font-medium">{entry.description}</div>{entry.notes && <div className="mt-0.5 max-w-xs truncate text-xs text-neutral-500">{entry.notes}</div>}</td>
              <td className="td"><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">{entry.category}</span>{entry.source === 'order' && <span className="ml-1.5 text-[10px] text-neutral-400">OTOMATİK</span>}</td>
              <td className={`td whitespace-nowrap text-right font-semibold ${entry.type === 'income' ? 'text-emerald-700' : 'text-rose-700'}`}>{entry.type === 'income' ? '+' : '−'} {money(entry.amount)}</td>
              <td className="td text-right">{entry.source === 'manual' && <button aria-label={`${entry.description} kaydını sil`} title="Kaydı sil" onClick={() => void remove(entry)} className="rounded p-1.5 text-neutral-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-4 w-4" /></button>}</td>
            </tr>)}</tbody>
          </table></div>
        ) : <div className="px-5 py-12 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-500"><Wallet className="h-5 w-5" /></div><p className="font-medium">Bu dönemde hareket yok</p><p className="mt-1 text-sm text-neutral-500">İlk gelir veya gider kaydınızı ekleyerek başlayın.</p></div>}
      </section>

      {showForm && <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/40 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowForm(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="finance-form-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white shadow-xl sm:max-w-lg sm:rounded-xl">
          <header className="flex items-center justify-between border-b border-neutral-100 px-5 py-4"><div><h2 id="finance-form-title" className="text-lg font-semibold">Yeni kayıt</h2><p className="mt-0.5 text-xs text-neutral-500">Gelir veya gider hareketini kaydedin.</p></div><button type="button" aria-label="Kapat" onClick={() => setShowForm(false)} className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100"><X className="h-5 w-5" /></button></header>
          <form onSubmit={(event) => void submit(event)} className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-neutral-100 p-1"><button type="button" onClick={() => switchType('expense')} className={`rounded-md py-2 text-sm font-medium transition ${type === 'expense' ? 'bg-white text-rose-700 shadow-sm' : 'text-neutral-500'}`}>Gider</button><button type="button" onClick={() => switchType('income')} className={`rounded-md py-2 text-sm font-medium transition ${type === 'income' ? 'bg-white text-emerald-700 shadow-sm' : 'text-neutral-500'}`}>Diğer gelir</button></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="finance-amount" className="label">Tutar (₺)</label><input id="finance-amount" autoFocus required min="0.01" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" className="input" /></div>
              <div><label htmlFor="finance-date" className="label">Tarih</label><input id="finance-date" required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="input" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="finance-category" className="label">Kategori</label><select id="finance-category" value={category} onChange={(event) => setCategory(event.target.value)} className="input">{categoryOptions.map((item) => <option key={item}>{item}</option>)}</select></div>
              <div><label htmlFor="finance-description" className="label">Açıklama</label><input id="finance-description" required maxLength={160} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={type === 'expense' ? 'Örn. kargo malzemesi' : 'Örn. ek satış'} className="input" /></div>
            </div>
            <div><label htmlFor="finance-notes" className="label">Not <span className="font-normal">(isteğe bağlı)</span></label><textarea id="finance-notes" maxLength={500} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ek bilgi" className="input resize-y" /></div>
            {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <footer className="flex justify-end gap-2 border-t border-neutral-100 pt-4"><button type="button" disabled={saving} onClick={() => setShowForm(false)} className="btn">İptal</button><button type="submit" disabled={saving} className="btn btn-primary">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Kaydet</button></footer>
          </form>
        </section>
      </div>}
    </>
  );
}
