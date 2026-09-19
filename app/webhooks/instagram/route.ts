import { NextRequest, NextResponse } from 'next/server';
import { cfg } from '@/lib/config';
import { ready } from '@/lib/db';
import { instagram, inbox } from '@/lib/services';

// Meta webhook doğrulaması
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get('hub.mode') === 'subscribe' && sp.get('hub.verify_token') === cfg.instagram.verifyToken) {
    return new Response(sp.get('hub.challenge') || '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// Gelen mesaj bildirimleri
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!instagram.verifySignature(raw, req.headers.get('x-hub-signature-256'))) {
    console.warn('[webhook] imza doğrulanamadı');
    return new Response('Forbidden', { status: 403 });
  }
  let payload: unknown = null;
  try { payload = JSON.parse(raw); } catch { return new Response('Bad Request', { status: 400 }); }
  await ready();
  try { await inbox.processWebhook(payload); } catch (e) { console.error('[webhook] işleme hatası:', (e as Error).message); }
  return NextResponse.json({ ok: true });
}
