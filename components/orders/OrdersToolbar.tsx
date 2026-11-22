'use client';
import { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, Filter } from 'lucide-react';
import { SearchBox } from '@/components/SearchBox';
import { STATUSES, PAYMENT_STATUSES, ALL_STATUSES, ORDER_SOURCES, SHIPPING_PAYERS, ORDER_TAGS } from '@/lib/constants';
import type { OrderStatus, PaymentStatus } from '@/lib/types';

function Inner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const durum = sp.get('durum') || '';
  const odeme = sp.get('odeme') || '';
  const kanal = sp.get('kanal') || '';
  const kargo = sp.get('kargo') || '';
  const etiket = sp.get('etiket') || '';
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
          <select aria-label="Ödeme durumuna göre filtrele" value={odeme} onChange={(e) => go({ odeme: e.target.value })} className="input w-auto appearance-none pl-9 pr-10">
            <option value="">Ödeme: Tümü</option>
            {(Object.keys(PAYMENT_STATUSES) as PaymentStatus[]).map((k) => <option key={k} value={k}>{PAYMENT_STATUSES[k].label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        </div>
        <div className="relative">
          <select aria-label="Satış kanalına göre filtrele" value={kanal} onChange={(e) => go({ kanal: e.target.value })} className="input w-auto appearance-none pr-10">
            <option value="">Kanal: Tümü</option>
            {Object.entries(ORDER_SOURCES).map(([key, source]) => <option key={key} value={key}>{source.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        </div>
        <div className="relative">
          <select aria-label="Kargo ödeyenine göre filtrele" value={kargo} onChange={(e) => go({ kargo: e.target.value })} className="input w-auto appearance-none pr-10">
            <option value="">Kargo ödemesi: Tümü</option>
            {Object.entries(SHIPPING_PAYERS).map(([key, payer]) => <option key={key} value={key}>{payer.startsWith('Gönderici') ? 'Gönderici öder' : 'Alıcı öder'}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        </div>
        <div className="relative">
          <select aria-label="Etikete göre filtrele" value={etiket} onChange={(e) => go({ etiket: e.target.value })} className="input w-auto appearance-none pr-10">
            <option value="">Etiket: Tümü</option>
            {Object.entries(ORDER_TAGS).map(([key, tag]) => <option key={key} value={key}>{tag.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        </div>
        <div className="relative">
          <select aria-label="Tarihe göre filtrele" value={sp.get('tarih') || ''} onChange={(e) => go({ tarih: e.target.value, baslangic: '', bitis: '' })} className="input w-auto appearance-none pr-10">
            <option value="">Tarih: Tümü</option>
            <option value="bugun">Bugün</option>
            <option value="hafta">Son 1 hafta</option>
            <option value="ay">Son 1 ay</option>
            <option value="ozel">Özel tarih</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        </div>
        {sp.get('tarih') === 'ozel' && <>
          <input aria-label="Başlangıç tarihi" type="date" value={sp.get('baslangic') || ''} onChange={(e) => go({ baslangic: e.target.value })} className="input w-auto" />
          <input aria-label="Bitiş tarihi" type="date" value={sp.get('bitis') || ''} onChange={(e) => go({ bitis: e.target.value })} className="input w-auto" />
        </>}
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
