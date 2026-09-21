import { cfg } from '../../config';
import { httpError } from '../../utils';

/**
 * DHL eCommerce Türkiye API istemcisi (eski MNG Kargo altyapısı; dokümanlar: dhl/*.json).
 *
 * İki katmanlı kimlik doğrulama:
 *  1. Her istekte X-IBM-Client-Id / X-IBM-Client-Secret başlıkları (API portalındaki uygulama anahtarları)
 *  2. Identity API'den alınan JWT: POST /mngapi/api/token {customerNumber, password, identityType: 1}
 *     → Authorization: Bearer <jwt>. Token süresi dolana kadar bellekte tutulur; 401 gelirse bir kez yenilenip tekrar denenir.
 */

const HOSTS = { test: 'https://testapi.mngkargo.com.tr', prod: 'https://api.mngkargo.com.tr' } as const;
export const API_ROOT = '/mngapi/api';

type Token = { jwt: string; refreshToken: string; expiresAt: number };
const g = globalThis as unknown as { __dhlToken?: Token | null };

export function isConfigured(): boolean {
  const a = cfg.dhl.api;
  return cfg.dhl.mode === 'api' && Boolean(a.clientId && a.clientSecret && a.customerNo && a.password);
}

export function baseUrl(): string {
  return cfg.dhl.api.baseUrl || HOSTS[cfg.dhl.api.env];
}

function keyHeaders(): Record<string, string> {
  const a = cfg.dhl.api;
  return { 'X-IBM-Client-Id': a.clientId, 'X-IBM-Client-Secret': a.clientSecret, Accept: 'application/json' };
}

async function readBody(res: Response): Promise<{ text: string; data: any }> {
  const text = await res.text();
  try { return { text, data: text ? JSON.parse(text) : null }; } catch { return { text, data: null }; }
}

/** JWT içindeki exp alanı (ms). */
export function jwtExpiry(jwt: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch { return null; }
}

/** Identity API tarih biçimi "10.03.2020 16:05:00" (Türkiye saati, UTC+3) → epoch ms. */
export function parseTrDate(s: unknown): number | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(s || '').trim());
  if (!m) return null;
  return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] - 3, +m[5], +(m[6] || 0));
}

/** Hata gövdesini okunur tek satıra indirir (IBM ağ geçidi, ProblemDetails ve MNG biçimleri). */
export function describeError(data: any, text: string): string {
  const d = Array.isArray(data) ? data[0] : data;
  if (d && typeof d === 'object') {
    const parts = [d.title, d.detail, d.httpMessage, d.moreInformation, d.errorMessage, d.message, d.description, d.code != null ? `kod ${d.code}` : '']
      .filter((x) => x != null && String(x).trim() !== '').map(String);
    if (parts.length) return parts.join(' · ').slice(0, 300);
  }
  return (text || '').replace(/\s+/g, ' ').trim().slice(0, 300) || 'yanıt gövdesi boş';
}

export async function getToken(force = false): Promise<string> {
  const cached = g.__dhlToken;
  if (!force && cached && cached.expiresAt - Date.now() > 60_000) return cached.jwt;
  const a = cfg.dhl.api;
  const res = await fetch(`${baseUrl()}${API_ROOT}/token`, {
    method: 'POST',
    headers: { ...keyHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerNumber: a.customerNo, password: a.password, identityType: 1 }),
    signal: AbortSignal.timeout(15000),
  });
  const { text, data } = await readBody(res);
  if (!res.ok) throw httpError(502, `DHL API oturumu açılamadı (${res.status}): ${describeError(data, text)}`);
  const jwt = data && typeof data.jwt === 'string' ? data.jwt : '';
  if (!jwt) throw httpError(502, `DHL API token yanıtı beklenmedik: ${text.slice(0, 200)}`);
  const expiresAt = jwtExpiry(jwt) ?? parseTrDate(data.jwtExpireDate) ?? Date.now() + 20 * 60_000;
  g.__dhlToken = { jwt, refreshToken: String(data.refreshToken || ''), expiresAt };
  return jwt;
}

export function clearToken() { g.__dhlToken = null; }

/** Yetkili istek: API_ROOT altındaki yola JSON gönderir, JSON döner. 401'de token'ı yenileyip bir kez daha dener. */
export async function request<T = any>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown, retried = false): Promise<T> {
  if (!isConfigured()) throw httpError(400, 'DHL API modu yapılandırılmadı (DHL_MODE=api ve DHL_API_CLIENT_ID, DHL_API_CLIENT_SECRET, DHL_API_CUSTOMER_NO, DHL_API_PASSWORD gerekli)');
  const token = await getToken(retried);
  const headers: Record<string, string> = { ...keyHeaders(), Authorization: `Bearer ${token}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${baseUrl()}${API_ROOT}${path}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000),
  });
  const { text, data } = await readBody(res);
  if (res.status === 401 && !retried) { clearToken(); return request<T>(method, path, body, true); }
  if (!res.ok) throw httpError(502, `DHL API hatası (${res.status} ${method} ${path}): ${describeError(data, text)}`);
  return data as T;
}
