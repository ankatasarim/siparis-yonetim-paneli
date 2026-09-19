import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

/**
 * Tüm panel ve API istekleri oturum ister. PANEL_PASSWORD tanımlı değilse uygulama AÇILMAZ
 * (giriş sayfası kurulum uyarısı gösterir); şifresiz açık panel yok.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const password = process.env.PANEL_PASSWORD || '';
  const secret = process.env.SESSION_SECRET || 'anka-dev-secret-lutfen-degistirin';
  const ok = password ? await verifySessionToken(secret, req.cookies.get(SESSION_COOKIE)?.value) : false;
  if (ok) return NextResponse.next();
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: password ? 'Giriş gerekli' : 'PANEL_PASSWORD tanımlı değil' }, { status: password ? 401 : 503 });
  }
  const url = new URL('/giris', req.url);
  if (pathname !== '/') url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

// /api/cron kendi gizli anahtarıyla korunur (cron-job.org ve Vercel cron çerez taşımaz)
export const config = {
  matcher: ['/((?!giris|api/auth|api/cron|webhooks|health|_next/static|_next/image|favicon\\.ico|icon\\.svg).*)'],
};
