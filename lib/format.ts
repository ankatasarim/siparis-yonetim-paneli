const APP_TIME_ZONE = 'Europe/Istanbul';

export function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: APP_TIME_ZONE });
}

export function fmtDay(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: APP_TIME_ZONE });
}

export function fmtTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: APP_TIME_ZONE });
}

export function fmtShort(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const today = new Date();
  const dateKey = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE });
  return dateKey(d) === dateKey(today)
    ? d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: APP_TIME_ZONE })
    : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: APP_TIME_ZONE });
}

export function money(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return '₺ 0,00';
  return '₺ ' + Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const trunc = (s: string | null | undefined, n: number) => {
  const t = String(s || '');
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

export const initials = (name?: string | null) => (name || '?').trim().charAt(0).toUpperCase() || '?';
