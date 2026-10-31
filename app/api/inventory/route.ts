import { api, body } from '@/lib/api';
import { inventory } from '@/lib/services';

export const GET = api(() => inventory.overview());
export const POST = api(async (req) => inventory.recordMovement(await body(req)));
