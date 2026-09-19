import type { ReactNode } from 'react';
import Link from 'next/link';
import { Info } from 'lucide-react';
import { initials } from '@/lib/format';

export function Card({ title, actions, children, className = '', pad = true, id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean; id?: string }) {
  return (
    <section id={id} className={`card ${className}`}>
      {title !== undefined && (
        <header className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'px-5 py-4' : ''}>{children}</div>
    </section>
  );
}

export function Field({ label, children, hint, className = '' }: { label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export function Avatar({ name, src, size = 'md', className = '' }: { name?: string | null; src?: string | null; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dim = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-10 w-10 text-sm';
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft font-semibold text-primary-text ${dim} ${className}`}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </div>
  );
}

export function InfoTip({ text }: { text: string }) {
  return <span title={text} className="inline-flex text-neutral-400"><Info className="h-4 w-4" /></span>;
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="text-3xl">{icon}</div>}
      <p className="font-medium">{title}</p>
      {text && <p className="max-w-md text-sm text-neutral-500">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, href, accent = 'bg-primary' }: { label: string; value: ReactNode; sub?: ReactNode; href?: string; accent?: string }) {
  const body = (
    <div className="card flex items-start gap-3 px-4 py-4 transition hover:border-neutral-300">
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${accent}`} />
      <div className="min-w-0">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <p className="mt-0.5 truncate text-2xl font-semibold leading-tight">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Alert({ kind = 'warn', children }: { kind?: 'warn' | 'info' | 'ok' | 'err'; children: ReactNode }) {
  const cls = { warn: 'border-amber-200 bg-amber-50 text-amber-900', info: 'border-blue-200 bg-blue-50 text-blue-900', ok: 'border-emerald-200 bg-emerald-50 text-emerald-900', err: 'border-red-200 bg-red-50 text-red-900' }[kind];
  return <div className={`flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border px-4 py-2.5 text-sm ${cls}`}>{children}</div>;
}
