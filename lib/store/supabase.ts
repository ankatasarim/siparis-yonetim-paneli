import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { StoreError, type Cond, type Row, type Store, type Where } from '../store';

/** Supabase REST API (PostgREST) üzerinden veri erişimi. Sunucu tarafında gizli anahtarla kullanılır. */

const MISSING_TABLE = /schema cache|does not exist|PGRST205|42P01/i;

function wrap(error: { message: string; code?: string; details?: string | null; hint?: string | null }): StoreError {
  let msg = error.message || 'Supabase hatası';
  const missing = MISSING_TABLE.test(`${error.code || ''} ${msg}`);
  if (missing) {
    msg = `Supabase'de tablolar bulunamadı. supabase/schema.sql dosyasını Supabase › SQL Editor'de bir kez çalıştırın. (${error.message})`;
  } else if (error.details) msg += ` · ${error.details}`;
  const err = new StoreError(msg, error.code);
  // Canlıda hata mesajları gizlenir; hata sayfası nedeni bu "digest" ile gösterir.
  (err as StoreError & { digest?: string }).digest = missing ? 'ANKA_TABLE' : /jwt|api key|unauthorized|401|permission|policy|row-level/i.test(`${error.code} ${error.message}`) ? 'ANKA_AUTH' : `ANKA_DB:${error.code || ''}`;
  return err;
}

/** PostgREST `or=(...)` sözdizimi için değer kaçışı: metinler çift tırnak içinde, \ ve " kaçışlı. */
function quote(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function condToOr(c: Cond): string {
  if (c.op === 'in') return `${c.col}.in.(${(c.val as unknown[]).map(quote).join(',')})`;
  if (c.op === 'is') return `${c.col}.is.${c.val === null ? 'null' : String(c.val)}`;
  if (c.op === 'notnull') return `${c.col}.not.is.null`;
  return `${c.col}.${c.op}.${quote(c.val)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyWhere(qb: any, where: Where[]) {
  for (const w of where) {
    if ('or' in w) {
      if (w.or.length) qb = qb.or(w.or.map(condToOr).join(','));
      continue;
    }
    switch (w.op) {
      case 'eq': qb = qb.eq(w.col, w.val); break;
      case 'neq': qb = qb.neq(w.col, w.val); break;
      case 'gt': qb = qb.gt(w.col, w.val); break;
      case 'gte': qb = qb.gte(w.col, w.val); break;
      case 'lt': qb = qb.lt(w.col, w.val); break;
      case 'lte': qb = qb.lte(w.col, w.val); break;
      case 'in': qb = qb.in(w.col, w.val as unknown[]); break;
      case 'ilike': qb = qb.ilike(w.col, String(w.val)); break;
      case 'is': qb = qb.is(w.col, w.val as null); break;
      case 'notnull': qb = qb.not(w.col, 'is', null); break;
    }
  }
  return qb;
}

export interface SupabaseStore extends Store { client: SupabaseClient }

export function createSupabaseStore(url: string, key: string): SupabaseStore {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'X-Client-Info': 'anka-siparis-takip' } },
  });
  return {
    kind: 'supabase',
    client,
    async select(q) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let qb: any = client.from(q.table).select(q.columns && q.columns.length ? q.columns.join(',') : '*', q.count ? { count: 'exact' } : undefined);
      qb = applyWhere(qb, q.where || []);
      for (const o of q.order || []) qb = qb.order(o.col, { ascending: o.asc !== false, nullsFirst: o.nullsFirst });
      if (q.limit != null) qb = qb.range(q.offset || 0, (q.offset || 0) + q.limit - 1);
      const { data, error, count } = await qb;
      if (error) throw wrap(error);
      return { rows: (data || []) as never[], count: count ?? null };
    },
    async insert(table, row) {
      const { data, error } = await client.from(table).insert(row).select().single();
      if (error) throw wrap(error);
      return data as never;
    },
    async insertMany(table, rows) {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await client.from(table).insert(rows.slice(i, i + 500));
        if (error) throw wrap(error);
      }
    },
    async update(table, where, patch) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let qb: any = client.from(table).update(patch);
      qb = applyWhere(qb, where);
      const { data, error } = await qb.select();
      if (error) throw wrap(error);
      return (data || []) as never[];
    },
    async remove(table, where) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let qb: any = client.from(table).delete();
      qb = applyWhere(qb, where);
      const { data, error } = await qb.select(table === 'settings' ? 'key' : 'id');
      if (error) throw wrap(error);
      return (data || []).length;
    },
    async upsert(table, row, onConflict) {
      const { data, error } = await client.from(table).upsert(row, { onConflict }).select().single();
      if (error) throw wrap(error);
      return data as never;
    },
    async rpc(fn, args) {
      const { data, error } = await client.rpc(fn, args as Row | undefined);
      if (error) throw wrap(error);
      return data as never;
    },
    async close() { /* HTTP istemcisi; kapatılacak bağlantı yok */ },
  };
}
