import { api, body } from '@/lib/api';
import { messaging } from '@/lib/services';

const payload = async () => ({
  templates: await messaging.getTemplates(),
  placeholders: messaging.PLACEHOLDERS,
  auto: await messaging.getAutoFlags(),
  auto_labels: messaging.AUTO_LABELS,
});

export const GET = api(() => payload());

export const PUT = api(async (req) => {
  const b = await body(req);
  if (b.templates && typeof b.templates === 'object') {
    for (const [k, v] of Object.entries(b.templates)) await messaging.setTemplate(k, String(v));
  }
  if (b.auto && typeof b.auto === 'object') {
    for (const [k, v] of Object.entries(b.auto)) if (typeof v === 'boolean') await messaging.setAutoFlag(k, v);
  }
  return { ok: true, ...(await payload()) };
});
