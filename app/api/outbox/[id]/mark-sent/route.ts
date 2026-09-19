import { api } from '@/lib/api';
import { messaging } from '@/lib/services';

export const POST = api((_req, { id }) => messaging.markManualSent(id));
