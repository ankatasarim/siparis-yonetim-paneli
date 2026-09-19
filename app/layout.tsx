import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { ToastProvider } from '@/components/Toast';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Anka Tasarım · Sipariş Takip',
  description: 'Instagram ve DHL eCommerce ile entegre sipariş takip paneli',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
