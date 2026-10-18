import { api, body, status } from '@/lib/api';
import { accounts } from '@/lib/services';

export const GET = api((req) => accounts.list(req.nextUrl.searchParams.get('customer_id')));
export const POST = api(async (req) => status(await accounts.create(await body(req)), 201));
