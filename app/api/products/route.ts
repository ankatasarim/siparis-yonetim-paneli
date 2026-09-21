import { api, body, status } from '@/lib/api';
import { products } from '@/lib/services';

export const GET = api((req) => {
  const sp = req.nextUrl.searchParams;
  const a = sp.get('active');
  return products.list({ q: sp.get('q'), active: a == null || a === '' ? null : a === '1' || a === 'true' });
});

export const POST = api(async (req) => status(await products.create(await body(req)), 201));
