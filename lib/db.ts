import { cfg } from './config';
import { eq, isIn, type Query, type Row, type Store } from './store';

/**
 * Veri deposu girişi. SUPABASE_URL + SUPABASE_SECRET_KEY tanımlıysa Supabase REST API,
 * yoksa yerel JSON deposu (geliştirme/test). Her sayfa/route başında `await ready()` çağrılır.
 */

export interface ReadyOptions {
  /** Testler için bellek içi depo */
  memory?: boolean;
  /** Yerel depo dosyası (varsayılan: LOCAL_DATA_FILE) */
  file?: string;
}

interface State { store: Store | null; initPromise: Promise<void> | null }
const g = globalThis as unknown as { __ankaStore?: State };
const state: State = g.__ankaStore || (g.__ankaStore = { store: null, initPromise: null });

async function init(opts: ReadyOptions) {
  if (!opts.memory && !opts.file && cfg.supabase.url && cfg.supabase.key) {
    const { createSupabaseStore } = await import('./store/supabase');
    state.store = createSupabaseStore(cfg.supabase.url, cfg.supabase.key);
    return;
  }
  if (cfg.isVercel && !opts.memory) {
    throw new Error('Vercel üzerinde SUPABASE_URL ve SUPABASE_SECRET_KEY (veya SUPABASE_PUBLISHABLE_KEY) tanımlanmalı (Supabase › Project Settings › API Keys).');
  }
  const { createLocalStore } = await import('./store/local');
  state.store = createLocalStore(opts.memory ? undefined : opts.file || cfg.localDataFile);
}

export async function ready(opts: ReadyOptions = {}): Promise<void> {
  if (state.store) return;
  if (!state.initPromise) {
    state.initPromise = init(opts).catch((e) => {
      state.initPromise = null;
      // Canlıda (Vercel) hata mesajları gizlenir; hata sayfası bu "digest" ile nedeni gösterir.
      (e as Error & { digest?: string }).digest = 'ANKA_CONFIG';
      throw e;
    });
  }
  await state.initPromise;
}

export function store(): Store {
  if (!state.store) throw new Error('Veri deposu hazır değil: önce ready() çağrılmalı');
  return state.store;
}

export function kind(): 'supabase' | 'local' {
  return state.store ? state.store.kind : cfg.supabase.url && cfg.supabase.key ? 'supabase' : 'local';
}

/** Sayfa sayfa (1000'er) okuyarak tüm eşleşen satırları getirir. */
export async function selectAll<T = Row>(q: Query, pageSize = 1000, max = 50000): Promise<T[]> {
  const out: T[] = [];
  let offset = q.offset || 0;
  while (out.length < max) {
    const { rows } = await store().select<T>({ ...q, limit: pageSize, offset, count: false });
    out.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

export async function getSetting(key: string, def: string | null = null): Promise<string | null> {
  const { rows } = await store().select<{ value: string | null }>({ table: 'settings', columns: ['value'], where: [eq('key', key)], limit: 1 });
  const v = rows[0] ? rows[0].value : null;
  return v == null ? def : v;
}

export async function getSettings(keys: string[]): Promise<Map<string, string | null>> {
  if (!keys.length) return new Map();
  const { rows } = await store().select<{ key: string; value: string | null }>({ table: 'settings', columns: ['key', 'value'], where: [isIn('key', keys)], limit: keys.length });
  return new Map(rows.map((r) => [r.key, r.value]));
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  await store().upsert('settings', { key, value: value == null ? null : String(value) }, 'key');
}

export async function close(): Promise<void> {
  const s = state.store;
  state.store = null;
  state.initPromise = null;
  if (s) await s.close();
}
