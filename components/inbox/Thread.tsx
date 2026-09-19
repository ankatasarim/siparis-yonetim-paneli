'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Plus, User, Instagram, Paperclip } from 'lucide-react';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { Avatar, Alert } from '@/components/ui';
import { StatusPill } from '@/components/Pills';
import { fmtDate } from '@/lib/format';
import type { Thread as ThreadData, Message } from '@/lib/types';

function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((p, i) => (/^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noopener" className="underline">{p}</a> : <span key={i}>{p}</span>));
}

function Bubble({ m }: { m: Message }) {
  const out = m.direction === 'out';
  const failed = out && (m.status === 'failed' || m.status === 'pending');
  const st = out && m.status !== 'ok' ? ({ failed: '❌ gönderilemedi', pending: '⏳ elle gönderilmeli', manual_sent: '✅ elle gönderildi' } as Record<string, string>)[m.status] || m.status : '';
  return (
    <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${out ? (failed ? 'self-end border border-dashed border-red-300 bg-red-50 text-red-900' : 'self-end bg-primary text-white') : 'self-start border border-neutral-200 bg-white'}`}>
      <p className="whitespace-pre-wrap break-words">{linkify(m.text)}</p>
      {m.attachments?.map((a, i) => a.url ? <a key={i} href={a.url} target="_blank" rel="noopener" className="mt-1 flex items-center gap-1 text-xs underline"><Paperclip className="h-3 w-3" />{a.type}</a> : null)}
      <p className={`mt-1 text-[10px] ${out && !failed ? 'text-white/70' : 'text-neutral-500'}`}>{fmtDate(m.created_at)}{m.order_no ? ` · #${m.order_no}` : ''}{st ? ` · ${st}` : ''}{m.error ? ` · ${m.error}` : ''}</p>
    </div>
  );
}

export function Thread({ initial, igConfigured }: { initial: ThreadData; igConfigured: boolean }) {
  const router = useRouter();
  const { toast, fail } = useToast();
  const [t, setT] = useState(initial);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const c = t.customer;
  const name = c.name || (c.ig_username ? '@' + c.ig_username : 'Instagram kullanıcısı');

  const reload = async () => { try { setT(await api.get(`/api/conversations/${c.id}/messages`)); } catch { /* sessiz */ } };
  useEffect(() => { setT(initial); }, [initial]);
  useEffect(() => {
    if (t.messages.some((m) => m.direction === 'in' && !m.is_read)) api.post(`/api/conversations/${c.id}/read`).then(() => router.refresh()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, t.messages.length]);
  useEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight; }, [t.messages.length]);
  useEffect(() => { const i = setInterval(reload, 10000); return () => clearInterval(i); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id]);

  const send = async () => {
    const v = text.trim(); if (!v) return;
    setBusy(true);
    try { const r = await api.post(`/api/conversations/${c.id}/messages`, { text: v }); if (r.status !== 'ok') toast(r.error || 'Gönderilemedi', 'err'); setText(''); await reload(); }
    catch (e) { fail(e); }
    setBusy(false);
  };
  const lastIn = t.messages.filter((m) => m.direction === 'in').slice(-5).map((m) => m.text).join(' · ');

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-3">
        <Avatar name={name} src={c.profile_pic} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{name}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
            {c.ig_username && <span className="inline-flex items-center gap-1"><Instagram className="h-3 w-3 text-pink-600" />@{c.ig_username}</span>}
            <span>{c.phone || 'telefon yok'}</span>
            {t.active_orders.map((o) => <Link key={o.id} href={`/siparisler/${o.id}`} className="inline-flex items-center gap-1 hover:underline">#{o.order_no} <StatusPill status={o.status} /></Link>)}
          </p>
        </div>
        <Link href={`/musteriler/${c.id}`} className="btn btn-sm"><User className="h-3.5 w-3.5" />Müşteri kartı</Link>
        <Link href={`/siparisler/yeni?musteri=${c.id}&mesaj=${encodeURIComponent(lastIn.slice(0, 300))}`} className="btn btn-sm btn-primary"><Plus className="h-3.5 w-3.5" />Sipariş oluştur</Link>
      </div>
      <div ref={box} className="flex flex-1 flex-col gap-2 overflow-y-auto bg-neutral-50 p-4">
        {t.messages.length ? t.messages.map((m) => <Bubble key={m.id} m={m} />) : <p className="text-center text-sm text-neutral-500">Mesaj yok</p>}
      </div>
      {!c.ig_user_id && <div className="px-4 pt-3"><Alert kind="warn">Bu müşterinin Instagram bağlantısı yok; yazdığınız mesajlar yalnızca kaydedilir.</Alert></div>}
      {c.ig_user_id && !t.window_open && igConfigured && <div className="px-4 pt-3"><Alert kind="info">Müşterinin son mesajından 24 saat geçti; Instagram kuralı gereği gönderim reddedilebilir (HUMAN_AGENT etiketiyle denenir).</Alert></div>}
      <div className="flex items-end gap-2 border-t border-neutral-100 p-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Mesaj yazın… (Enter: gönder · Shift+Enter: yeni satır)" className="input min-h-[44px] max-h-40" rows={1} />
        <button disabled={busy || !text.trim()} onClick={send} className="btn btn-primary"><Send className="h-4 w-4" />Gönder</button>
      </div>
    </div>
  );
}
