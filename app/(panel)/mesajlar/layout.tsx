import type { ReactNode } from 'react';
import Link from 'next/link';
import { ready, inbox, instagram } from '@/lib/services';
import { cfg } from '@/lib/config';
import { PageHeader } from '@/components/PageHeader';
import { ConversationList } from '@/components/inbox/ConversationList';
import { InboxShell } from '@/components/inbox/InboxShell';

export default async function InboxLayout({ children }: { children: ReactNode }) {
  await ready();
  const list = await inbox.conversations();
  const ok = await instagram.isConfigured();
  return (
    <>
      <PageHeader title="Gelen Kutusu" info="Instagram DM'leri burada toplanır; mesajdan tek tıkla sipariş oluşturabilirsiniz." subtitle={<span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />{ok ? 'Instagram bağlı' : <>Instagram bağlı değil · <Link href="/ayarlar" className="text-primary-text hover:underline">Ayarlar</Link></>}</span>} />
      <InboxShell list={<ConversationList initial={list} simulation={cfg.allowSimulation} />}>{children}</InboxShell>
    </>
  );
}
