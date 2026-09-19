import crypto from 'crypto';
import { cfg } from '../config';
import * as db from '../db';

/**
 * Instagram Mesajlaşma API'si (Instagram API with Instagram Login)
 * https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api
 */

export class InstagramError extends Error {
  code?: number;
  subcode?: number;
  outsideWindow = false;
  status?: number;
}

export async function token(): Promise<string> {
  return (await db.getSetting('ig_access_token')) || cfg.instagram.accessToken || '';
}

export async function isConfigured(): Promise<boolean> {
  return Boolean(await token());
}

async function call<T = any>(url: string, init: RequestInit = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    const err = new InstagramError(`Instagram API: bağlantı hatası (${(e as Error).message})`);
    err.status = 502;
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const d = data.error || {};
    const err = new InstagramError(`Instagram API: ${d.message || res.statusText} (code ${d.code ?? res.status}${d.error_subcode ? '/' + d.error_subcode : ''})`);
    err.code = d.code;
    err.subcode = d.error_subcode;
    err.status = res.status;
    err.outsideWindow = d.error_subcode === 2534022 || /window|24 ?hour/i.test(d.message || '');
    throw err;
  }
  return data as T;
}

/** Metin mesajı gönderir. `tag: 'HUMAN_AGENT'` 24 saat penceresi dışına çıkmak için (izin gerektirir). */
export async function sendText(igsid: string, text: string, opts: { tag?: string } = {}): Promise<{ recipient_id?: string; message_id?: string }> {
  const body: Record<string, unknown> = { recipient: { id: String(igsid) }, message: { text: String(text) } };
  if (opts.tag) { body.messaging_type = 'MESSAGE_TAG'; body.tag = opts.tag; }
  return call(`${cfg.instagram.apiBase}/me/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getProfile(igsid: string): Promise<{ name?: string; username?: string; profile_pic?: string }> {
  const p = new URLSearchParams({ fields: 'name,username,profile_pic', access_token: await token() });
  return call(`${cfg.instagram.apiBase}/${igsid}?${p}`);
}

export async function me(): Promise<{ id: string; username?: string; name?: string; account_type?: string }> {
  const p = new URLSearchParams({ fields: 'id,username,name,account_type', access_token: await token() });
  return call(`${cfg.instagram.apiBase}/me?${p}`);
}

/** Uzun ömürlü Instagram token'ını yeniler (60 gün). */
export async function refreshToken(): Promise<{ access_token?: string; expires_in?: number }> {
  const p = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: await token() });
  const data = await call<{ access_token?: string; expires_in?: number }>(`https://graph.instagram.com/refresh_access_token?${p}`);
  if (data.access_token) {
    await db.setSetting('ig_access_token', data.access_token);
    await db.setSetting('ig_token_refreshed_at', new Date().toISOString());
    await db.setSetting('ig_token_expires_in', String(data.expires_in || ''));
  }
  return data;
}

export interface IgParticipant { id: string; username?: string }
export interface IgConversation { id: string; updated_time?: string; participants?: { data: IgParticipant[] } }
export interface IgMessage {
  id: string;
  created_time: string;
  from?: IgParticipant;
  to?: { data: IgParticipant[] };
  message?: string;
  attachments?: { data?: Array<{ id?: string; mime_type?: string; name?: string; file_url?: string; image_data?: { url?: string }; video_data?: { url?: string } }> };
}

/** Kendi hesabımız: id, user_id (profesyonel hesap kimliği) ve kullanıcı adı. */
export async function meFull(): Promise<{ id: string; user_id?: string; username?: string; name?: string }> {
  const p = new URLSearchParams({ fields: 'id,user_id,username,name', access_token: await token() });
  return call(`${cfg.instagram.apiBase}/me?${p}`);
}

/** Son sohbetler (Conversations API). */
export async function listConversations(limit = 20): Promise<IgConversation[]> {
  const p = new URLSearchParams({ platform: 'instagram', fields: 'id,updated_time,participants', limit: String(limit), access_token: await token() });
  const r = await call<{ data?: IgConversation[] }>(`${cfg.instagram.apiBase}/me/conversations?${p}`);
  return r.data || [];
}

/** Bir sohbetin son mesajları (Meta yalnızca son 20 mesajın içeriğini verir). */
export async function listMessages(conversationId: string, limit = 20): Promise<IgMessage[]> {
  const fields = 'id,created_time,from,to,message,attachments';
  try {
    const p = new URLSearchParams({ fields, limit: String(limit), access_token: await token() });
    const r = await call<{ data?: IgMessage[] }>(`${cfg.instagram.apiBase}/${conversationId}/messages?${p}`);
    return r.data || [];
  } catch {
    // Yedek yol: önce kimlikler, sonra tek tek içerik
    const p = new URLSearchParams({ fields: 'messages', access_token: await token() });
    const r = await call<{ messages?: { data?: { id: string; created_time: string }[] } }>(`${cfg.instagram.apiBase}/${conversationId}?${p}`);
    const ids = (r.messages?.data || []).slice(0, limit);
    const out: IgMessage[] = [];
    for (const m of ids) {
      try {
        const q = new URLSearchParams({ fields, access_token: await token() });
        out.push(await call<IgMessage>(`${cfg.instagram.apiBase}/${m.id}?${q}`));
      } catch { /* eski mesajların içeriği verilmez */ }
    }
    return out;
  }
}

/** Hesabı webhook alanlarına abone eder (anlık bildirim istenirse; düğmeyle çekme için gerekmez). */
export async function subscribeWebhooks(): Promise<{ success?: boolean }> {
  const p = new URLSearchParams({ subscribed_fields: 'messages,messaging_postbacks,messaging_seen', access_token: await token() });
  return call(`${cfg.instagram.apiBase}/me/subscribed_apps?${p}`, { method: 'POST' });
}

export async function subscriptionStatus(): Promise<{ data?: { id?: string; name?: string; subscribed_fields?: string[] }[] }> {
  const p = new URLSearchParams({ access_token: await token() });
  return call(`${cfg.instagram.apiBase}/me/subscribed_apps?${p}`);
}

export function verifySignature(rawBody: string | Buffer, sigHeader?: string | null): boolean {
  if (!cfg.instagram.appSecret) return true; // secret tanımlı değilse doğrulama yapılmaz (geliştirme)
  if (!sigHeader || rawBody == null) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', cfg.instagram.appSecret).update(rawBody).digest('hex');
  const a = Buffer.from(String(sigHeader));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface WebhookMessage {
  type: 'message';
  senderId: string | null;
  recipientId: string | null;
  timestamp: number;
  mid: string | null;
  text: string;
  attachments: { type: string; url: string | null }[];
  isEcho: boolean;
  isDeleted: boolean;
}
export type WebhookEvent = WebhookMessage | { type: 'read' | 'reaction' | 'postback' | 'other'; senderId: string | null; recipientId: string | null; timestamp: number; [k: string]: unknown };

/** Webhook gövdesini sade olay listesine çevirir. */
export function parseWebhook(body: any): WebhookEvent[] {
  const out: WebhookEvent[] = [];
  if (!body || !Array.isArray(body.entry)) return out;
  if (body.object && !['instagram', 'page'].includes(body.object)) return out;
  for (const entry of body.entry) {
    for (const ev of entry.messaging || []) {
      const base = {
        senderId: ev.sender && ev.sender.id ? String(ev.sender.id) : null,
        recipientId: ev.recipient && ev.recipient.id ? String(ev.recipient.id) : null,
        timestamp: ev.timestamp ? Number(ev.timestamp) : Date.now(),
      };
      if (ev.message) {
        out.push({
          type: 'message', ...base,
          mid: ev.message.mid || null,
          text: ev.message.text || '',
          attachments: (ev.message.attachments || []).map((a: any) => ({ type: a.type, url: a.payload && a.payload.url ? a.payload.url : null })),
          isEcho: Boolean(ev.message.is_echo),
          isDeleted: Boolean(ev.message.is_deleted),
        });
      } else if (ev.read) out.push({ type: 'read', ...base, mid: ev.read.mid || null });
      else if (ev.reaction) out.push({ type: 'reaction', ...base, mid: ev.reaction.mid, reaction: ev.reaction.reaction });
      else if (ev.postback) out.push({ type: 'postback', ...base, payload: ev.postback.payload });
      else out.push({ type: 'other', ...base, raw: ev });
    }
  }
  return out;
}

export async function status() {
  const saved = await db.getSetting('ig_access_token');
  return {
    configured: Boolean(saved || cfg.instagram.accessToken),
    token_source: saved ? 'panelden kaydedildi' : cfg.instagram.accessToken ? '.env' : 'yok',
    app_secret_set: Boolean(cfg.instagram.appSecret),
    verify_token: cfg.instagram.verifyToken,
    webhook_url: `${cfg.baseUrl}/webhooks/instagram`,
    api_base: cfg.instagram.apiBase,
    token_refreshed_at: await db.getSetting('ig_token_refreshed_at'),
    human_agent_tag: cfg.instagram.humanAgentTag,
    handle: cfg.business.igHandle,
  };
}
