import { api } from '@/lib/api';
import { instagram } from '@/lib/services';
import { httpError } from '@/lib/utils';

export const POST = api(async () => {
  if (!(await instagram.isConfigured())) throw httpError(400, "Instagram erişim token'ı tanımlı değil");
  const r = await instagram.refreshToken();
  return { ok: true, expires_in: r.expires_in };
});
