'use client';

import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, BookUser, CalendarDays, Check, ChevronRight, CircleDollarSign, LoaderCircle, Plus, Search, Wallet, X } from 'lucide-react';
import { api } from '@/lib/client';
import { fmtDay, money } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { Avatar } from '@/components/ui';
import type { AccountTransaction, CustomerAccount } from '@/lib/services/accounts';

type Overview = { accounts: CustomerAccount[]; total_receivable: number };
type Detail = { customer: CustomerAccount; transactions: AccountTransaction[] };
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function AccountsClient({ initial }: { initial: Overview }) {
  const [overview, setOverview] = useState(initial);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'charge' | 'payment'>('charge');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const accounts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    return overview.accounts.filter((account) => !query || [account.name, account.phone, account.ig_username, account.email].some((value) => value?.toLocaleLowerCase('tr-TR').includes(query)));
  }, [overview.accounts, search]);

  const refreshOverview = async () => {
    const next = await api.get<Overview>('/api/cari');
    setOverview(next);
  };

  const openAccount = async (account: CustomerAccount) => {
    setLoading(true);
    setError('');
    try {
      setSelected(await api.get<Detail>(`/api/cari?customer_id=${account.id}`));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/api/cari', { customer_id: selected.customer.id, type, description, amount, date, notes });
      const detail = await api.get<Detail>(`/api/cari?customer_id=${selected.customer.id}`);
      setSelected(detail);
      await refreshOverview();
      setFormOpen(false);
      setDescription(''); setAmount(''); setNotes(''); setDate(today());
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const openForm = (nextType: 'charge' | 'payment') => {
    setType(nextType);
    setDate(today());
    setDescription(''); setAmount(''); setNotes(''); setError('');
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader title="Cari Hesaplar" subtitle="Müşterilerin vadeli alışverişlerini ve tahsilatlarını takip edin."
        actions={<button disabled={!selected} onClick={() => openForm('charge')} className="btn btn-primary"><Plus className="h-4 w-4" />Borç kaydet</button>} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="card flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Wallet className="h-5 w-5" /></div>
          <div><p className="text-xs font-medium text-neutral-500">Toplam açık bakiye</p><p className="mt-1 text-xl font-semibold tracking-tight">{money(overview.total_receivable)}</p></div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary-text"><BookUser className="h-5 w-5" /></div>
          <div><p className="text-xs font-medium text-neutral-500">Cari hesaplı müşteri</p><p className="mt-1 text-xl font-semibold tracking-tight">{overview.accounts.filter((account) => account.charges > 0 || account.payments > 0).length}</p></div>
        </div>
      </div>

      {error && !formOpen && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="card overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
            <div><h2 className="text-[15px] font-semibold">Müşteriler</h2><p className="mt-0.5 text-xs text-neutral-500">Bir müşteriyi seçerek hesap ekstresini açın.</p></div>
            <label className="relative w-full sm:w-56"><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Müşteri ara" className="input pl-9" /></label>
          </header>
          <div className="max-h-[660px] divide-y divide-neutral-100 overflow-y-auto">
            {accounts.map((account) => <button key={account.id} onClick={() => void openAccount(account)} className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-neutral-50 ${selected?.customer.id === account.id ? 'bg-primary-soft/60' : ''}`}>
              <Avatar name={account.name || account.ig_username} src={account.profile_pic} size="sm" />
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{account.name || 'İsimsiz müşteri'}</span><span className="block truncate text-xs text-neutral-500">{[account.phone, account.ig_username ? `@${account.ig_username}` : ''].filter(Boolean).join(' · ') || 'Telefon veya Instagram bilgisi yok'}</span></span>
              <span className="text-right"><span className={`block font-semibold ${account.balance > 0 ? 'text-amber-700' : account.balance < 0 ? 'text-emerald-700' : 'text-neutral-500'}`}>{money(Math.abs(account.balance))}</span><span className="block text-[10px] text-neutral-400">{account.balance > 0 ? 'borçlu' : account.balance < 0 ? 'avans' : 'kapalı'}</span></span>
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
            </button>)}
            {!accounts.length && <div className="px-4 py-12 text-center text-sm text-neutral-500">Aramaya uygun müşteri bulunamadı.</div>}
          </div>
        </section>

        <section className="card min-h-[340px] overflow-hidden">
          {selected ? <>
            <header className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-4 sm:px-5">
              <Avatar name={selected.customer.name || selected.customer.ig_username} src={selected.customer.profile_pic} />
              <div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{selected.customer.name || 'İsimsiz müşteri'}</h2><p className="truncate text-xs text-neutral-500">{[selected.customer.phone, selected.customer.ig_username ? `@${selected.customer.ig_username}` : ''].filter(Boolean).join(' · ') || selected.customer.email || 'Müşteri bilgileri'}</p></div>
              <div className="text-right"><p className="text-[11px] text-neutral-500">Güncel bakiye</p><p className={`font-semibold ${selected.customer.balance > 0 ? 'text-amber-700' : selected.customer.balance < 0 ? 'text-emerald-700' : ''}`}>{money(Math.abs(selected.customer.balance))}</p><p className="text-[10px] text-neutral-400">{selected.customer.balance > 0 ? 'müşteri borcu' : selected.customer.balance < 0 ? 'müşteri avansı' : 'hesap kapalı'}</p></div>
            </header>
            <div className="flex flex-wrap gap-2 border-b border-neutral-100 px-4 py-3 sm:px-5"><button onClick={() => openForm('charge')} className="btn btn-sm"><ArrowDownLeft className="h-4 w-4 text-amber-600" />Vadeli satış / borç</button><button onClick={() => openForm('payment')} className="btn btn-sm"><ArrowUpRight className="h-4 w-4 text-emerald-600" />Tahsilat al</button></div>
            <div className="overflow-x-auto">
              {loading ? <div className="flex justify-center py-12 text-neutral-400"><LoaderCircle className="h-5 w-5 animate-spin" /></div> : selected.transactions.length ? <table className="w-full min-w-[500px] text-left"><thead><tr><th className="th">Tarih</th><th className="th">Açıklama</th><th className="th text-right">Hareket</th><th className="th text-right">Bakiye etkisi</th></tr></thead><tbody>{selected.transactions.map((entry) => <tr key={entry.id} className="hover:bg-neutral-50"><td className="td whitespace-nowrap text-neutral-500">{fmtDay(`${entry.date}T12:00:00`)}</td><td className="td"><p className="font-medium">{entry.description}</p>{entry.notes && <p className="mt-0.5 max-w-xs truncate text-xs text-neutral-500">{entry.notes}</p>}</td><td className={`td whitespace-nowrap text-right font-medium ${entry.type === 'charge' ? 'text-amber-700' : 'text-emerald-700'}`}>{entry.type === 'charge' ? 'Borç' : 'Tahsilat'}<br />{money(entry.amount)}</td><td className={`td whitespace-nowrap text-right font-semibold ${entry.type === 'charge' ? 'text-amber-700' : 'text-emerald-700'}`}>{entry.type === 'charge' ? '+' : '−'}{money(entry.amount)}</td></tr>)}</tbody></table> : <div className="px-5 py-12 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-500"><CircleDollarSign className="h-5 w-5" /></div><p className="font-medium">Henüz cari hareket yok</p><p className="mt-1 text-sm text-neutral-500">Vadeli satış veya tahsilat kaydı ekleyin.</p></div>}
            </div>
          </> : <div className="flex min-h-[340px] flex-col items-center justify-center px-6 py-12 text-center"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500"><BookUser className="h-5 w-5" /></div><p className="font-medium">Müşteri hesabı seçin</p><p className="mt-1 max-w-sm text-sm text-neutral-500">Vadeli alışverişi borç olarak kaydedin, müşteri ödeme yaptıkça tahsilat girin.</p></div>}
        </section>
      </div>

      {formOpen && selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/40 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="account-form-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white shadow-xl sm:max-w-lg sm:rounded-xl">
          <header className="flex items-center justify-between border-b border-neutral-100 px-5 py-4"><div><h2 id="account-form-title" className="text-lg font-semibold">{type === 'charge' ? 'Vadeli satış / borç kaydı' : 'Tahsilat kaydı'}</h2><p className="mt-0.5 text-xs text-neutral-500">{selected.customer.name || 'Müşteri hesabı'}</p></div><button type="button" aria-label="Kapat" onClick={() => setFormOpen(false)} className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100"><X className="h-5 w-5" /></button></header>
          <form onSubmit={(event) => void submit(event)} className="space-y-4 p-5">
            <div className={`rounded-lg px-3 py-2 text-sm ${type === 'charge' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{type === 'charge' ? 'Bu hareket müşterinin açık borcuna eklenecek.' : 'Bu tahsilat müşterinin açık bakiyesini düşürür ve gelir raporuna eklenir.'}</div>
            <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="account-amount" className="label">Tutar (₺)</label><input id="account-amount" autoFocus required min="0.01" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" className="input" /></div><div><label htmlFor="account-date" className="label">Tarih</label><div className="relative"><CalendarDays aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input id="account-date" required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="input pl-9" /></div></div></div>
            <div><label htmlFor="account-description" className="label">Açıklama</label><input id="account-description" required maxLength={160} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={type === 'charge' ? 'Örn. mavi elbise · 2 adet' : 'Örn. havale ile ödeme'} className="input" /></div>
            <div><label htmlFor="account-notes" className="label">Not <span className="font-normal">(isteğe bağlı)</span></label><textarea id="account-notes" maxLength={500} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ek bilgi" className="input resize-y" /></div>
            {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <footer className="flex justify-end gap-2 border-t border-neutral-100 pt-4"><button type="button" disabled={saving} onClick={() => setFormOpen(false)} className="btn">İptal</button><button type="submit" disabled={saving} className="btn btn-primary">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Kaydet</button></footer>
          </form>
        </section>
      </div>}
    </>
  );
}
