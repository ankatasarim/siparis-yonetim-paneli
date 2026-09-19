import { api } from '@/lib/api';
import { instagram } from '@/lib/services';
import { httpError } from '@/lib/utils';

/** Ayarlar › "Webhook'a abone ol": hesabı messages alanına abone eder ve durumu döner. */
export const POST = api(async () => {
  if (!(await instagram.isConfigured())) throw httpError(400, "Instagram erişim token'ı tanımlı değil");
  const result = await instagram.subscribeWebhooks();
  const status = await instagram.subscriptionStatus().catch(() => ({ data: [] }));
  const fields = (status.data || []).flatMap((a) => a.subscribed_fields || []);
  return { ok: Boolean(result.success), fields };
});
