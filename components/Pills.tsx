import { Check, Clock, Truck, XCircle, Lock, Sparkles, Hourglass, HandCoins, Globe, Instagram, type LucideIcon } from 'lucide-react';
import { STATUSES, PAYMENT_STATUSES, MESSAGE_STATUS_LABELS } from '@/lib/constants';
import type { OrderStatus, PaymentStatus } from '@/lib/types';

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

export function SourcePill({ source, website }: { source: string; website?: string }) {
  if (source === 'instagram') return <span className="inline-flex items-center gap-1.5 text-sm text-neutral-800"><Instagram className="h-4 w-4 text-pink-600" />Instagram</span>;
  return <span className="inline-flex items-center gap-1.5 text-sm text-neutral-800"><Globe className="h-4 w-4 text-neutral-500" />{website || source}</span>;
}
