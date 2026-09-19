import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';

export function FullscreenHeader({ back, crumbs, pills, right }: { back: string; crumbs: { label: string; href?: string }[]; pills?: ReactNode; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 bg-ink px-4 text-white md:px-6">
      <Link href={back} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-700 hover:bg-neutral-800" aria-label="Geri"><ArrowLeft className="h-4 w-4" /></Link>
      <nav className="flex min-w-0 items-center gap-1.5 text-lg">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-4 w-4 text-neutral-500" />}
            {c.href ? <Link href={c.href} className="text-primary-soft hover:text-white">{c.label}</Link> : <span className="truncate font-semibold">{c.label}</span>}
          </span>
        ))}
      </nav>
      {pills && <div className="hidden items-center gap-2 sm:flex">{pills}</div>}
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </header>
  );
}
