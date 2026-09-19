import { api, body, status } from '@/lib/api';
import { customers } from '@/lib/services';

export const GET = api((req) => {
  const sp = req.nextUrl.searchParams;
  return customers.list({ q: sp.get('q'), limit: sp.get('limit') || 200 });
});

export const POST = api(async (req) => status(await customers.create(await body(req)), 201));
