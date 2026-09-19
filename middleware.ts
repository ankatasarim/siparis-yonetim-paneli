import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

export async function middleware(req: NextRequest) {
  const password = process.env.PANEL_PASSWORD || '';
  if (!password) return NextResponse.next();
  const secret = process.env.SESSION_SECRET || 'anka-dev-secret-lutfen-degistirin';
  const ok = await verifySessionToken(secret, req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 });
  const url = new URL('/giris', req.url);
  if (pathname !== '/') url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

// /api/cron kendi gizli anahtarıyla korunur (cron-job.org ve Vercel cron çerez taşımaz)
export const config = {
  matcher: ['/((?!giris|api/auth|api/cron|webhooks|health|_next/static|_next/image|favicon\\.ico|icon\\.svg).*)'],
};
