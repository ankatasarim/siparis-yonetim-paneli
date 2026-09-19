import { NextResponse } from 'next/server';
import { cfg } from '@/lib/config';
import { isAuthenticated } from '@/lib/auth-server';

export async function GET() {
  return NextResponse.json({ auth_required: Boolean(cfg.panelPassword), authenticated: await isAuthenticated(), business: cfg.business.name });
}
