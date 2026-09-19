'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';

export function SyncButton({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const { toast, fail } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await api.post('/api/inbox/sync');
      toast(r.new_messages ? `${r.new_messages} yeni mesaj alındı (${r.conversations} sohbet)` : `Yeni mesaj yok (${r.conversations} sohbet kontrol edildi)`, 'ok');
      router.refresh();
    } catch (e) { fail(e); }
    setBusy(false);
  };
  return (
    <button onClick={run} disabled={!enabled || busy} title={enabled ? "Instagram'daki son sohbetleri çek" : "Önce Ayarlar'dan Instagram token'ı girin"} className="btn btn-primary">
      <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />{busy ? 'Çekiliyor…' : "Instagram'dan çek"}
    </button>
  );
}
