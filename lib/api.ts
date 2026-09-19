import { NextRequest, NextResponse } from 'next/server';
import { ready } from './db';
import './services/messaging';

type Ctx = { params: Promise<Record<string, string>> };
type Handler = (req: NextRequest, ctx: Ctx & { id: number }) => Promise<unknown> | unknown;

/** Route handler sarmalayıcı: veritabanını hazırlar, hataları JSON'a çevirir, :id parametresini sayıya çevirir. */
export function api(fn: Handler) {
  return async (req: NextRequest, ctx: Ctx) => {
    try {
      await ready();
      const params = ctx && ctx.params ? await ctx.params : {};
      let id = NaN;
      if (params.id !== undefined) {
        id = parseInt(params.id, 10);
        if (!Number.isFinite(id)) return NextResponse.json({ error: 'Geçersiz kimlik' }, { status: 400 });
      }
      const r = await fn(req, { params: Promise.resolve(params), id });
      if (r instanceof Response) return r;
      return NextResponse.json(r ?? { ok: true });
    } catch (e) {
      const err = e as Error & { status?: number };
      const status = err.status || 500;
      if (status >= 500) console.error('[api]', err);
      return NextResponse.json({ error: err.message || 'Sunucu hatası' }, { status });
    }
  };
}

export async function body<T = Record<string, any>>(req: NextRequest): Promise<T> {
  try { return (await req.json()) as T; } catch { return {} as T; }
}

export const status = (data: unknown, code: number) => NextResponse.json(data, { status: code });
