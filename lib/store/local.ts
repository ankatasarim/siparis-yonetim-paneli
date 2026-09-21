import fs from 'fs';
import path from 'path';
import { StoreError, type Cond, type Query, type Row, type Store, type Table, type Where } from '../store';

/**
 * Yerel depo: bellek içi tablolar, isteğe bağlı JSON dosyasına yazar.
 * Supabase deposuyla aynı filtre/sıralama anlamını taşır; yerel geliştirme ve testler için.
 */

const TABLES: Table[] = ['customers', 'products', 'orders', 'messages', 'order_events', 'settings'];
const UNIQUE: Partial<Record<Table, string[]>> = { customers: ['ig_user_id'], orders: ['order_no'], messages: ['ig_mid'], settings: ['key'] };
const HAS_ID = new Set<Table>(['customers', 'products', 'orders', 'messages', 'order_events']);
/** Veritabanındaki sütun varsayılanları: eksik alanlar undefined yerine bu değerlerle doldurulur. */
const DEFAULTS: Record<Table, Row> = {
  customers: { ig_user_id: null, ig_username: null, name: '', email: '', phone: '', address: '', city: '', district: '', postal_code: '', notes: '', profile_pic: null },
  products: { price: null, description: '', image: '', desi: 0, active: 1, sort_order: 0 },
  orders: {
    status: 'yeni', payment_status: 'bekleniyor', payment_method: '', shipping_payer: 'gonderici', lines_json: '[]', items: '', notes: '', labels: '', desi: null,
    package_count: 1, shipping_fee: 0, subtotal: 0, total: 0, source: 'instagram', dhl_tracking_no: null, dhl_shipment_ref: null, dhl_status: null, dhl_status_text: null,
    dhl_last_check: null, shipped_at: null, delivered_at: null, closed_at: null, satisfaction: null, satisfaction_note: null, satisfaction_asked_at: null,
  },
  messages: { order_id: null, channel: 'instagram', ig_mid: null, text: '', attachments: '[]', status: 'ok', error: null, kind: null, is_read: 0 },
  order_events: { description: '', meta: null },
  settings: { value: null },
};

type Data = Record<Table, Row[]>;

function emptyData(): Data {
  return { customers: [], products: [], orders: [], messages: [], order_events: [], settings: [] };
}

function likeToRegex(pattern: string): RegExp {
  const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${esc}$`, 'is');
}

function cmp(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const sa = String(a), sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function cond(row: Row, c: Cond): boolean {
  const v = row[c.col];
  switch (c.op) {
    case 'eq': return v != null && (v === c.val || String(v) === String(c.val));
    case 'neq': return v != null && String(v) !== String(c.val);
    case 'gt': return v != null && cmp(v, c.val) > 0;
    case 'gte': return v != null && cmp(v, c.val) >= 0;
    case 'lt': return v != null && cmp(v, c.val) < 0;
    case 'lte': return v != null && cmp(v, c.val) <= 0;
    case 'in': return v != null && (c.val as unknown[]).some((x) => x === v || String(x) === String(v));
    case 'ilike': return v != null && likeToRegex(String(c.val)).test(String(v));
    case 'is': return c.val === null ? v == null : v === c.val;
    case 'notnull': return v != null;
  }
  return false;
}

const matches = (row: Row, where: Where[]) => where.every((w) => ('or' in w ? w.or.some((c) => cond(row, c)) : cond(row, w)));

export function createLocalStore(file?: string): Store {
  let data: Data = emptyData();
  if (file && fs.existsSync(file)) {
    try { data = { ...emptyData(), ...JSON.parse(fs.readFileSync(file, 'utf8')) }; }
    catch (e) { console.warn('[yerel depo] dosya okunamadı, boş başlanıyor:', (e as Error).message); }
  }
  const seq: Record<string, number> = {};
  for (const t of TABLES) seq[t] = data[t].reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);

  let timer: NodeJS.Timeout | null = null;
  const persist = () => {
    if (!file || timer) return;
    timer = setTimeout(() => {
      timer = null;
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const tmp = `${file}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(data));
        fs.renameSync(tmp, file);
      } catch (e) { console.error('[yerel depo] kaydetme hatası:', (e as Error).message); }
    }, 200);
  };
  const flush = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (file) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data)); }
  };
  const copy = (r: Row) => ({ ...r });

  function checkUnique(table: Table, row: Row, exceptId?: number) {
    for (const col of UNIQUE[table] || []) {
      if (row[col] == null) continue;
      if (data[table].some((r) => r[col] === row[col] && r.id !== exceptId)) {
        throw new StoreError(`duplicate key value violates unique constraint (${table}.${col})`, '23505');
      }
    }
  }

  function select(q: Query) {
    let rows = data[q.table].filter((r) => matches(r, q.where || []));
    if (q.order && q.order.length) {
      const order = q.order;
      rows = [...rows].sort((a, b) => {
        for (const o of order) {
          const av = a[o.col], bv = b[o.col];
          if (av == null && bv == null) continue;
          if (av == null) return o.nullsFirst ? -1 : 1;
          if (bv == null) return o.nullsFirst ? 1 : -1;
          const c = cmp(av, bv);
          if (c !== 0) return o.asc === false ? -c : c;
        }
        return 0;
      });
    }
    const count = q.count ? rows.length : null;
    if (q.offset) rows = rows.slice(q.offset);
    if (q.limit != null) rows = rows.slice(0, q.limit);
    const projected = q.columns && q.columns.length ? rows.map((r) => Object.fromEntries(q.columns!.map((c) => [c, r[c]]))) : rows.map(copy);
    return { rows: projected as never[], count };
  }

  return {
    kind: 'local',
    async select(q) { return select(q); },
    async insert(table, row) {
      const r = { ...DEFAULTS[table], ...copy(row) };
      for (const k of Object.keys(r)) if (r[k] === undefined) r[k] = DEFAULTS[table][k] ?? null;
      if (HAS_ID.has(table)) {
        if (r.id == null) r.id = ++seq[table];
        else { r.id = Number(r.id); seq[table] = Math.max(seq[table], r.id); }
      }
      checkUnique(table, r);
      data[table].push(r);
      persist();
      return copy(r) as never;
    },
    async insertMany(table, rows) { for (const r of rows) await this.insert(table, r); },
    async update(table, where, patch) {
      const out: Row[] = [];
      for (const r of data[table]) {
        if (!matches(r, where)) continue;
        checkUnique(table, { ...r, ...patch }, r.id);
        Object.assign(r, patch);
        out.push(copy(r));
      }
      if (out.length) persist();
      return out as never[];
    },
    async remove(table, where) {
      const before = data[table].length;
      data[table] = data[table].filter((r) => !matches(r, where));
      const n = before - data[table].length;
      if (n) persist();
      return n;
    },
    async upsert(table, row, onConflict) {
      const existing = data[table].find((r) => r[onConflict] === row[onConflict]);
      if (existing) { Object.assign(existing, row); persist(); return copy(existing) as never; }
      return this.insert(table, row);
    },
    async rpc(fn) {
      if (fn === 'reset_sequences') { for (const t of TABLES) seq[t] = data[t].reduce((m, r) => Math.max(m, Number(r.id) || 0), 0); return null as never; }
      throw new StoreError(`Yerel depoda RPC yok: ${fn}`);
    },
    async close() { flush(); },
  };
}
