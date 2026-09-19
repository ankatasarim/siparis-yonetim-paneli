'use client';
import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Feather } from 'lucide-react';

export function LoginForm({ business }: { business: string }) {
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
    <form onSubmit={submit} className="card w-full max-w-sm px-8 py-8">
      <div className="mb-1 flex items-center justify-center gap-2 text-xl font-bold"><Feather className="h-6 w-6 text-primary" />{business}</div>
      <p className="mb-6 text-center text-sm text-neutral-500">Sipariş takip paneline giriş</p>
      <label className="label">Panel şifresi</label>
      <input type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
      <button type="submit" disabled={busy || !password} className="btn btn-primary mt-4 w-full">Giriş yap</button>
      {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
    </form>
  );
}
