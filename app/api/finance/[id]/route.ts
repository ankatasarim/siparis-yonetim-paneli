import { api, body } from '@/lib/api';
import { finance } from '@/lib/services';

export const PUT = api(async (req, { id }) => finance.update(id, await body(req)));
export const DELETE = api((_req, { id }) => finance.remove(id));
