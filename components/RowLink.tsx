'use client';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { startNav } from '@/lib/client';

export function RowLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => { if ((e.target as HTMLElement).closest('a,button,input,select,textarea')) return; startNav(); router.push(href); }}
      className={`cursor-pointer transition hover:bg-neutral-50 ${className}`}
    >
      {children}
    </tr>
  );
}
