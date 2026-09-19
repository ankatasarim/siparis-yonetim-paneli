import Link from 'next/link';
import { Suspense } from 'react';
import { Instagram, Users, ChevronRight } from 'lucide-react';
import { ready, customers } from '@/lib/services';
import { PageHeader } from '@/components/PageHeader';
import { SearchBox } from '@/components/SearchBox';
import { RowLink } from '@/components/RowLink';
import { Avatar, Empty } from '@/components/ui';
import { money, fmtDay } from '@/lib/format';

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await ready();
  const list = await customers.list({ q: sp.q, limit: 300 });
  return (
    <>
      <PageHeader title="Müşteriler" info="Instagram'dan yazan herkes otomatik müşteri olarak eklenir." actions={<Link href="/musteriler/yeni" className="btn btn-primary">Müşteri Oluştur</Link>} />
      <div className="mb-4"><Suspense><SearchBox placeholder="İsim, telefon, @instagram, şehir…" className="w-full max-w-xs" /></Suspense></div>

      {/* Mobil: kart listesi */}
      <div className="space-y-3 md:hidden">
        {list.map((c) => (
          <Link key={c.id} href={`/musteriler/${c.id}`} className="card flex items-center gap-3 px-4 py-3">
            <Avatar name={c.name || c.ig_username} src={c.profile_pic} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.name || <span className="text-neutral-400">isimsiz</span>}{c.unread > 0 && <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">{c.unread}</span>}</p>
              <p className="truncate text-xs text-neutral-500">{[c.phone, c.ig_username ? '@' + c.ig_username : '', [c.district, c.city].filter(Boolean).join(' / ')].filter(Boolean).join(' · ') || '—'}</p>
              <p className="text-xs text-neutral-500">{c.order_count} sipariş · {money(c.total_spent)}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
          </Link>
        ))}
        {!list.length && <div className="card"><Empty icon={<Users className="mx-auto h-8 w-8 text-neutral-300" />} title="Müşteri bulunamadı" /></div>}
      </div>

      {/* Masaüstü: tablo */}
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead><tr><th className="th">Müşteri</th><th className="th">Instagram</th><th className="th">Telefon</th><th className="th">Konum</th><th className="th">Sipariş</th><th className="th">Toplam</th><th className="th">Son sipariş</th></tr></thead>
            <tbody>
              {list.map((c) => (
                <RowLink key={c.id} href={`/musteriler/${c.id}`}>
                  <td className="td"><div className="flex items-center gap-3"><Avatar name={c.name || c.ig_username} src={c.profile_pic} size="sm" /><div><div className="font-medium">{c.name || <span className="text-neutral-400">isimsiz</span>}{c.unread > 0 && <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">{c.unread}</span>}</div><div className="text-xs text-neutral-500">{c.email}</div></div></div></td>
                  <td className="td">{c.ig_username ? <span className="inline-flex items-center gap-1"><Instagram className="h-3.5 w-3.5 text-pink-600" />@{c.ig_username}</span> : <span className="text-neutral-400">—</span>}{c.ig_user_id && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">bağlı</span>}</td>
                  <td className="td">{c.phone || <span className="text-neutral-400">—</span>}</td>
                  <td className="td">{[c.district, c.city].filter(Boolean).join(' / ') || <span className="text-neutral-400">—</span>}</td>
                  <td className="td">{c.order_count}</td>
                  <td className="td font-medium">{money(c.total_spent)}</td>
                  <td className="td text-neutral-600">{fmtDay(c.last_order_at) || '—'}</td>
                </RowLink>
              ))}
              {!list.length && <tr><td colSpan={7} className="td"><Empty icon={<Users className="mx-auto h-8 w-8 text-neutral-300" />} title="Müşteri bulunamadı" /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
