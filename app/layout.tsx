import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import './globals.css';
import { ToastProvider } from '@/components/Toast';
import { NavProgress } from '@/components/NavProgress';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Anka Tasarım · Sipariş Takip',
  description: 'Instagram ve DHL eCommerce ile entegre sipariş takip paneli',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <Suspense fallback={null}><NavProgress /></Suspense>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
