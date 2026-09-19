import { NextRequest, NextResponse } from 'next/server';
import { cfg } from '@/lib/config';
import { createSessionToken, passwordMatches, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session';

export async function POST(req: NextRequest) {
  if (!cfg.panelPassword) return NextResponse.json({ ok: true, auth_required: false });
  const b = await req.json().catch(() => ({}));
  if (b.password && (await passwordMatches(String(b.password), cfg.panelPassword))) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, await createSessionToken(cfg.sessionSecret), {
      httpOnly: true, path: '/', maxAge: SESSION_MAX_AGE, sameSite: 'lax', secure: cfg.baseUrl.startsWith('https://'),
    });
    return res;
  }
  return NextResponse.json({ error: 'Şifre hatalı' }, { status: 401 });
}
