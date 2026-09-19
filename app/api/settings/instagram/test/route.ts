import { api } from '@/lib/api';
import { instagram } from '@/lib/services';
import { httpError } from '@/lib/utils';

export const POST = api(async () => {
  if (!(await instagram.isConfigured())) throw httpError(400, "Instagram erişim token'ı tanımlı değil");
  return instagram.me();
});
