import { api } from '@/lib/api';
import { inbox } from '@/lib/services';

export const GET = api(() => inbox.conversations());
