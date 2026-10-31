'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';

export function SearchBox({ placeholder = 'Tabloda arama yapın', param = 'q', className = '' }: { placeholder?: string; param?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const searchParams = sp.toString();
  const current = sp.get(param) || '';
  const [v, setV] = useState(current);
  const submittedValue = useRef<string | null>(null);

  useEffect(() => {
    if (submittedValue.current === current) {
      submittedValue.current = null;
      return;
    }
    setV(current);
  }, [current]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (v.trim() === current) return;
      const p = new URLSearchParams(searchParams);
      if (v.trim()) p.set(param, v.trim()); else p.delete(param);
      p.delete('sayfa');
      submittedValue.current = v.trim();
      router.replace(`${pathname}${p.toString() ? '?' + p.toString() : ''}`);
    }, 350);
    return () => clearTimeout(t);
  }, [v, current, param, pathname, router, searchParams]);
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
      <input type="search" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="input pl-9" />
    </div>
  );
}
