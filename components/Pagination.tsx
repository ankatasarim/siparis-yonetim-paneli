import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ total, page, pageSize, basePath, params = {}, label = 'Kayıt' }: { total: number; page: number; pageSize: number; basePath: string; params?: Record<string, string | undefined>; label?: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const link = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set('sayfa', String(p)); else sp.delete('sayfa');
    return `${basePath}${sp.toString() ? '?' + sp.toString() : ''}`;
  };
  const btn = 'btn btn-sm';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-neutral-600">
      <div>Satır Adedi: <span className="mx-1 rounded border border-neutral-200 px-2 py-0.5">{pageSize}</span> {from} - {to} / {total} {label}</div>
      <div className="flex items-center gap-2">
        {page > 1 ? <Link href={link(page - 1)} className={btn}><ChevronLeft className="h-4 w-4" />Önceki</Link> : <span className={`${btn} opacity-50`}><ChevronLeft className="h-4 w-4" />Önceki</span>}
        {page < pages ? <Link href={link(page + 1)} className={btn}>Sonraki<ChevronRight className="h-4 w-4" /></Link> : <span className={`${btn} opacity-50`}>Sonraki<ChevronRight className="h-4 w-4" /></span>}
      </div>
    </div>
  );
}
