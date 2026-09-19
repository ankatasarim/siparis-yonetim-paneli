import { api } from '@/lib/api';
import { automation } from '@/lib/services';

/** Ayarlar › "Şimdi çalıştır": zamanlanmış işleri panel oturumuyla elle tetikler. */
export const maxDuration = 60;
export const POST = api(async () => automation.runAll());
