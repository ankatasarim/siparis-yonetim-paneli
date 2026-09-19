import { notFound } from 'next/navigation';
import { ready, inbox, instagram, customers } from '@/lib/services';
import { Thread } from '@/components/inbox/Thread';

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ready();
  if (!(await customers.get(id))) notFound();
  const t = await inbox.thread(id);
  return <Thread initial={t} igConfigured={await instagram.isConfigured()} />;
}
