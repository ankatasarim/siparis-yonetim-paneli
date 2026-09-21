'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Home, Package, Tag, Users, Inbox, Settings, PanelLeftClose, PanelLeftOpen, Instagram, Globe, LogOut, Plus, Feather } from 'lucide-react';
import { api } from '@/lib/client';
import { money, initials } from '@/lib/format';

const NAV = [
  { href: '/', label: 'Giriş', icon: Home },
  { href: '/siparisler', label: 'Siparişler', icon: Package },
  { href: '/urunler', label: 'Ürünler', icon: Tag },
  { href: '/musteriler', label: 'Müşteriler', icon: Users },
  { href: '/mesajlar', label: 'Gelen Kutusu', icon: Inbox, badge: true },
  { href: '/ayarlar', label: 'Ayarlar', icon: Settings },
];

interface Stats { unread: number; month_revenue: number; month_count: number }

export function Sidebar({ business, owner, igHandle, website, authRequired }: { business: string; owner: string; igHandle: string; website: string; authRequired: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => { try { setCollapsed(localStorage.getItem('anka-sidebar') === '1'); } catch { /* yok */ } }, []);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try { const d = await api.get('/api/dashboard'); if (alive) setStats({ unread: d.attention.unread, month_revenue: d.month_revenue, month_count: d.month_count }); } catch { /* sessiz */ }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [pathname]);

  const toggle = () => { const v = !collapsed; setCollapsed(v); try { localStorage.setItem('anka-sidebar', v ? '1' : '0'); } catch { /* yok */ } };
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/giris'); router.refresh(); };

  const navItems = NAV.map(({ href, label, icon: Icon, badge }) => (
    <Link key={href} href={href} title={label}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${isActive(href) ? 'bg-ink-soft text-white' : 'text-neutral-400 hover:bg-ink-soft hover:text-white'}`}>
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
      {badge && stats && stats.unread > 0 && <span className={`rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white ${collapsed ? '-ml-4 -mt-5' : 'ml-auto'}`}>{stats.unread}</span>}
    </Link>
  ));

  return (
    <>
      {/* Masaüstü kenar çubuğu */}
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-ink text-neutral-300 transition-[width] duration-200 md:flex ${collapsed ? 'w-[72px]' : 'w-60'}`}>
        <div className={`flex items-center px-4 py-5 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && <Link href="/" className="flex items-center gap-2 text-[17px] font-bold text-white"><Feather className="h-5 w-5 text-primary" />{business}</Link>}
          <button onClick={toggle} className="rounded-md p-1.5 text-neutral-500 hover:bg-ink-soft hover:text-white" title={collapsed ? 'Genişlet' : 'Daralt'}>
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-3">{navItems}</nav>

        {!collapsed && (
          <div className="mt-6 px-3">
            <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wide text-neutral-500">Satış Kanalları</p>
            {igHandle && <a href={`https://instagram.com/${igHandle}`} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-400 hover:bg-ink-soft hover:text-white"><Instagram className="h-[18px] w-[18px] text-pink-500" /><span className="truncate">@{igHandle}</span></a>}
            {website && <a href={`https://${website}`} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-400 hover:bg-ink-soft hover:text-white"><Globe className="h-[18px] w-[18px]" /><span className="truncate">{website}</span></a>}
          </div>
        )}

        <div className="mt-auto space-y-3 p-3">
          <Link href="/siparisler/yeni" className={`btn btn-primary w-full ${collapsed ? 'px-0' : ''}`} title="Sipariş oluştur"><Plus className="h-4 w-4" />{!collapsed && 'Sipariş Oluştur'}</Link>
          {!collapsed && stats && (
            <div className="rounded-lg bg-ink-soft px-3 py-2.5">
              <p className="text-[11px] text-neutral-500">Bu ay</p>
              <p className="text-lg font-semibold text-white">{money(stats.month_revenue)}</p>
              <p className="text-[11px] text-neutral-500">{stats.month_count} sipariş</p>
            </div>
          )}
          <div className={`flex items-center gap-2.5 border-t border-ink-line pt-3 ${collapsed ? 'justify-center' : ''}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">{initials(owner || business)}</div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{owner || business}</p>
                <p className="truncate text-[11px] text-neutral-500">{business}</p>
              </div>
            )}
            {authRequired && <button onClick={logout} className="rounded-md p-1.5 text-neutral-500 hover:bg-ink-soft hover:text-white" title="Çıkış"><LogOut className="h-4 w-4" /></button>}
          </div>
        </div>
      </aside>

      {/* Mobil üst çubuk */}
      <div className="sticky top-0 z-30 flex items-center gap-1 overflow-x-auto bg-ink px-2 py-2 text-neutral-300 md:hidden">
        <Link href="/" className="mr-2 flex items-center gap-1.5 whitespace-nowrap px-2 font-bold text-white"><Feather className="h-4 w-4 text-primary" />{business}</Link>
        {NAV.map(({ href, label, icon: Icon, badge }) => (
          <Link key={href} href={href} title={label} className={`relative rounded-md p-2 ${isActive(href) ? 'bg-ink-soft text-white' : ''}`}>
            <Icon className="h-5 w-5" />
            {badge && stats && stats.unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-primary px-1 text-[9px] font-semibold text-white">{stats.unread}</span>}
          </Link>
        ))}
        <Link href="/siparisler/yeni" className="ml-auto rounded-md bg-primary p-2 text-white"><Plus className="h-5 w-5" /></Link>
      </div>
    </>
  );
}
