import { api, body } from '@/lib/api';
import { products } from '@/lib/services';
import { httpError } from '@/lib/utils';

export const GET = api(async (_req, { id }) => {
  const p = await products.get(id);
  if (!p) throw httpError(404, 'Ürün bulunamadı');
  return p;
});

export const PUT = api(async (req, { id }) => products.update(id, await body(req)));

export const DELETE = api(async (_req, { id }) => {
  await products.remove(id);
  return { ok: true };
});
