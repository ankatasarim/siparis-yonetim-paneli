import type { ReactNode } from 'react';
import Link from 'next/link';
import { ready, inbox, instagram, db } from '@/lib/services';
import { cfg } from '@/lib/config';
import { PageHeader } from '@/components/PageHeader';
import { ConversationList } from '@/components/inbox/ConversationList';
import { InboxShell } from '@/components/inbox/InboxShell';
import { SyncButton } from '@/components/inbox/SyncButton';
import { fmtDate } from '@/lib/format';

export default async function InboxLayout({ children }: { children: ReactNode }) {
  await ready();
  const list = await inbox.conversations();
  const ok = await instagram.isConfigured();
  const lastSync = await db.getSetting('ig_last_sync_at');
  return (
    <>
      <PageHeader
        title="Gelen Kutusu"
        info="Instagram sohbetleri 'Instagram'dan çek' düğmesiyle alınır; mesajdan tek tıkla sipariş oluşturabilirsiniz."
        subtitle={<span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1"><span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />{ok ? 'Instagram bağlı' : <>Instagram bağlı değil · <Link href="/ayarlar" className="text-primary-text hover:underline">Ayarlar</Link></>}</span>{lastSync && <span className="text-neutral-400">· son çekim {fmtDate(lastSync)}</span>}</span>}
        actions={<SyncButton enabled={ok} />}
      />
      <InboxShell list={<ConversationList initial={list} simulation={cfg.allowSimulation} />}>{children}</InboxShell>
    </>
  );
}
