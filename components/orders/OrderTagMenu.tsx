'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Tag } from 'lucide-react';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { ORDER_TAGS } from '@/lib/constants';
import type { OrderTag } from '@/lib/types';

/** Sipariş listesinden veya detayından öncelik/işlem etiketi atama menüsü. */
export function OrderTagMenu({ id, orderNo, tag }: { id: number; orderNo: number; tag: OrderTag }) {
  const router = useRouter();
  const { fail } = useToast();
  const [busy, setBusy] = useState(false);
  const selected = tag ? ORDER_TAGS[tag] : null;

  async function changeTag(value: string) {
    setBusy(true);
    try {
      await api.put(`/api/orders/${id}`, { tag: value });
      router.refresh();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="relative inline-flex" onClick={(event) => event.stopPropagation()}>
      <span className="sr-only">Sipariş #{orderNo} etiketi</span>
      <select
        aria-label={`Sipariş #${orderNo} etiketi`}
        value={tag}
        disabled={busy}
        onChange={(event) => changeTag(event.target.value)}
        className={`max-w-[130px] cursor-pointer appearance-none rounded-full border py-1 pl-2 pr-6 text-[11px] font-semibold outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60 ${selected?.className || 'border-neutral-200 bg-white text-neutral-500'}`}
        title={selected ? `${selected.label} etiketi` : 'Etiket ekle'}
      >
        <option value="">Etiket ekle</option>
        {Object.entries(ORDER_TAGS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
      </select>
      {selected ? <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2" /> : <Tag aria-hidden="true" className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2" />}
    </label>
  );
}
