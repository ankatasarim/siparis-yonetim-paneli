export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const httpError = (status: number, message: string) => new HttpError(status, message);
export const now = () => new Date().toISOString();

/** Türkçe karakterleri sadeleştirip küçük harfe çevirir (anahtar kelime eşleştirme için). */
export function normalizeTr(text: unknown): string {
  return String(text || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/i̇/g, 'i')
    .replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();
}

export function pick<T extends object>(obj: T | null | undefined, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!obj) return out;
  for (const k of keys) if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = (obj as Record<string, unknown>)[k];
  return out;
}

export function firstName(name: unknown): string {
  const s = String(name || '').trim();
  return s ? s.split(/\s+/)[0] : '';
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function toNumber(v: unknown): number | null {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}
