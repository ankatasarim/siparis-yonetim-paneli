'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Truck, Check, XCircle, Lock, Clock, Smile, Frown, Send, MoreHorizontal, Pencil, Trash2, MessageSquare, ArrowRight, Package, CreditCard, Plus, Bell } from 'lucide-react';
import { api, copyText } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { Field } from '@/components/ui';
import { MsgStatusPill, PaymentPill } from '@/components/Pills';
import { STATUSES, SHIPPING_PAYERS, SATISFACTION_LABELS, PAYMENT_STATUSES, PAYMENT_METHODS, ACCOUNT_PAYMENT_METHOD, MESSAGE_KIND_LABELS } from '@/lib/constants';
import { fmtDate, money } from '@/lib/format';
import type { Message, OrderEvent, OrderStatus, PaymentStatus, Satisfaction, ShippingPayer } from '@/lib/types';

function useAction() {
  const router = useRouter();
  const { toast, fail } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, okMsg?: string) => {
    setBusy(true);
    try { await fn(); if (okMsg) toast(okMsg, 'ok'); router.refresh(); return true; }
    catch (e) { fail(e); return false; }
    finally { setBusy(false); }
  };
  return { run, busy, toast, fail, router };
}

/* ---------------- Kargo ---------------- */
export function ShipmentCard({ order }: {
  order: { id: number; status: OrderStatus; desi: number | null; package_count: number; shipping_payer: ShippingPayer; shipping_fee: number };
}) {
  const { run, busy, toast } = useAction();
  const [desi, setDesi] = useState(order.desi != null ? String(order.desi) : '');
  const [pkg, setPkg] = useState(String(order.package_count || 1));
  const [payer, setPayer] = useState<ShippingPayer>(order.shipping_payer || 'gonderici');
  const [fee, setFee] = useState(String(order.shipping_fee || 0));
  const [dims, setDims] = useState({ w: '', l: '', h: '' });
  const closed = order.status === 'teslim_edildi' || order.status === 'iptal';
  const fields = () => ({ desi, package_count: pkg, shipping_payer: payer, shipping_fee: fee });

  const calc = () => {
    const v = [dims.w, dims.l, dims.h].map(Number);
    if (v.every((x) => x > 0)) setDesi(String(Math.max(1, Math.round((v[0] * v[1] * v[2]) / 3000 * 100) / 100)));
    else toast('En, boy ve yükseklik girin', 'err');
  };

  return (
    <div className="space-y-3">
      <Field label="Desi"><input disabled={closed} value={desi} onChange={(e) => setDesi(e.target.value)} inputMode="decimal" className="input" /></Field>
      {!closed && <Field label="Desi hesapla (cm)">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5">
          <input placeholder="En" value={dims.w} onChange={(e) => setDims({ ...dims, w: e.target.value })} inputMode="decimal" className="input min-w-0 px-2" />
          <input placeholder="Boy" value={dims.l} onChange={(e) => setDims({ ...dims, l: e.target.value })} inputMode="decimal" className="input min-w-0 px-2" />
          <input placeholder="Yük." value={dims.h} onChange={(e) => setDims({ ...dims, h: e.target.value })} inputMode="decimal" className="input min-w-0 px-2" />
          <button onClick={calc} className="btn btn-sm">=</button>
        </div>
      </Field>}
      <Field label="Parça"><input disabled={closed} type="number" min={1} value={pkg} onChange={(e) => setPkg(e.target.value)} className="input" /></Field>
      <Field label="Kargo ücreti (₺)"><input disabled={closed} value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" className="input" /></Field>
      <Field label="Kargo ödemesi">
        <select disabled={closed} value={payer} onChange={(e) => setPayer(e.target.value as ShippingPayer)} className="input">
          {(Object.keys(SHIPPING_PAYERS) as ShippingPayer[]).map((k) => <option key={k} value={k}>{SHIPPING_PAYERS[k]}</option>)}
        </select>
      </Field>
      {!closed && <button disabled={busy} onClick={() => run(() => api.put(`/api/orders/${order.id}`, fields()), 'Kargo bilgileri kaydedildi')} className="btn btn-sm w-full">Kargo bilgilerini kaydet</button>}
    </div>
  );
}

/* ---------------- Durum işlemleri ---------------- */
export function StatusActions({ id, status, next }: { id: number; status: OrderStatus; next: OrderStatus[] }) {
  const { run, busy } = useAction();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const labels: Partial<Record<OrderStatus, { label: string; icon: ReactNode; cls: string }>> = {
    hazirlaniyor: { label: 'Hazırlığa al', icon: <Clock className="h-3.5 w-3.5" />, cls: 'btn-primary' },
    hazirlandi: { label: 'Hazırlandı', icon: <Check className="h-3.5 w-3.5" />, cls: 'btn-primary' },
    kargoya_verildi: { label: 'Kargoya verildi', icon: <Truck className="h-3.5 w-3.5" />, cls: 'btn-primary' },
    teslim_edildi: { label: 'Teslim edildi', icon: <Check className="h-3.5 w-3.5" />, cls: 'btn-primary' },
    iptal: { label: 'İptal et', icon: <XCircle className="h-3.5 w-3.5" />, cls: 'btn-danger' },
  };
  const items = next;
  if (!items.length) return <p className="text-sm text-neutral-500">Bu sipariş {STATUSES[status].label.toLowerCase()} durumunda; başka işlem yok.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => {
        const l = labels[s]!;
        return <button key={s} disabled={busy} onClick={() => (s === 'iptal' ? setConfirmCancel(true) : run(() => api.post(`/api/orders/${id}/status`, { status: s }), 'Durum güncellendi'))} className={`btn btn-sm ${l.cls}`}>{l.icon}{l.label}</button>;
      })}
      {(status === 'hazirlaniyor' || status === 'hazirlandi') && <p className="w-full text-xs text-neutral-500">Kargoya verme işlemini buradan kaydedebilirsiniz.</p>}
      <ConfirmDialog open={confirmCancel} text="Sipariş iptal edilsin mi? Bu işlem geri alınamaz." okLabel="İptal et" danger busy={busy} onCancel={() => setConfirmCancel(false)} onConfirm={async () => { const ok = await run(() => api.post(`/api/orders/${id}/status`, { status: 'iptal' }), 'Sipariş iptal edildi'); if (ok) setConfirmCancel(false); }} />
    </div>
  );
}

/* ---------------- Ödeme ---------------- */
export function PaymentCard({ id, payment_status, payment_method, total, closed }: { id: number; payment_status: PaymentStatus; payment_method: string; total: number; closed: boolean }) {
  const { run, busy } = useAction();
  const isAccountOrder = payment_method === ACCOUNT_PAYMENT_METHOD;
  const [edit, setEdit] = useState(false);
  const [st, setSt] = useState<PaymentStatus>(payment_status);
  const [method, setMethod] = useState(payment_method || '');
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><PaymentPill status={payment_status} method={payment_method} /><span className="text-lg font-semibold">{money(total)}</span></div>
      <p className="text-sm text-neutral-600">{payment_method || <span className="text-neutral-400">Ödeme yöntemi girilmedi</span>}</p>
      {isAccountOrder && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">Bu tutar müşterinin cari bakiyesine borç işlendi. Tahsilat durumunu ve tutarını <Link href="/cariler" className="font-medium underline">Cari Hesaplar</Link> ekranından kaydedin.</p>}
      {!closed && !edit && !isAccountOrder && (
        <div className="flex flex-wrap gap-2">
          {payment_status !== 'alindi' && <button disabled={busy} onClick={() => run(() => api.post(`/api/orders/${id}/payment`, { payment_status: 'alindi', payment_method: payment_method || 'Havale / EFT' }), 'Ödeme alındı olarak işaretlendi')} className="btn btn-sm btn-primary"><Check className="h-3.5 w-3.5" />Ödeme alındı</button>}
          <button onClick={() => setEdit(true)} className="btn btn-sm"><Pencil className="h-3.5 w-3.5" />Düzenle</button>
        </div>
      )}
      {edit && (
        <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <Field label="Ödeme durumu"><select value={st} onChange={(e) => setSt(e.target.value as PaymentStatus)} className="input">{(Object.keys(PAYMENT_STATUSES) as PaymentStatus[]).map((k) => <option key={k} value={k}>{PAYMENT_STATUSES[k].label}</option>)}</select></Field>
          <Field label="Ödeme yöntemi"><input list="pay-methods" value={method} onChange={(e) => { setMethod(e.target.value); if (e.target.value === ACCOUNT_PAYMENT_METHOD) setSt('bekleniyor'); }} className="input" placeholder="Havale / EFT" /><datalist id="pay-methods">{PAYMENT_METHODS.map((m) => <option key={m} value={m} />)}<option value={ACCOUNT_PAYMENT_METHOD} /></datalist></Field>
          <div className="flex gap-2"><button onClick={() => setEdit(false)} className="btn btn-sm">Vazgeç</button><button disabled={busy} onClick={async () => { const ok = await run(() => api.post(`/api/orders/${id}/payment`, { payment_status: st, payment_method: method }), 'Ödeme güncellendi'); if (ok) setEdit(false); }} className="btn btn-sm btn-primary">Kaydet</button></div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Memnuniyet ---------------- */
export function SatisfactionCard({ id, status, satisfaction, note, askedAt, preview, customerName, igLinked, igConfigured }: { id: number; status: OrderStatus; satisfaction: Satisfaction | null; note: string | null; askedAt: string | null; preview: string; customerName: string; igLinked: boolean; igConfigured: boolean }) {
  const { run, busy } = useAction();
  const [send, setSend] = useState(false);
  return (
    <div className="space-y-3">
      {satisfaction ? (
        <dl className="kv">
          <dt>Durum</dt><dd className="font-medium">{SATISFACTION_LABELS[satisfaction]}</dd>
          {note && <><dt>Cevap</dt><dd className="italic text-neutral-700">“{note}”</dd></>}
          {askedAt && <><dt>Soruldu</dt><dd>{fmtDate(askedAt)}</dd></>}
        </dl>
      ) : (
        <p className="text-sm text-neutral-600">Memnuniyet sorusu henüz gönderilmedi. Uygun gördüğünüzde gönderin; müşterinin cevabı otomatik olarak buraya işlenir.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {status === 'teslim_edildi' && !satisfaction && <button onClick={() => setSend(true)} className="btn btn-sm btn-primary"><Send className="h-3.5 w-3.5" />Memnuniyet sorusunu gönder</button>}
        {status === 'teslim_edildi' && (
          <>
            <button disabled={busy} onClick={() => run(() => api.post(`/api/orders/${id}/satisfaction`, { verdict: 'memnun' }), 'Sipariş memnun olarak kapatıldı')} className={`btn btn-sm ${satisfaction ? 'btn-primary' : ''}`}><Smile className="h-3.5 w-3.5" />Memnun · kapat</button>
            <button disabled={busy} onClick={() => run(() => api.post(`/api/orders/${id}/satisfaction`, { verdict: 'memnun_degil' }), 'Kaydedildi')} className="btn btn-sm btn-danger"><Frown className="h-3.5 w-3.5" />Memnun değil</button>
          </>
        )}
      </div>
      {send && <SendModal id={id} kind="memnuniyet" initialText={preview} customerName={customerName} igLinked={igLinked} igConfigured={igConfigured} onClose={() => setSend(false)} />}
    </div>
  );
}

/* ---------------- Mesaj gönderme penceresi ---------------- */
const SEND_TITLES: Record<string, string> = { kargo_bildirimi: 'Kargo bildirimi gönder', memnuniyet: 'Memnuniyet sorusu gönder', siparis_alindi: 'Sipariş alındı mesajı gönder', manual: 'Özel mesaj gönder' };

export function SendModal({ id, kind, initialText, customerName, igLinked, igConfigured, onClose }: { id: number; kind: string; initialText: string; customerName: string; igLinked: boolean; igConfigured: boolean; onClose: () => void }) {
  const { run, busy, toast } = useAction();
  const [text, setText] = useState(initialText);
  return (
    <Modal open onClose={onClose} title={SEND_TITLES[kind] || 'Mesaj gönder'}
      footer={<>
        <button onClick={async () => { if (await copyText(text)) toast('Kopyalandı', 'ok'); }} className="btn mr-auto"><Copy className="h-4 w-4" />Kopyala</button>
        <button onClick={onClose} className="btn">Vazgeç</button>
        <button disabled={busy || !text.trim()} onClick={async () => { const ok = await run(async () => { const r = await api.post(`/api/orders/${id}/notify`, { kind, text }); const s = r.message.status; if (s === 'ok') toast('Mesaj gönderildi', 'ok'); else if (s === 'pending') toast('Kaydedildi · Instagram bağlantısı yok, mesajı elle gönderin', 'info'); else throw new Error('Gönderilemedi: ' + r.message.error); }); if (ok) onClose(); }} className="btn btn-primary"><Send className="h-4 w-4" />Gönder</button>
      </>}>
      <p className="mb-2 text-xs text-neutral-500">Alıcı: <b>{customerName}</b>{igLinked && igConfigured ? ' · Instagram üzerinden gönderilecek' : <span className="text-red-600"> · Instagram bağlantısı yok; mesaj kaydedilir, siz elle gönderirsiniz</span>}</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} className="input min-h-[170px]" />
      <p className="mt-1 text-xs text-neutral-500">Yer tutucular: {'{{ad}}'}, {'{{siparis_no}}'}, {'{{takip_no}}'}, {'{{takip_link}}'}, {'{{urunler}}'}, {'{{tutar}}'}, {'{{isletme}}'}</p>
    </Modal>
  );
}

/* ---------------- Bildirimler ---------------- */
export function NotificationsCard({ id, messages, previews, igLinked, igConfigured, customerName }: { id: number; messages: Message[]; previews: Record<string, string>; igLinked: boolean; igConfigured: boolean; customerName: string }) {
  const { run, busy, toast } = useAction();
  const [kind, setKind] = useState<string | null>(null);
  const out = messages.filter((m) => m.direction === 'out');
  return (
    <div className="space-y-3">
      {out.length ? (
        <ul className="divide-y divide-neutral-100">
          {out.map((m) => (
            <li key={m.id} className="py-2.5">
              <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium">{MESSAGE_KIND_LABELS[m.kind || ''] || 'Mesaj'}</span><MsgStatusPill status={m.status} /></div>
              <p className="mt-0.5 text-xs text-neutral-500">{fmtDate(m.created_at)}{m.error ? ` · ${m.error}` : ''}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <button onClick={async () => { if (await copyText(m.text)) toast('Kopyalandı', 'ok'); }} className="btn btn-xs"><Copy className="h-3 w-3" />Kopyala</button>
                {(m.status === 'failed' || m.status === 'pending') && <>
                  <button disabled={busy} onClick={() => run(async () => { const r = await api.post(`/api/outbox/${m.id}/retry`); if (r.status !== 'ok') throw new Error(r.error || 'Gönderilemedi'); }, 'Mesaj gönderildi')} className="btn btn-xs">Tekrar dene</button>
                  <button disabled={busy} onClick={() => run(() => api.post(`/api/outbox/${m.id}/mark-sent`), 'İşaretlendi')} className="btn btn-xs">Elle gönderdim</button>
                </>}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-neutral-500">Henüz bildirim gönderilmedi.</p>}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setKind('kargo_bildirimi')} className="btn btn-xs"><Package className="h-3 w-3" />Kargo bildirimi</button>
        <button onClick={() => setKind('memnuniyet')} className="btn btn-xs"><Smile className="h-3 w-3" />Memnuniyet sorusu</button>
        <button onClick={() => setKind('siparis_alindi')} className="btn btn-xs"><Bell className="h-3 w-3" />Sipariş alındı</button>
        <button onClick={() => setKind('manual')} className="btn btn-xs"><Send className="h-3 w-3" />Özel mesaj</button>
      </div>
      {kind && <SendModal key={kind} id={id} kind={kind} initialText={kind === 'manual' ? '' : previews[kind] || ''} customerName={customerName} igLinked={igLinked} igConfigured={igConfigured} onClose={() => setKind(null)} />}
    </div>
  );
}

/* ---------------- Zaman çizelgesi ---------------- */
const EVENT_ICONS: Record<string, ReactNode> = {
  yorum: <MessageSquare className="h-3.5 w-3.5" />, durum: <ArrowRight className="h-3.5 w-3.5" />, kargo: <Truck className="h-3.5 w-3.5" />, kargo_durum: <Truck className="h-3.5 w-3.5" />,
  mesaj: <Send className="h-3.5 w-3.5" />, memnuniyet: <Smile className="h-3.5 w-3.5" />, odeme: <CreditCard className="h-3.5 w-3.5" />, olusturuldu: <Plus className="h-3.5 w-3.5" />,
};

export function Timeline({ id, events, author }: { id: number; events: OrderEvent[]; author: string }) {
  const { run, busy } = useAction();
  const [text, setText] = useState('');
  const submit = async () => { if (!text.trim()) return; const ok = await run(() => api.post(`/api/orders/${id}/comments`, { text }), 'Yorum eklendi'); if (ok) setText(''); };
  const list = [...events].reverse();
  return (
    <div>
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">{(author || 'A').charAt(0).toUpperCase()}</div>
        <div className="flex-1">
          <p className="text-sm font-medium">Yorum ekle</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} className="input mt-1 min-h-20" placeholder="Siparişle ilgili not..." />
          <button disabled={busy || !text.trim()} onClick={submit} className="btn btn-sm mt-2">Yorumu kaydet</button>
        </div>
      </div>
      <ol className="space-y-3 border-l border-neutral-200 pl-4">
        {list.map((event) => (
          <li key={event.id} className="relative text-sm">
            <span className="absolute -left-[21px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-white text-neutral-500">{EVENT_ICONS[event.type] || <Clock className="h-3 w-3" />}</span>
            <p className="text-neutral-800">{event.description}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{fmtDate(event.created_at)}</p>
          </li>
        ))}
        {!list.length && <li className="text-sm text-neutral-500">Henüz kayıt yok.</li>}
      </ol>
    </div>
  );
}

/* ---------------- Diğer işlemler menüsü ---------------- */
export function OrderActionsMenu({ id, orderNo }: { id: number; orderNo: number }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { run, busy, router } = useAction();
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-700 hover:bg-neutral-800" aria-label="Diğer işlemler"><MoreHorizontal className="h-4 w-4" /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-neutral-200 bg-white py-1 text-sm text-neutral-800 shadow-lg">
            <Link href={`/siparisler/${id}/duzenle`} className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-50"><Pencil className="h-4 w-4" />Düzenle</Link>
            <button onClick={() => { setOpen(false); setConfirm(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" />Siparişi sil</button>
          </div>
        </>
      )}
      <ConfirmDialog open={confirm} text={`#${orderNo} numaralı sipariş kalıcı olarak silinsin mi?`} okLabel="Sil" danger busy={busy} onCancel={() => setConfirm(false)} onConfirm={async () => { const ok = await run(() => api.del(`/api/orders/${id}`), 'Sipariş silindi'); if (ok) router.push('/siparisler'); }} />
    </div>
  );
}
