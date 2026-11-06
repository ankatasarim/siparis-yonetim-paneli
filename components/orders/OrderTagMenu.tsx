'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Tag } from 'lucide-react';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { ORDER_TAGS } from '@/lib/constants';
import type { OrderTag } from '@/lib/types';

const TAG_TEXT: Record<Exclude<OrderTag, ''>, string> = {
  acil: 'text-red-700',
  oncelikli: 'text-orange-700',
};

/** Sipariş listesinden veya detayından öncelik/işlem etiketi atama menüsü. */
export function OrderTagMenu({ id, orderNo, tag }: { id: number; orderNo: number; tag: OrderTag }) {
  const router = useRouter();
  const { toast, fail } = useToast();
  const button = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const selected = tag ? ORDER_TAGS[tag] : null;

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!button.current) return;
    const rect = button.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 5, left: Math.max(8, Math.min(rect.left, window.innerWidth - 224)) });
    setOpen((value) => !value);
  }

  async function changeTag(value: string) {
    setOpen(false);
    if (value === tag) return;
    setBusy(true);
    try {
      await api.put(`/api/orders/${id}`, { tag: value });
      toast(value ? `#${orderNo} · ${ORDER_TAGS[value as keyof typeof ORDER_TAGS].label} etiketi eklendi` : `#${orderNo} etiketi kaldırıldı`, 'ok');
      router.refresh();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex" onClick={(event) => event.stopPropagation()}>
      <button ref={button} type="button" aria-label={`Sipariş #${orderNo} etiketi`} aria-expanded={open} disabled={busy} onClick={toggle}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold shadow-sm transition hover:shadow ${selected ? selected.className : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'} disabled:opacity-60`}>
        {selected ? selected.label : 'Etiket ekle'}
        {selected ? <ChevronDown className="h-3 w-3" /> : <Tag className="h-3 w-3" />}
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed z-50 w-52 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg" style={{ top: pos.top, left: pos.left }} onClick={(event) => event.stopPropagation()}>
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">#{orderNo} · etiket seç</p>
            {Object.entries(ORDER_TAGS).map(([value, item]) => (
              <button key={value} type="button" disabled={busy} onClick={() => changeTag(value)} className={`flex w-full items-center gap-2 bg-white px-3 py-3 text-left text-sm font-medium transition hover:bg-neutral-50 disabled:opacity-60 ${TAG_TEXT[value as keyof typeof TAG_TEXT]} ${tag === value ? 'font-bold' : ''}`}>
                <span className="flex-1">{item.label}</span>
                {tag === value && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
              </button>
            ))}
            {tag && <>
              <div className="my-1 border-t border-neutral-100" />
              <button type="button" disabled={busy} onClick={() => changeTag('')} className="flex w-full items-center px-3 py-2 text-left text-xs text-neutral-500 hover:bg-neutral-50 disabled:opacity-60">Etiketi kaldır</button>
            </>}
          </div>
        </>,
        document.body
      )}
    </span>
  );
}
