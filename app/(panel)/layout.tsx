import type { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { cfg } from '@/lib/config';

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar business={cfg.business.name} owner={cfg.business.ownerName} igHandle={cfg.business.igHandle} website={cfg.business.website} authRequired={Boolean(cfg.panelPassword)} />
      <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-7">{children}</main>
    </div>
  );
}
