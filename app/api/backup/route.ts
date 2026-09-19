import { api } from '@/lib/api';
import { backup } from '@/lib/services';

/** Tüm verilerin JSON yedeğini indirir (panel oturumu gerektirir). */
export const GET = api(async () => {
  const dump = await backup.exportJson();
  return new Response(JSON.stringify(dump, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="siparis-yedek-${dump.exported_at.slice(0, 10)}.json"`,
    },
  });
});
