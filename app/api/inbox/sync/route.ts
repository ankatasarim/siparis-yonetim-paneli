import { api } from '@/lib/api';
import { inbox } from '@/lib/services';

/** Gelen Kutusu › "Instagram'dan çek": son sohbetleri ve mesajları Conversations API ile alır. */
export const maxDuration = 60;
export const POST = api(async () => inbox.syncFromInstagram({ conversations: 25, messages: 20 }));
