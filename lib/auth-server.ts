import { cookies } from 'next/headers';
import { cfg } from './config';
import { SESSION_COOKIE, verifySessionToken } from './session';

/** Şifre tanımlı değilse kimse giriş yapmış sayılmaz. */
export async function isAuthenticated(): Promise<boolean> {
  if (!cfg.panelPassword) return false;
  const store = await cookies();
  return verifySessionToken(cfg.sessionSecret, store.get(SESSION_COOKIE)?.value);
}
