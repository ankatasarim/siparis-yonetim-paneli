import { api } from '@/lib/api';
import { inbox } from '@/lib/services';

export const POST = api(async (_req, { id }) => {
  await inbox.markRead(id);
  return { ok: true };
});
