'use client';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

export function RowLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => { if ((e.target as HTMLElement).closest('a,button,input,select,textarea')) return; router.push(href); }}
      className={`cursor-pointer transition hover:bg-neutral-50 ${className}`}
    >
      {children}
    </tr>
  );
}
