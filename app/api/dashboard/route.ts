import { api } from '@/lib/api';
import { orders } from '@/lib/services';

export const GET = api(() => orders.dashboard());
