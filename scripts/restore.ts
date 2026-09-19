/**
 * Yedek geri yükleme:  npm run restore -- yedek.json --evet
 * DATABASE_URL tanımlıysa Supabase'e, değilse yerel PGlite'a yazar. MEVCUT VERİLERİ SİLER.
 */
import fs from 'fs';

(async () => {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) { console.error('Kullanım: npm run restore -- yedek.json --evet'); process.exit(1); }
  if (!args.includes('--evet')) { console.error('Bu işlem mevcut verileri siler. Onaylamak için --evet ekleyin.'); process.exit(1); }
  const dump = JSON.parse(fs.readFileSync(file, 'utf8'));
  const db = await import('../lib/db');
  await db.ready();
  const backup = await import('../lib/services/backup');
  const counts = await backup.importJson(dump);
  console.log(`Geri yüklendi (${db.kind()}):`, counts);
  await db.close();
})().catch((e) => { console.error('Hata:', (e as Error).message); process.exit(1); });
