'use client';
import { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Filter } from 'lucide-react';
import { SearchBox } from '@/components/SearchBox';
import { STATUSES, PAYMENT_STATUSES, ALL_STATUSES } from '@/lib/constants';
import type { OrderStatus, PaymentStatus } from '@/lib/types';

function Inner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const durum = sp.get('durum') || '';
  const odeme = sp.get('odeme') || '';
  const go = (patch: Record<string, string>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, v); else p.delete(k); }
    p.delete('sayfa');
    router.replace(`${pathname}${p.toString() ? '?' + p.toString() : ''}`);
  };
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Tabloda arama yapın" className="w-full max-w-xs" />
        <div className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <select value={odeme} onChange={(e) => go({ odeme: e.target.value })} className="input w-auto appearance-none pl-9 pr-8">
            <option value="">Ödeme: Tümü</option>
            {(Object.keys(PAYMENT_STATUSES) as PaymentStatus[]).map((k) => <option key={k} value={k}>{PAYMENT_STATUSES[k].label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => go({ durum: '' })} className={`chip ${!durum ? 'chip-active' : ''}`}>Tümü</button>
        {ALL_STATUSES.map((s: OrderStatus) => (
          <button key={s} onClick={() => go({ durum: s })} className={`chip ${durum === s ? 'chip-active' : ''}`}>{STATUSES[s].label}</button>
        ))}
      </div>
    </div>
  );
}

export function OrdersToolbar() {
  return <Suspense><Inner /></Suspense>;
}
