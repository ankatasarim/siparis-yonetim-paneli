import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth-server';
import { cfg } from '@/lib/config';
import { LoginForm } from '@/components/LoginForm';

export default async function LoginPage() {
  if (await isAuthenticated()) redirect('/');
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-soft via-page to-page p-4">
      <Suspense><LoginForm business={cfg.business.name} /></Suspense>
    </div>
  );
}
