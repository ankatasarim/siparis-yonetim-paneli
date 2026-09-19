/** Web Crypto tabanlı oturum imzası – hem Node hem Edge (middleware) çalışma zamanında çalışır. */
export const SESSION_COOKIE = 'anka_session';
export const SESSION_MAX_AGE = 30 * 86400; // 30 gün

async function hmacHex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(secret: string): Promise<string> {
  const exp = String(Date.now() + SESSION_MAX_AGE * 1000);
  return `${exp}.${await hmacHex(secret, exp)}`;
}

export async function verifySessionToken(secret: string, token?: string | null): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  const expected = await hmacHex(secret, exp);
  if (!safeEqual(sig, expected)) return false;
  return Number(exp) > Date.now();
}

export async function passwordMatches(input: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(input)), crypto.subtle.digest('SHA-256', enc.encode(expected))]);
  const ha = Array.from(new Uint8Array(a)).join(',');
  const hb = Array.from(new Uint8Array(b)).join(',');
  return safeEqual(ha, hb);
}
