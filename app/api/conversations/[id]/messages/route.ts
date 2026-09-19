import { api, body, status } from '@/lib/api';
import { inbox } from '@/lib/services';

export const GET = api((_req, { id }) => inbox.thread(id));

export const POST = api(async (req, { id }) => {
  const b = await body(req);
  const msg = await inbox.reply(id, b.text);
  return status(msg, msg.status === 'ok' ? 201 : 202);
});
