/**
 * Veri deposu arayüzü. İki uygulama var:
 *  - lib/store/supabase.ts : Supabase REST API (supabase-js, gizli anahtar) — canlı ortam
 *  - lib/store/local.ts    : Bellek içi / JSON dosyası — yerel geliştirme ve testler
 * Servisler yalnızca bu arayüzü kullanır; SQL yazılmaz.
 */

export type Table = 'customers' | 'products' | 'orders' | 'messages' | 'order_events' | 'settings';
export type Row = Record<string, any>;
export type Op = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'ilike' | 'is' | 'notnull';

export interface Cond { col: string; op: Op; val?: unknown }
export type Where = Cond | { or: Cond[] };
export interface OrderBy { col: string; asc?: boolean; nullsFirst?: boolean }

export interface Query {
  table: Table;
  columns?: string[];
  where?: Where[];
  order?: OrderBy[];
  limit?: number;
  offset?: number;
  /** true ise toplam eşleşen satır sayısı da döner */
  count?: boolean;
}

export interface Store {
  kind: 'supabase' | 'local';
  select<T = Row>(q: Query): Promise<{ rows: T[]; count: number | null }>;
  insert<T = Row>(table: Table, row: Row): Promise<T>;
  insertMany(table: Table, rows: Row[]): Promise<void>;
  update<T = Row>(table: Table, where: Where[], patch: Row): Promise<T[]>;
  remove(table: Table, where: Where[]): Promise<number>;
  upsert<T = Row>(table: Table, row: Row, onConflict: string): Promise<T>;
  rpc<T = unknown>(fn: string, args?: Row): Promise<T>;
  close(): Promise<void>;
}

export class StoreError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export const isUniqueViolation = (e: unknown): boolean => {
  const err = e as { code?: string; message?: string };
  return err?.code === '23505' || /duplicate key|unique/i.test(err?.message || '');
};

// Koşul yardımcıları
export const eq = (col: string, val: unknown): Cond => ({ col, op: 'eq', val });
export const neq = (col: string, val: unknown): Cond => ({ col, op: 'neq', val });
export const gt = (col: string, val: unknown): Cond => ({ col, op: 'gt', val });
export const gte = (col: string, val: unknown): Cond => ({ col, op: 'gte', val });
export const lt = (col: string, val: unknown): Cond => ({ col, op: 'lt', val });
export const lte = (col: string, val: unknown): Cond => ({ col, op: 'lte', val });
export const isIn = (col: string, val: unknown[]): Cond => ({ col, op: 'in', val });
export const ilike = (col: string, val: string): Cond => ({ col, op: 'ilike', val });
export const isNull = (col: string): Cond => ({ col, op: 'is', val: null });
export const notNull = (col: string): Cond => ({ col, op: 'notnull' });
export const or = (conds: Cond[]): Where => ({ or: conds });
