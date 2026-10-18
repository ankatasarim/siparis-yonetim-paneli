'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ChevronDown, Check, Clock, Truck, XCircle } from 'lucide-react';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { StatusPill } from '@/components/Pills';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { STATUSES } from '@/lib/constants';
import type { OrderStatus, ShippingCompany } from '@/lib/types';

const ICONS: Partial<Record<OrderStatus, ReactNode>> = {
  hazirlaniyor: <Clock className="h-4 w-4 text-amber-600" />,
  kargoya_verildi: <Truck className="h-4 w-4 text-violet-600" />,
  teslim_edildi: <Check className="h-4 w-4 text-emerald-600" />,
  iptal: <XCircle className="h-4 w-4 text-red-600" />,
};

/** Listeden, detaya girmeden durum değiştirme menüsü. */
export function StatusMenu({ id, orderNo, status, shippingCompany, trackingNo }: { id: number; orderNo: number; status: OrderStatus; shippingCompany?: ShippingCompany | null; trackingNo?: string | null }) {
  const router = useRouter();
  const { toast, fail } = useToast();
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [busy, setBusy] = useState(false);
  const [askTracking, setAskTracking] = useState(false);
  const [tracking, setTracking] = useState('');
  const [company, setCompany] = useState<ShippingCompany>('dhl');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const next = STATUSES[status].next;

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!next.length || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 230) });
    setOpen((v) => !v);
  };

  const apply = async (s: OrderStatus, shipment?: { company: ShippingCompany; trackingNo: string }) => {
    setBusy(true);
    try {
      if (s === 'kargoya_verildi' && shipment) await api.post(`/api/orders/${id}/shipment`, { company: shipment.company, tracking_no: shipment.trackingNo });
      else await api.post(`/api/orders/${id}/status`, { status: s });
      toast(`#${orderNo} → ${STATUSES[s].label}`, 'ok');
      setAskTracking(false);
      setConfirmCancel(false);
      router.refresh();
    } catch (e) { fail(e); }
    setBusy(false);
  };

  const choose = (s: OrderStatus) => {
    setOpen(false);
    if (s === 'kargoya_verildi') { setCompany(shippingCompany || 'dhl'); setTracking(trackingNo || ''); setAskTracking(true); return; }
    if (s === 'iptal') { setConfirmCancel(true); return; }
    apply(s);
  };

  return (
    <>
      <button ref={btn} onClick={toggle} disabled={!next.length} title={next.length ? 'Durumu değiştir' : undefined}
        className={`group inline-flex items-center gap-1 rounded-md ${next.length ? 'cursor-pointer' : 'cursor-default'}`}>
        <StatusPill status={status} />
        {next.length > 0 && <ChevronDown className="h-3.5 w-3.5 text-neutral-400 group-hover:text-neutral-700" />}
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div className="fixed z-50 w-64 rounded-md border border-neutral-200 bg-white py-1 shadow-lg" style={{ top: pos.top, left: pos.left }} onClick={(e) => e.stopPropagation()}>
            <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">#{orderNo} · durumu değiştir</p>
            {next.map((s) => (
              <button key={s} onClick={() => choose(s)} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50 ${s === 'iptal' ? 'text-red-600' : 'text-neutral-800'}`}>
                {ICONS[s]}<span className="whitespace-nowrap">{STATUSES[s].label}</span>
                {s === 'kargoya_verildi' && <span className="ml-auto text-[10px] text-neutral-400">kargo şirketi seçilir</span>}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}

      <Modal open={askTracking} onClose={() => setAskTracking(false)} title={`#${orderNo} · Kargoya verildi`}
        footer={<><button className="btn" onClick={() => setAskTracking(false)} disabled={busy}>Vazgeç</button><button className="btn btn-primary" disabled={busy} onClick={() => apply('kargoya_verildi', { company, trackingNo: tracking.trim() })}><Truck className="h-4 w-4" />Kaydet</button></>}>
        <p className="mb-3 text-sm text-neutral-600">Kargo şirketini seçin. Takip numarası girmek isteğe bağlıdır.</p>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Kargo şirketi
            <select autoFocus value={company} onChange={(e) => setCompany(e.target.value as ShippingCompany)} className="input mt-1">
              <option value="dhl">DHL</option><option value="hepsijet">Hepsijet</option>
            </select>
          </label>
          <label className="block text-sm font-medium">Takip numarası <span className="font-normal text-neutral-500">(isteğe bağlı)</span>
            <input value={tracking} onChange={(e) => setTracking(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') apply('kargoya_verildi', { company, trackingNo: tracking.trim() }); }} placeholder="Takip numarası" className="input mt-1 font-mono" />
          </label>
        </div>
      </Modal>

      <ConfirmDialog open={confirmCancel} text={`#${orderNo} numaralı sipariş iptal edilsin mi?`} okLabel="İptal et" danger busy={busy} onCancel={() => setConfirmCancel(false)} onConfirm={() => apply('iptal')} />
    </>
  );
}
