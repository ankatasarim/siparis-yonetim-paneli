'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';

export function SearchBox({ placeholder = 'Tabloda arama yapın', param = 'q', className = '' }: { placeholder?: string; param?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get(param) || '';
  const [v, setV] = useState(current);
  useEffect(() => { setV(current); }, [current]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (v.trim() === current) return;
      const p = new URLSearchParams(sp.toString());
      if (v.trim()) p.set(param, v.trim()); else p.delete(param);
      p.delete('sayfa');
      router.replace(`${pathname}${p.toString() ? '?' + p.toString() : ''}`);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
      <input type="search" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="input pl-9" />
    </div>
  );
}
