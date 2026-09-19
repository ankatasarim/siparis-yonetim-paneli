import { NextResponse } from 'next/server';
import { cfg } from '@/lib/config';
import { ready, store, kind } from '@/lib/db';
import { eq } from '@/lib/store';

/** Teşhis: hangi ayarlar tanımlı, veritabanına ulaşılıyor mu. Gizli değer içermez. */
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = {
    supabase_url: Boolean(cfg.supabase.url),
    supabase_key: cfg.supabase.key ? cfg.supabase.keyKind : 'yok',
    panel_password: Boolean(cfg.panelPassword),
    session_secret_custom: cfg.sessionSecret !== 'anka-dev-secret-lutfen-degistirin',
    cron_secret: Boolean(cfg.cronSecret),
    base_url: cfg.baseUrl,
    vercel: cfg.isVercel,
    db_mode: kind(),
  };
  let db: { ok: boolean; message?: string } = { ok: false };
  try {
    await ready();
    await store().select({ table: 'settings', columns: ['key'], where: [eq('key', '__ping__')], limit: 1 });
    db = { ok: true };
  } catch (e) {
    db = { ok: false, message: (e as Error).message };
  }
  const hints: string[] = [];
  if (!config.supabase_url || config.supabase_key === 'yok') hints.push('Vercel › Environment Variables: SUPABASE_URL ve SUPABASE_PUBLISHABLE_KEY (veya SUPABASE_SECRET_KEY) ekleyin, sonra Redeploy.');
  if (!config.panel_password) hints.push('PANEL_PASSWORD tanımlayın (panel şifresiz açılmaz).');
  if (!config.cron_secret) hints.push('CRON_SECRET tanımlayın (zamanlanmış işler için).');
  if (config.supabase_url && config.supabase_key !== 'yok' && !db.ok) hints.push('Supabase’e erişilemedi: anahtarı kontrol edin ve supabase/schema.sql dosyasını SQL Editor’de çalıştırın.');
  return NextResponse.json({ ok: db.ok && hints.length === 0, time: new Date().toISOString(), config, db, hints }, { status: db.ok ? 200 : 503 });
}
