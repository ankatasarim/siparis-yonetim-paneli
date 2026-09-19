import { NextRequest, NextResponse } from 'next/server';
import { cfg } from '@/lib/config';
import { ready } from '@/lib/db';
import { automation } from '@/lib/services';
import { passwordMatches } from '@/lib/session';

/**
 * Zamanlanmış işler: DHL takibi, cevapsız memnuniyet kapatma, Instagram token yenileme, günlük yedek.
 * cron-job.org (30 dk) ve Vercel cron (günlük) bu adresi çağırır.
 * Koruma: `Authorization: Bearer CRON_SECRET` başlığı veya `?secret=` parametresi.
 */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!cfg.cronSecret) return NextResponse.json({ error: 'CRON_SECRET tanımlı değil' }, { status: 500 });
  const auth = req.headers.get('authorization') || '';
  const given = auth.startsWith('Bearer ') ? auth.slice(7).trim() : req.nextUrl.searchParams.get('secret') || '';
  if (!given || !(await passwordMatches(given, cfg.cronSecret))) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  try {
    await ready();
    const result = await automation.runAll();
    return NextResponse.json({ ok: true, at: new Date().toISOString(), ...result });
  } catch (e) {
    console.error('[cron]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
