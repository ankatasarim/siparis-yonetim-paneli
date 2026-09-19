/**
 * Sunucu başlarken bir kez çalışır (kendi sunucunuzda): veritabanını hazırlar, zamanlayıcıları başlatır.
 * Vercel'de (serverless) zamanlayıcı çalışmaz; işler /api/cron üzerinden tetiklenir.
 * Not: Node modülleri bu `if` bloğunun içinde kalmalı; Next edge derlemesinde bu dal atılır.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.VERCEL) return;
    try {
      const { ready } = await import('./lib/db');
      await ready();
      await import('./lib/services/messaging');
      const automation = await import('./lib/services/automation');
      automation.start();
    } catch (e) {
      console.error('[başlangıç] veritabanı hazırlanamadı:', (e as Error).message);
    }
  }
}
