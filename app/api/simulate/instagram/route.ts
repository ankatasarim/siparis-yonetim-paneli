import { api, body } from '@/lib/api';
import { inbox } from '@/lib/services';

export const POST = api(async (req) => inbox.simulateIncoming(await body(req)));
