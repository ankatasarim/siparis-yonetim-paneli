'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Sayfa geçişlerinde üstte ince ilerleme çubuğu. Bağlantı tıklamalarını ve `startNav()` çağrılarını
 * dinler; adres değişince (yeni sayfa geldi) kapanır.
 */
export function NavProgress() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const key = pathname + '?' + sp.toString();
  const keyRef = useRef(key);
  const [active, setActive] = useState(false);

  useEffect(() => { keyRef.current = key; setActive(false); }, [key]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      let url: URL;
      try { url = new URL(a.href, location.href); } catch { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname + '?' + url.searchParams.toString() === keyRef.current) return;
      setActive(true);
    };
    const onStart = () => setActive(true);
    document.addEventListener('click', onClick);
    window.addEventListener('anka:nav', onStart);
    return () => { document.removeEventListener('click', onClick); window.removeEventListener('anka:nav', onStart); };
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), 12000);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <div aria-hidden className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`h-full rounded-r bg-primary shadow-[0_0_8px_rgba(108,71,255,.6)] ${active ? 'nav-progress-run' : 'w-0'}`} />
    </div>
  );
}
