'use client';
import type { ReactNode } from 'react';
import { useSelectedLayoutSegment } from 'next/navigation';

/** Mobilde tek panel: sohbet seçilmemişse liste, seçilmişse yalnızca sohbet. Geniş ekranda iki sütun. */
export function InboxShell({ list, children }: { list: ReactNode; children: ReactNode }) {
  const active = Boolean(useSelectedLayoutSegment());
  return (
    <div className="grid grid-cols-1 gap-4 lg:h-[calc(100vh-150px)] lg:min-h-[560px] lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className={`card max-h-[75vh] overflow-y-auto lg:block lg:max-h-none ${active ? 'hidden' : 'block'}`}>{list}</div>
      <div className={`card min-h-[70vh] flex-col overflow-hidden lg:flex lg:min-h-[480px] ${active ? 'flex' : 'hidden'}`}>{children}</div>
    </div>
  );
}
