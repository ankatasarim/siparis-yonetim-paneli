'use client';
import Link from 'next/link';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const tables = /tablolar bulunamadı|schema cache|does not exist/i.test(error.message);
  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-6">
      <div className="card max-w-xl px-8 py-8">
        <p className="text-3xl">🪶</p>
        <h1 className="mt-2 text-xl font-semibold">Bir sorun oluştu</h1>
        <p className="mt-2 break-words text-sm text-neutral-700">{error.message}</p>
        {tables && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">Supabase tabloları henüz oluşturulmamış.</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Supabase panelinde <b>SQL Editor › New query</b> açın.</li>
              <li>Projedeki <code>supabase/schema.sql</code> dosyasının tamamını yapıştırın ve <b>Run</b> deyin.</li>
              <li>Bu sayfayı yenileyin.</li>
            </ol>
          </div>
        )}
        <div className="mt-5 flex gap-2">
          <button onClick={() => reset()} className="btn btn-primary">Tekrar dene</button>
          <Link href="/" className="btn">Panele dön</Link>
        </div>
      </div>
    </div>
  );
}
