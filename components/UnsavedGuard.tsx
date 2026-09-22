'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/Modal';
import { startNav } from '@/lib/client';

/**
 * Kaydedilmemiş değişiklik varken sayfadan çıkışı onaya bağlar.
 * - Uygulama içi bağlantılar (Geri, kırıntılar, Vazgeç, kenar çubuğu): tıklama yakalanır, onay penceresi açılır.
 * - Sekme kapatma, yenileme, adres yazma, dış bağlantı: tarayıcının kendi "emin misiniz" uyarısı.
 * Tarayıcının geri düğmesi (uygulama içi geçiş) yakalanmaz.
 */
export function UnsavedGuard({ when, text = 'Kaydedilmemiş değişiklikler var. Kaydetmeden çıkmak istediğinize emin misiniz?' }: { when: boolean; text?: string }) {
  const router = useRouter();
  const whenRef = useRef(when);
  whenRef.current = when;
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!whenRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    // Yakalama aşamasında dinlenir: Next <Link> tıklamayı görmeden durdurulur, ilerleme çubuğu da başlamaz.
    const onClick = (e: MouseEvent) => {
      if (!whenRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      let url: URL;
      try { url = new URL(a.href, location.href); } catch { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(url.pathname + url.search + url.hash);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  return (
    <ConfirmDialog
      open={pending !== null}
      title="Kaydetmeden çık?"
      text={text}
      okLabel="Kaydetmeden çık"
      danger
      onCancel={() => setPending(null)}
      onConfirm={() => { const href = pending!; setPending(null); startNav(); router.push(href); }}
    />
  );
}
