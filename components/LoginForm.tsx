'use client';
import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Feather } from 'lucide-react';

export function LoginForm({ business, passwordSet }: { business: string; passwordSet: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error || 'Giriş başarısız'); return; }
    const next = sp.get('next') || '/';
    router.push(next.startsWith('/') ? next : '/');
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="card w-full max-w-sm px-6 py-7 sm:px-8 sm:py-8">
      <div className="mb-1 flex items-center justify-center gap-2 text-xl font-bold"><Feather className="h-6 w-6 text-primary" />{business}</div>
      <p className="mb-6 text-center text-sm text-neutral-500">Sipariş takip paneline giriş</p>
      {!passwordSet && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Panel şifresi tanımlanmamış.</p>
          <p className="mt-1">Güvenlik için panel şifre olmadan açılmaz. Vercel › Settings › Environment Variables bölümüne <code>PANEL_PASSWORD</code> ve <code>SESSION_SECRET</code> ekleyip yeniden yayınlayın (<code>npx vercel --prod</code>).</p>
        </div>
      )}
      <label className="label">Panel şifresi</label>
      <input type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={!passwordSet} className="input" />
      <button type="submit" disabled={busy || !password || !passwordSet} className="btn btn-primary mt-4 w-full">Giriş yap</button>
      {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
      <p className="mt-4 text-center text-xs text-neutral-400">Oturum 2 gün sonra kendiliğinden kapanır.</p>
    </form>
  );
}
