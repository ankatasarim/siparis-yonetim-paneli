import * as db from '../db';
import { cfg } from '../config';
import { eq, lt, notNull } from '../store';
import * as orders from './orders';
import * as backup from './backup';
import * as dhl from '../integrations/dhl';
import * as instagram from '../integrations/instagram';
import { now } from '../utils';
import type { TrackResult } from '../types';

const g = globalThis as unknown as { __ankaTimers?: NodeJS.Timeout[] };
const timers: NodeJS.Timeout[] = g.__ankaTimers || (g.__ankaTimers = []);
const log = (...a: unknown[]) => console.log('[otomasyon]', ...a);

/** Tek bir siparişin DHL durumunu sorgular; teslim edildiyse akışı ilerletir. */
export async function checkOrder(id: number | string): Promise<TrackResult | null> {
  const order = await orders.getRaw(id);
  if (!order || !order.dhl_tracking_no) return null;
  const res = await dhl.track(order.dhl_tracking_no);
  if (!res) return null;
  await orders.updateTracking(order.id, { status: res.status, text: res.text });
  if (res.status === 'delivered' && order.status === 'kargoya_verildi') {
    await orders.setStatus(order.id, 'teslim_edildi', { by: 'dhl-takip', note: 'DHL takip: teslim edildi' });
  }
  return res;
}

/** Kargodaki siparişleri sorgular. Serverless süre sınırı için en eski kontrol edilenden başlar, adet ve süre bütçesi vardır. */
export async function pollShipments(opts: { limit?: number; budgetMs?: number } = {}): Promise<{ checked: number; total: number }> {
  if (!dhl.canTrack()) return { checked: 0, total: 0 };
  const limit = opts.limit ?? 15;
  const budget = opts.budgetMs ?? 40000;
  const started = Date.now();
  const { rows } = await db.store().select<{ id: number }>({
    table: 'orders', columns: ['id'], where: [eq('status', 'kargoya_verildi'), notNull('dhl_tracking_no')],
    order: [{ col: 'dhl_last_check', asc: true, nullsFirst: true }, { col: 'id' }], limit,
  });
  let checked = 0;
  for (const r of rows) {
    if (Date.now() - started > budget) break;
    try { await checkOrder(r.id); checked += 1; }
    catch (e) { console.error('[otomasyon] takip hatası (sipariş', r.id + '):', (e as Error).message); }
  }
  if (rows.length) log(`${checked}/${rows.length} gönderi sorgulandı`);
  return { checked, total: rows.length };
}

/** Memnuniyet sorusuna X gün cevap gelmeyen siparişleri kapatır. */
export async function closeStaleSatisfaction(): Promise<number> {
  const days = cfg.automation.satisfactionAutoCloseDays;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const { rows } = await db.store().select<{ id: number }>({
    table: 'orders', columns: ['id'], where: [eq('status', 'teslim_edildi'), eq('satisfaction', 'bekleniyor'), notNull('satisfaction_asked_at'), lt('satisfaction_asked_at', cutoff)], limit: 200,
  });
  for (const r of rows) {
    try {
      await orders.setSatisfaction(r.id, 'cevapsiz', null, { by: 'otomatik', autoClose: false });
      await orders.setStatus(r.id, 'kapandi', { by: 'otomatik', note: `Memnuniyet cevabı gelmedi (${days} gün)` });
    } catch (e) {
      console.error('[otomasyon] otomatik kapatma hatası:', (e as Error).message);
    }
  }
  if (rows.length) log(`${rows.length} sipariş cevapsız olarak kapatıldı`);
  return rows.length;
}

export async function maybeRefreshToken(): Promise<boolean> {
  if (!(await instagram.isConfigured())) return false;
  const last = await db.getSetting('ig_token_refreshed_at');
  const age = last ? Date.now() - Date.parse(last) : Infinity;
  if (age < 30 * 86400000) return false;
  try {
    await instagram.refreshToken();
    log('Instagram token yenilendi');
    return true;
  } catch (e) {
    console.error('[otomasyon] Instagram token yenilenemedi:', (e as Error).message);
    return false;
  }
}

/** Tüm zamanlanmış işleri sırayla çalıştırır (cron endpoint'i ve "Şimdi çalıştır" düğmesi bunu çağırır). */
export async function runAll(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  out.shipments = await pollShipments();
  out.closed = await closeStaleSatisfaction();
  out.token_refreshed = await maybeRefreshToken();
  try { out.backup = await backup.dailyBackupIfDue(); }
  catch (e) { out.backup = { error: (e as Error).message }; console.error('[otomasyon] yedek hatası:', (e as Error).message); }
  await db.setSetting('cron_last_at', now());
  return out;
}

const safe = (fn: () => unknown) => () => { Promise.resolve().then(fn).catch((e) => console.error('[otomasyon]', (e as Error).message)); };

/** Kendi sunucunuzda (Vercel dışı) çalışırken zamanlayıcıları başlatır. */
export function start() {
  if (!cfg.automation.enabled) { log('kapalı (AUTOMATION_ENABLED=false)'); return; }
  if (cfg.isVercel) { log('Vercel: zamanlayıcı yok, /api/cron kullanılır'); return; }
  stop();
  timers.push(setInterval(safe(() => pollShipments({ limit: 200, budgetMs: 10 * 60000 })), cfg.automation.trackPollMinutes * 60000));
  timers.push(setInterval(safe(closeStaleSatisfaction), 6 * 3600000));
  timers.push(setInterval(safe(async () => { await maybeRefreshToken(); await backup.dailyBackupIfDue(); }), 3600000));
  timers.push(setTimeout(safe(runAll), 15000));
  log(`aktif · kargo takibi her ${cfg.automation.trackPollMinutes} dk (${dhl.canTrack() ? dhl.status().tracking_source : 'takip API yok, manuel'})`);
}

export function stop() {
  while (timers.length) clearInterval(timers.pop()!);
}
