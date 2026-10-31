import { api, body } from '@/lib/api';
import { customers } from '@/lib/services';

export const POST = api(async (req) => {
  const data = await body(req);
  return await customers.findMatch(data);
});
