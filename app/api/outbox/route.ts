import { api } from '@/lib/api';
import { messaging } from '@/lib/services';

export const GET = api(() => messaging.listPending());
