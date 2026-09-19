import type { ReactNode } from 'react';
import { InfoTip } from './ui';

export function PageHeader({ title, info, subtitle, actions }: { title: ReactNode; info?: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-[22px] font-semibold leading-tight">{title}{info && <InfoTip text={info} />}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
