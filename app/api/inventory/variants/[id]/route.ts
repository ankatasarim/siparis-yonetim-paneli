import { api, body } from '@/lib/api';
import { inventory } from '@/lib/services';

export const PUT = api(async (req, { id }) => inventory.setVariantSettings(id, await body(req)));
