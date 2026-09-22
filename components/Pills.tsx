import { Check, Clock, Truck, XCircle, Lock, Sparkles, Hourglass, HandCoins, Globe, Instagram, MessageCircle, ShoppingBag, type LucideIcon } from 'lucide-react';
import { STATUSES, PAYMENT_STATUSES, MESSAGE_STATUS_LABELS, ORDER_SOURCES } from '@/lib/constants';
import type { OrderSource, OrderStatus, PaymentStatus } from '@/lib/types';

const SOURCE_ICONS: Record<OrderSource, { icon: LucideIcon; color: string }> = {
  instagram: { icon: Instagram, color: 'text-pink-600' },
  whatsapp: { icon: MessageCircle, color: 'text-emerald-600' },
  shopier: { icon: ShoppingBag, color: 'text-blue-600' },
};

const STATUS_ICONS: Record<OrderStatus, LucideIcon> = { yeni: Sparkles, hazirlaniyor: Clock, kargoya_verildi: Truck, teslim_edildi: Check, kapandi: Lock, iptal: XCircle };
const PAY_ICONS: Record<PaymentStatus, LucideIcon> = { alindi: Check, bekleniyor: Hourglass, kapida_odeme: HandCoins };

const base = 'inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium';

export function StatusPill({ status, className = '' }: { status: OrderStatus; className?: string }) {
  const s = STATUSES[status];
  const Icon = STATUS_ICONS[status];
  return <span className={`${base} ${s.pill} ${className}`}><Icon className="h-3 w-3" />{s.label}</span>;
}

export function PaymentPill({ status, className = '' }: { status: PaymentStatus; className?: string }) {
  const s = PAYMENT_STATUSES[status];
  const Icon = PAY_ICONS[status];
  return <span className={`${base} ${s.pill} ${className}`}><Icon className="h-3 w-3" />{s.label}</span>;
}

export function MsgStatusPill({ status }: { status: string }) {
  const cls = { ok: 'border-emerald-300 text-emerald-700 bg-emerald-50', pending: 'border-amber-300 text-amber-700 bg-amber-50', failed: 'border-red-300 text-red-700 bg-red-50', manual_sent: 'border-indigo-300 text-indigo-700 bg-indigo-50' }[status] || 'border-neutral-300 text-neutral-600';
  return <span className={`${base} ${cls}`}>{MESSAGE_STATUS_LABELS[status] || status}</span>;
}

/** Sipariş kanalı: Instagram / WhatsApp / Shopier; tanımsız eski değerler olduğu gibi yazılır. */
export function SourcePill({ source, className = '' }: { source: string; className?: string }) {
  const meta = SOURCE_ICONS[source as OrderSource];
  const Icon = meta ? meta.icon : Globe;
  const label = ORDER_SOURCES[source as OrderSource]?.label || source || '—';
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-neutral-800 ${className}`}><Icon className={`h-4 w-4 ${meta ? meta.color : 'text-neutral-500'}`} />{label}</span>;
}
