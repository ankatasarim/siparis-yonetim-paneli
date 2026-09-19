'use client';
import Link from 'next/link';

const HINTS: Record<string, { title: string; steps: string[] }> = {
  ANKA_CONFIG: {
    title: 'Supabase ayarları eksik.',
    steps: [
      'Vercel › projeniz › Settings › Environment Variables bölümüne SUPABASE_URL ve SUPABASE_PUBLISHABLE_KEY (veya SUPABASE_SECRET_KEY) ekleyin.',
      'PANEL_PASSWORD, SESSION_SECRET, CRON_SECRET ve BASE_URL değerlerini de girin.',
      'Deployments › son yayın › Redeploy deyin (ortam değişkenleri yeni yayında etkinleşir).',
    ],
  },
  ANKA_TABLE: {
    title: 'Supabase tabloları henüz oluşturulmamış.',
    steps: ['Supabase panelinde SQL Editor › New query açın.', 'Projedeki supabase/schema.sql dosyasının tamamını yapıştırın ve Run deyin.', 'Bu sayfayı yenileyin.'],
  },
  ANKA_AUTH: {
    title: 'Supabase erişimi reddedildi.',
    steps: ['Vercel’deki SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY değerinin projenizin anahtarı olduğundan emin olun.', 'supabase/schema.sql dosyasını SQL Editor’de çalıştırdığınızdan emin olun (anon politikaları erişimi açar).'],
  },
};

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const digest = error.digest || '';
  const key = Object.keys(HINTS).find((k) => digest.startsWith(k)) || (digest.startsWith('ANKA_DB') ? 'ANKA_DB' : '');
  const hint = key ? HINTS[key] : null;
  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-6">
      <div className="card max-w-xl px-8 py-8">
        <p className="text-3xl">🪶</p>
        <h1 className="mt-2 text-xl font-semibold">Bir sorun oluştu</h1>
        {hint ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">{hint.title}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">{hint.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </div>
        ) : digest.startsWith('ANKA_DB') ? (
          <p className="mt-3 text-sm text-neutral-700">Supabase veritabanı hatası ({digest.replace('ANKA_DB:', '') || 'kod yok'}). Ayarları ve şemayı kontrol edin.</p>
        ) : (
          <p className="mt-3 break-words text-sm text-neutral-700">{error.message}</p>
        )}
        <p className="mt-3 text-xs text-neutral-500">Teşhis için <a href="/health" className="underline">/health</a> adresine bakabilirsiniz{digest ? ` · kod: ${digest}` : ''}.</p>
        <div className="mt-5 flex gap-2">
          <button onClick={() => reset()} className="btn btn-primary">Tekrar dene</button>
          <Link href="/" className="btn">Panele dön</Link>
        </div>
      </div>
    </div>
  );
}
