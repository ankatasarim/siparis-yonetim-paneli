import { api, body } from '@/lib/api';
import { db } from '@/lib/services';
import { httpError } from '@/lib/utils';

export const POST = api(async (req) => {
  const b = await body(req);
  const t = String(b.access_token || '').trim();
  if (!t) throw httpError(400, 'Token boş');
  await db.setSetting('ig_access_token', t);
  await db.setSetting('ig_token_refreshed_at', new Date().toISOString());
  return { ok: true };
});
