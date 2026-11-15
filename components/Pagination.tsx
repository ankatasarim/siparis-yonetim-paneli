'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ total, page, pageSize, basePath, params = {}, label = 'Kayıt' }: { total: number; page: number; pageSize: number; basePath: string; params?: Record<string, string | undefined>; label?: string }) {
  const router = useRouter();
  const pageSizes = [10, 20, 50, 100, 200];
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const link = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set('sayfa', String(p)); else sp.delete('sayfa');
    return `${basePath}${sp.toString() ? '?' + sp.toString() : ''}`;
  };
  const changePageSize = (value: string) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set('adet', value);
    router.push(`${basePath}?${sp.toString()}`, { scroll: false });
  };
  const btn = 'btn btn-sm';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-neutral-600">
      <div className="flex items-center gap-1.5">
        <label className="flex items-center gap-1.5">
          Satır Adedi:
          <select aria-label="Satır adedi" value={pageSize} onChange={(e) => changePageSize(e.target.value)} className="rounded border border-neutral-200 bg-white px-2 py-0.5 text-sm text-neutral-700">
            {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <span>{from} - {to} / {total} {label}</span>
      </div>
      <div className="flex items-center gap-2">
        {page > 1 ? <Link href={link(page - 1)} className={btn}><ChevronLeft className="h-4 w-4" />Önceki</Link> : <span className={`${btn} opacity-50`}><ChevronLeft className="h-4 w-4" />Önceki</span>}
        {page < pages ? <Link href={link(page + 1)} className={btn}>Sonraki<ChevronRight className="h-4 w-4" /></Link> : <span className={`${btn} opacity-50`}>Sonraki<ChevronRight className="h-4 w-4" /></span>}
      </div>
    </div>
  );
}
