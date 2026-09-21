import { Loader2 } from 'lucide-react';

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden />;
}

/** Panel sayfaları için sayfa içi yükleniyor göstergesi (loading.tsx dosyaları kullanır). */
export function PageLoader({ text = 'Yükleniyor…' }: { text?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-neutral-500" role="status" aria-live="polite">
      <Spinner className="h-7 w-7 text-primary" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

/** Siyah üst barlı tam ekran sayfalar (sipariş detayı / form) için. */
export function FullscreenLoader({ text }: { text?: string }) {
  return (
    <div className="min-h-screen bg-page">
      <div className="h-14 bg-ink sm:h-16" />
      <PageLoader text={text} />
    </div>
  );
}
