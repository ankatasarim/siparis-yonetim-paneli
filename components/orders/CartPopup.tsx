'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, ExternalLink } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { money } from '@/lib/format';
import { startNav } from '@/lib/client';
import { SHIPPING_PAYERS } from '@/lib/constants';
import type { Order } from '@/lib/types';

type CartOrder = Pick<Order, 'id' | 'order_no' | 'lines' | 'subtotal' | 'shipping_fee' | 'total' | 'shipping_payer' | 'labels'>;

/**
 * Sipariş listesinde tutara tıklayınca açılan sepet penceresi. Düğme olduğu için satır bağlantısı (RowLink) tıklamayı yok sayar;
 * pencere portal ile açıldığından içindeki tıklamalar satıra sızmaz.
 */
export function CartPopup({ order, compact = false }: { order: CartOrder; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const count = order.lines.reduce((s, l) => s + l.qty, 0);
  return (
    <>
      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }} title="Sepet detayını göster"
        className={`group -mx-1.5 rounded-md px-1.5 py-0.5 text-left hover:bg-primary/5 ${compact ? 'font-semibold' : ''}`}>
        <div className="font-medium">{money(order.total)}</div>
        {!compact && <div className="text-xs text-primary-text group-hover:underline">{count} ürün</div>}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={<span className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-neutral-500" />Sipariş #{order.order_no} · Sepet</span>}
        footer={<><button className="btn" onClick={() => setOpen(false)}>Kapat</button><Link href={`/siparisler/${order.id}`} onClick={() => startNav()} className="btn btn-primary"><ExternalLink className="h-3.5 w-3.5" />Siparişe git</Link></>}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Ürün</th><th className="th w-14 text-right">Adet</th><th className="th w-24 text-right">Fiyat</th><th className="th w-24 text-right">Toplam</th></tr></thead>
            <tbody>
              {order.lines.map((l, i) => (
                <tr key={i}>
                  <td className="td"><span className="font-medium">{l.name}</span>{l.variant && <span className="ml-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-xs text-neutral-700">{l.variant}</span>}</td>
                  <td className="td text-right">{l.qty}</td>
                  <td className="td text-right">{l.price != null ? money(l.price) : <span className="text-neutral-400">—</span>}</td>
                  <td className="td text-right font-medium">{l.price != null ? money(l.qty * l.price) : <span className="text-neutral-400">—</span>}</td>
                </tr>
              ))}
              {!order.lines.length && <tr><td colSpan={4} className="td text-neutral-400">Ürün satırı yok</td></tr>}
            </tbody>
          </table>
        </div>
        <dl className="mt-3 space-y-1.5 border-t border-neutral-100 pt-3 text-sm">
          <div className="flex justify-between text-neutral-600"><dt>Ara toplam ({count} ürün)</dt><dd>{money(order.subtotal)}</dd></div>
          <div className="flex justify-between text-neutral-600"><dt>Kargo · {SHIPPING_PAYERS[order.shipping_payer]}</dt><dd>{money(order.shipping_fee)}</dd></div>
          <div className="flex justify-between border-t border-neutral-100 pt-2 text-base font-semibold"><dt>Toplam</dt><dd>{money(order.total)}</dd></div>
        </dl>
        {order.labels && <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm"><span className="font-medium">🏷 Etiket notu:</span> {order.labels}</div>}
      </Modal>
    </>
  );
}
