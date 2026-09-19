'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Avatar } from '@/components/ui';
import { fmtShort, trunc } from '@/lib/format';
import type { Conversation } from '@/lib/types';

export function ConversationList({ initial, simulation }: { initial: Conversation[]; simulation: boolean }) {
  const pathname = usePathname();
  const [items, setItems] = useState(initial);
  useEffect(() => { setItems(initial); }, [initial]);
  useEffect(() => {
    const t = setInterval(async () => { try { setItems(await api.get('/api/conversations')); } catch { /* sessiz */ } }, 15000);
    return () => clearInterval(t);
  }, []);
  if (!items.length) return <p className="p-5 text-sm text-neutral-500">Henüz mesaj yok.{simulation && <> Ayarlar › <b>Test aracı</b> ile deneme mesajı üretebilirsiniz.</>}</p>;
  return (
    <ul className="divide-y divide-neutral-100">
      {items.map((c) => {
        const active = pathname === `/mesajlar/${c.id}`;
        const name = c.name || (c.ig_username ? '@' + c.ig_username : 'Instagram kullanıcısı');
        return (
          <li key={c.id}>
            <Link href={`/mesajlar/${c.id}`} className={`flex gap-3 px-4 py-3 transition hover:bg-neutral-50 ${active ? 'bg-primary-soft/60' : ''}`}>
              <Avatar name={name} src={c.profile_pic} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><span className={`truncate text-sm ${c.unread ? 'font-semibold' : 'font-medium'}`}>{name}</span><time className="shrink-0 text-[11px] text-neutral-500">{fmtShort(c.last_at)}</time></div>
                <p className={`truncate text-xs ${c.unread ? 'font-medium text-neutral-800' : 'text-neutral-500'}`}>{c.last_direction === 'out' ? 'Siz: ' : ''}{trunc(c.last_text, 60)}</p>
              </div>
              {c.unread > 0 && <span className="self-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">{c.unread}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
