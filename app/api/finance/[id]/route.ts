import { api } from '@/lib/api';
import { finance } from '@/lib/services';

export const DELETE = api((_req, { id }) => finance.remove(id));
