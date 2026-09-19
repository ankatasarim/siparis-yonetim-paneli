import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="text-5xl">🪶</p>
      <h1 className="text-xl font-semibold">Sayfa bulunamadı</h1>
      <p className="text-neutral-500">Aradığınız kayıt silinmiş veya adres hatalı olabilir.</p>
      <Link href="/" className="btn btn-primary mt-2">Panele dön</Link>
    </div>
  );
}
