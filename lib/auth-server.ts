import { cookies } from 'next/headers';
import { cfg } from './config';
import { SESSION_COOKIE, verifySessionToken } from './session';

export async function isAuthenticated(): Promise<boolean> {
  if (!cfg.panelPassword) return true;
  const store = await cookies();
  return verifySessionToken(cfg.sessionSecret, store.get(SESSION_COOKIE)?.value);
}
