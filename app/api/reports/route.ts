import { api } from '@/lib/api';
import { reports } from '@/lib/services';

export const GET = api((req) => reports.get(req.nextUrl.searchParams.get('from'), req.nextUrl.searchParams.get('to')));