'use client';

import { useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Banknote, CalendarDays, ChartNoAxesCombined, CircleDollarSign, PackageCheck, ShoppingBag, Truck, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { api } from '@/lib/client';
import { money } from '@/lib/format';

type Report = {
  from: string; to: string;
  orders: { count: number; cancelled: number; avg: number; unpaidCount: number; unpaidAmount: number };
  sales: { net: number; revenue: number; shipping: number };
  cash: { orderCollections: number; accountCollections: number; manualIncome: number; income: number; expenses: number; result: number };
  receivable: number;
  daily: { date: string; sales: number; collections: number; expenses: number }[];
  expenseCategories: { category: string; amount: number }[];
  topProducts: { name: string; quantity: number; amount: number }[];
  paymentMethods: { method: string; count: number }[];
};

const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const shortDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

function Metric({ title, value, detail, icon: Icon, tone = 'slate' }: { title: string; value: string; detail: string; icon: typeof Wallet; tone?: 'slate' | 'green' | 'red' | 'blue' | 'amber' }) {
  const colors = { slate: 'bg-slate-100 text-slate-700', green: 'bg-emerald-50 text-emerald-700', red: 'bg-rose-50 text-rose-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700' };
  return <article className="card p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium text-neutral-500">{title}</p><p className="mt-2 break-words text-xl font-semibold tracking-tight sm:text-2xl">{value}</p><p className="mt-1 text-xs text-neutral-500">{detail}</p></div><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors[tone]}`}><Icon className="h-5 w-5" /></span></div></article>;
}

export function ReportsClient({ initial }: { initial: Report }) {
  const [data, setData] = useState(initial);
  const [range, setRange] = useState({ from: initial.from, to: initial.to });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const applyRange = async (next = range) => {
    setRange(next);
    setLoading(true); setError('');
    try { setData(await api.get<Report>(`/api/reports?from=${encodeURIComponent(next.from)}&to=${encodeURIComponent(next.to)}`)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };
  const quickRange = (period: '7d' | 'month' | 'last') => {
    const now = new Date();
    if (period === 'month') return applyRange({ from: `${localDate(now).slice(0, 7)}-01`, to: localDate(now) });
    if (period === 'last') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return applyRange({ from: localDate(first), to: localDate(last) });
    }
    const start = new Date(now); start.setDate(start.getDate() - 6);
    return applyRange({ from: localDate(start), to: localDate(now) });
  };
  const maxChart = Math.max(1, ...data.daily.flatMap((day) => [day.sales, day.collections, day.expenses]));
  const resultPositive = data.cash.result >= 0;
  const rangeLabel = `${shortDate(data.from)} – ${shortDate(data.to)}`;

  return <>
    <PageHeader title="İşletme raporu" subtitle="Sipariş, tahsilat ve giderlerin tek ekranda dönem özeti." actions={<span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600"><CalendarDays className="h-3.5 w-3.5" />{rangeLabel}</span>} />
    <section className="card mb-5 flex flex-wrap items-end gap-3 p-4">
      <label className="min-w-[145px] flex-1 sm:flex-none"><span className="label">Başlangıç</span><input aria-label="Başlangıç tarihi" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="input" /></label>
      <label className="min-w-[145px] flex-1 sm:flex-none"><span className="label">Bitiş</span><input aria-label="Bitiş tarihi" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="input" /></label>
      <button className="btn btn-primary h-[42px] flex-1 sm:flex-none" disabled={loading || !range.from || !range.to} onClick={() => void applyRange()}>{loading ? 'Yükleniyor…' : 'Raporu göster'}</button>
      <div className="flex w-full gap-2 border-t border-neutral-100 pt-3 sm:ml-auto sm:w-auto sm:border-0 sm:pt-0">
        <button className="btn btn-sm flex-1 sm:flex-none" onClick={() => void quickRange('7d')}>Son 7 gün</button><button className="btn btn-sm flex-1 sm:flex-none" onClick={() => void quickRange('month')}>Bu ay</button><button className="btn btn-sm flex-1 sm:flex-none" onClick={() => void quickRange('last')}>Geçen ay</button>
      </div>
    </section>
    {error && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Net satış" value={money(data.sales.net)} detail="Ürün satışları · iptaller hariç" icon={ShoppingBag} tone="blue" />
        <Metric title="Ciro" value={money(data.sales.revenue)} detail={`${money(data.sales.shipping)} kargo dahil`} icon={ChartNoAxesCombined} tone="slate" />
        <Metric title="Net kazanç" value={money(data.cash.result)} detail="Tahsilat − gider · ürün maliyeti hariç" icon={data.cash.result >= 0 ? ArrowUpRight : ArrowDownRight} tone={resultPositive ? 'green' : 'red'} />
        <Metric title="Toplam tahsilat" value={money(data.cash.income)} detail="Sipariş + cari + diğer gelir" icon={Banknote} tone="green" />
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Siparişler" value={data.orders.count.toLocaleString('tr-TR')} detail={`${data.orders.cancelled} iptal · ortalama ${money(data.orders.avg)}`} icon={PackageCheck} />
        <Metric title="Ödeme bekleyen" value={money(data.orders.unpaidAmount)} detail={`${data.orders.unpaidCount} sipariş`} icon={CircleDollarSign} tone="amber" />
        <Metric title="Cari alacak" value={money(data.receivable)} detail="Tüm cari hesapların güncel bakiyesi" icon={Wallet} tone="amber" />
        <Metric title="Dönem gideri" value={money(data.cash.expenses)} detail={`${money(data.cash.manualIncome)} diğer gelir kaydı`} icon={ArrowDownRight} tone="red" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        <div className="card p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="flex items-center gap-2 font-semibold"><Activity className="h-4 w-4 text-primary" />Günlük hareket</h2><p className="mt-1 text-xs text-neutral-500">Satış, tahsilat ve gider karşılaştırması</p></div><div className="flex flex-wrap gap-3 text-[11px] text-neutral-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-500" />Ciro</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Tahsilat</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-400" />Gider</span></div></div>
          {data.daily.length ? <div className="flex h-52 items-end gap-1 overflow-x-auto border-b border-neutral-100 pb-6 pt-2 sm:gap-2">{data.daily.map((day) => <div key={day.date} title={`${day.date}: ciro ${money(day.sales)} · tahsilat ${money(day.collections)} · gider ${money(day.expenses)}`} className="group flex h-full min-w-[12px] flex-1 flex-col justify-end"><div className="flex h-full items-end justify-center gap-[2px]">{([[day.sales, 'bg-blue-500'], [day.collections, 'bg-emerald-500'], [day.expenses, 'bg-rose-400']] as const).map(([value, color], index) => <div key={index} className={`w-full max-w-3 rounded-t-sm ${color} transition-opacity group-hover:opacity-75`} style={{ height: `${Math.max(value > 0 ? 3 : 0, value / maxChart * 100)}%` }} />)}</div><span className="mt-2 whitespace-nowrap text-center text-[9px] text-neutral-400">{data.daily.length <= 14 || new Date(`${day.date}T12:00:00`).getDate() % 5 === 1 ? shortDate(day.date) : ''}</span></div>)}</div> : <p className="py-12 text-center text-sm text-neutral-500">Bu dönemde hareket bulunmuyor.</p>}
        </div>
        <div className="card p-4 sm:p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold"><Wallet className="h-4 w-4 text-primary" />Nakit özeti</h2>
          <div className="space-y-4">
            {[['Sipariş tahsilatı', data.cash.orderCollections, 'text-blue-700'], ['Cari tahsilatlar', data.cash.accountCollections, 'text-emerald-700'], ['Diğer gelir', data.cash.manualIncome, 'text-emerald-700']].map(([label, amount, color]) => <div key={String(label)} className="flex items-center justify-between gap-3 text-sm"><span className="text-neutral-600">{label}</span><span className={`font-semibold ${color}`}>{money(Number(amount))}</span></div>)}
            <div className="flex items-center justify-between gap-3 border-t border-dashed border-neutral-200 pt-4 text-sm"><span className="text-neutral-600">Giderler</span><span className="font-semibold text-rose-700">− {money(data.cash.expenses)}</span></div>
            <div className={`rounded-lg p-3 ${resultPositive ? 'bg-emerald-50' : 'bg-rose-50'}`}><div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">Gelir − gider</span><span className={`text-base font-bold ${resultPositive ? 'text-emerald-800' : 'text-rose-800'}`}>{money(data.cash.result)}</span></div><p className="mt-1 text-[11px] text-neutral-500">Muhasebeleştirilmiş nakit hareketi; stok/ürün maliyetleri dahil değildir.</p></div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="card p-4 sm:p-5"><h2 className="mb-4 flex items-center gap-2 font-semibold"><ArrowDownRight className="h-4 w-4 text-rose-500" />Gider dağılımı</h2>{data.expenseCategories.length ? <div className="space-y-3">{data.expenseCategories.slice(0, 6).map((item) => <div key={item.category}><div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate text-neutral-600">{item.category}</span><span className="font-medium">{money(item.amount)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-rose-400" style={{ width: `${Math.max(3, item.amount / Math.max(1, data.cash.expenses) * 100)}%` }} /></div></div>)}</div> : <p className="py-5 text-sm text-neutral-500">Bu dönemde kayıtlı gider yok.</p>}</div>
        <div className="card p-4 sm:p-5"><h2 className="mb-4 flex items-center gap-2 font-semibold"><ShoppingBag className="h-4 w-4 text-blue-500" />En çok satılan ürünler</h2>{data.topProducts.length ? <div className="divide-y divide-neutral-100">{data.topProducts.map((item) => <div key={item.name} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.name}</p><p className="text-xs text-neutral-500">{item.quantity} adet</p></div><span className="shrink-0 text-sm font-semibold">{money(item.amount)}</span></div>)}</div> : <p className="py-5 text-sm text-neutral-500">Ürün satırı bulunamadı.</p>}</div>
        <div className="card p-4 sm:p-5"><h2 className="mb-4 flex items-center gap-2 font-semibold"><Truck className="h-4 w-4 text-amber-500" />Ödeme yöntemleri</h2>{data.paymentMethods.length ? <div className="space-y-3">{data.paymentMethods.map((item) => <div key={item.method} className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2.5"><span className="truncate text-sm text-neutral-700">{item.method}</span><span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-neutral-600">{item.count}</span></div>)}</div> : <p className="py-5 text-sm text-neutral-500">Sipariş bulunamadı.</p>}</div>
      </section>
      <p className="px-1 text-[11px] leading-relaxed text-neutral-500">Raporlama notu: Net satış, iptal olmayan siparişlerin ürün toplamıdır; ciro kargo dahil sipariş toplamıdır. Kayıtlı net sonuç, tahsil edilmiş siparişler, cari tahsilatlar ve manuel gelirlerden kayıtlı giderlerin çıkarılmasıdır. Ürün maliyeti, iadeler ve sipariş tahsilat tarihi ayrı izlenmediğinden bu değerler rapora dahil değildir.</p>
    </div>
  </>;
}