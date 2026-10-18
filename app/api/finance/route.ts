import { api, body, status } from '@/lib/api';
import { finance } from '@/lib/services';

export const GET = api((req) => finance.list(req.nextUrl.searchParams.get('month')));
export const POST = api(async (req) => status(await finance.create(await body(req)), 201));
