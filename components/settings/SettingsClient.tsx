'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, ExternalLink, RefreshCw, Plug, Send, Instagram, Truck, Bell, FlaskConical, Server, Database, Download, Play } from 'lucide-react';
import { api, copyText } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { Card, Field } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import type { OutboxRow } from '@/lib/services/messaging';

interface Props {
  status: any;
  settings: { templates: Record<string, { label: string; text: string; default: string }>; placeholders: Record<string, string>; auto: Record<string, boolean>; auto_labels: Record<string, string> };
  outbox: OutboxRow[];
}

const Dot = ({ on }: { on: boolean }) => <span className={`inline-block h-2.5 w-2.5 rounded-full ${on ? 'bg-emerald-500' : 'bg-red-500'}`} />;

export function SettingsClient({ status: st, settings: s, outbox }: Props) {
  const router = useRouter();
  const { toast, fail } = useToast();
  const [templates, setTemplates] = useState<Record<string, string>>(Object.fromEntries(Object.entries(s.templates).map(([k, v]) => [k, v.text])));
  const [auto, setAuto] = useState<Record<string, boolean>>(s.auto);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState('');
  const [sim, setSim] = useState({ igsid: 'test-1001', username: 'ayse.demir', name: 'Ayşe Demir', text: 'Merhaba, isimli kolyeden 2 adet istiyorum. Gümüş olsun, üzerine "Elif" yazsın 🙏' });
  const ig = st.instagram; const dhl = st.dhl; const b = st.backup; const cron = st.cron;
  const cronUrl = cron.configured ? `${cron.url}?secret=${cron.secret}` : cron.url;

  const act = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn(); } catch (e) { fail(e); } setBusy(''); };
  const copy = async (t: string) => { if (await copyText(t)) toast('Kopyalandı', 'ok'); };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title={<><Instagram className="h-4 w-4 text-pink-600" />Instagram mesajlaşma <Dot on={ig.configured} /></>}>
          <dl className="kv">
            <dt>Token</dt><dd>{ig.token_source}{ig.token_refreshed_at ? <span className="text-xs text-neutral-500"> · yenilendi {fmtDate(ig.token_refreshed_at)}</span> : ''}</dd>
            <dt>App secret</dt><dd>{ig.app_secret_set ? 'tanımlı (webhook imzası doğrulanıyor)' : <span className="text-red-600">tanımlı değil</span>}</dd>
            <dt>Webhook URL</dt><dd className="flex flex-wrap items-center gap-2"><code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{ig.webhook_url}</code><button onClick={() => copy(ig.webhook_url)} className="btn btn-xs"><Copy className="h-3 w-3" /></button></dd>
            <dt>Verify token</dt><dd className="flex flex-wrap items-center gap-2"><code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{ig.verify_token}</code><button onClick={() => copy(ig.verify_token)} className="btn btn-xs"><Copy className="h-3 w-3" /></button></dd>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={!ig.configured || busy === 'test'} onClick={() => act('test', async () => { const r = await api.post('/api/settings/instagram/test'); toast(`Bağlı: @${r.username || r.id} (${r.account_type || ''})`, 'ok'); })} className="btn btn-sm"><Plug className="h-3.5 w-3.5" />Bağlantıyı test et</button>
            <button disabled={!ig.configured || busy === 'refresh'} onClick={() => act('refresh', async () => { const r = await api.post('/api/settings/instagram/refresh'); toast(`Token yenilendi (${Math.round((r.expires_in || 0) / 86400)} gün)`, 'ok'); router.refresh(); })} className="btn btn-sm"><RefreshCw className="h-3.5 w-3.5" />Token'ı yenile</button>
          </div>
          <Field label="Erişim token'ı yapıştır (Meta panelinden aldığınız uzun ömürlü token)" className="mt-3">
            <div className="flex gap-2"><input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="IGQ…" className="input" /><button disabled={!token.trim() || busy === 'token'} onClick={() => act('token', async () => { await api.post('/api/settings/instagram/token', { access_token: token.trim() }); setToken(''); toast('Token kaydedildi', 'ok'); router.refresh(); })} className="btn btn-sm">Kaydet</button></div>
          </Field>
          <p className="mt-3 text-xs text-neutral-500">Kurulum adımları README'deki "Instagram bağlantısı" bölümünde. Meta uygulamasında webhook alanı olarak <code>messages</code> seçilmelidir.</p>
        </Card>

        <Card title={<><Truck className="h-4 w-4 text-[#d40511]" />DHL eCommerce <Dot on={dhl.can_create || dhl.can_track} /></>}>
          <dl className="kv">
            <dt>Mod</dt><dd>{dhl.mode === 'api' ? 'API (gönderi panelden oluşturulur)' : 'Manuel (Online Şube + takip numarası)'}</dd>
            <dt>Gönderi</dt><dd>{dhl.can_create ? 'DHL API bağlı' : 'Online Şube üzerinden; takip no panele girilir'}</dd>
            <dt>Takip</dt><dd>{dhl.can_track ? `${dhl.tracking_source} · cron her çalıştığında sorgulanır` : 'Takip API yok · teslimatı panelden işaretleyin'}</dd>
            <dt>Gönderici</dt><dd>{[dhl.sender.name, dhl.sender.phone, dhl.sender.city].filter(Boolean).join(' · ') || <span className="text-neutral-400">.env dosyasında tanımlayın</span>}</dd>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={dhl.online_sube_url} target="_blank" rel="noopener" className="btn btn-sm"><ExternalLink className="h-3.5 w-3.5" />DHL Online Şube</a>
            <a href="https://developer.dhl.com/" target="_blank" rel="noopener" className="btn btn-sm"><ExternalLink className="h-3.5 w-3.5" />DHL Developer Portal</a>
          </div>
          <p className="mt-3 text-xs text-neutral-500">Otomatik teslimat algılama için ücretsiz DHL "Shipment Tracking – Unified" API anahtarını <code>DHL_TRACKING_API_KEY</code> olarak ekleyin. DHL şubenizden web servis bilgilerini aldığınızda <code>DHL_MODE=api</code> ile gönderiler panelden oluşturulur.</p>
        </Card>
      </div>

      <Card title={<><Database className="h-4 w-4 text-emerald-600" />Veritabanı, yedek ve zamanlanmış işler</>}>
        <dl className="kv">
          <dt>Veritabanı</dt><dd>{st.db_kind === 'supabase' ? <>Supabase (REST API) · {st.key_kind === 'secret' ? 'gizli anahtar' : <span className="text-amber-700">publishable anahtar · gizli anahtar (Project Settings › API Keys › Secret keys) daha güvenlidir</span>}</> : <>Yerel JSON deposu (data/local.json) <span className="text-xs text-neutral-500">· canlıda SUPABASE_URL + anahtar ile Supabase</span></>}</dd>
          <dt>Son yedek</dt><dd>{b.last_at ? <>{fmtDate(b.last_at)} · <code className="text-xs">{b.last_file}</code></> : 'henüz alınmadı'}{!b.storage_configured && <span className="ml-2 text-xs text-amber-700">Otomatik yedek yalnızca Supabase modunda çalışır; "Yedek indir" ile elle alın.</span>}</dd>
          <dt>Cron</dt>
          <dd>
            {cron.configured ? (
              <>
                <span className="text-xs">Son çalışma: {cron.last_at ? fmtDate(cron.last_at) : 'henüz yok'}</span>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{cron.url}?secret=••••••</code>
                  <button onClick={() => copy(cronUrl)} className="btn btn-xs"><Copy className="h-3 w-3" />Adresi kopyala</button>
                </div>
                <p className="mt-1 text-xs text-neutral-500">cron-job.org'da yeni görev: bu adres, her 30 dakikada bir. Vercel'de ayrıca günlük yedek cron'u otomatik tanımlıdır.</p>
              </>
            ) : <span className="text-red-600">CRON_SECRET tanımlı değil · .env / Vercel ortam değişkenlerine ekleyin</span>}
          </dd>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/api/backup" className="btn btn-sm"><Download className="h-3.5 w-3.5" />Yedek indir (JSON)</a>
          <button disabled={busy === 'jobs'} onClick={() => act('jobs', async () => { const r = await api.post('/api/settings/run-jobs'); const bk = r.backup || {}; toast(`Çalıştı · ${r.shipments?.checked ?? 0} kargo sorgulandı · ${r.closed ?? 0} sipariş kapatıldı${bk.file ? ' · yedek: ' + bk.file : bk.skipped ? ' · yedek: ' + bk.skipped : bk.error ? ' · yedek hatası: ' + bk.error : ''}`, 'ok'); router.refresh(); })} className="btn btn-sm"><Play className="h-3.5 w-3.5" />İşleri şimdi çalıştır</button>
        </div>
      </Card>

      <Card id="giden" title={<><Bell className="h-4 w-4 text-amber-500" />Elle gönderilmesi gereken bildirimler ({outbox.length})</>} pad={false}>
        {outbox.length ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px]">
            <thead><tr><th className="th">Müşteri</th><th className="th">Sipariş</th><th className="th">Tür</th><th className="th">Sebep</th><th className="th"></th></tr></thead>
            <tbody>{outbox.map((x) => (
              <tr key={x.id}>
                <td className="td">{x.customer_name || (x.customer_ig ? '@' + x.customer_ig : '?')}<div className="text-xs text-neutral-500">{x.customer_phone}</div></td>
                <td className="td">{x.order_id ? <Link href={`/siparisler/${x.order_id}`} className="font-medium text-primary-text hover:underline">#{x.order_no}</Link> : '—'}</td>
                <td className="td text-xs">{x.kind}</td>
                <td className="td text-xs text-neutral-500">{x.error}</td>
                <td className="td whitespace-nowrap"><div className="flex gap-1">
                  <button onClick={() => copy(x.text)} className="btn btn-xs"><Copy className="h-3 w-3" />Kopyala</button>
                  <button disabled={busy === 'r' + x.id} onClick={() => act('r' + x.id, async () => { const r = await api.post(`/api/outbox/${x.id}/retry`); toast(r.status === 'ok' ? 'Gönderildi' : r.error, r.status === 'ok' ? 'ok' : 'err'); router.refresh(); })} className="btn btn-xs">Tekrar dene</button>
                  <button disabled={busy === 'm' + x.id} onClick={() => act('m' + x.id, async () => { await api.post(`/api/outbox/${x.id}/mark-sent`); toast('İşaretlendi', 'ok'); router.refresh(); })} className="btn btn-xs">Elle gönderdim</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="px-5 py-4 text-sm text-neutral-500">Bekleyen bildirim yok 🎉</p>}
      </Card>

      <Card title={<><Send className="h-4 w-4 text-primary" />Otomatik mesaj şablonları</>}>
        <p className="mb-3 text-xs text-neutral-500">Yer tutucular: {Object.entries(s.placeholders).map(([k, v]) => <span key={k} className="mr-2 inline-block"><code className="rounded bg-neutral-100 px-1 py-0.5">{`{{${k}}}`}</code> {v}</span>)}</p>
        <div className="grid gap-4 md:grid-cols-3">
          {Object.entries(s.templates).map(([k, t]) => (
            <Field key={k} label={t.label} hint={<button onClick={() => setTemplates({ ...templates, [k]: t.default })} className="text-primary-text hover:underline">varsayılana dön</button>}>
              <textarea value={templates[k]} onChange={(e) => setTemplates({ ...templates, [k]: e.target.value })} className="input min-h-[150px]" />
            </Field>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <p className="mb-2 text-sm font-medium">Otomatik gönderim</p>
          <div className="space-y-2">
            {Object.entries(s.auto_labels).map(([k, label]) => (
              <label key={k} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={Boolean(auto[k])} onChange={(e) => setAuto({ ...auto, [k]: e.target.checked })} className="mt-0.5 h-4 w-4 accent-primary" />{label}</label>
            ))}
          </div>
        </div>
        <div className="mt-3"><button disabled={busy === 'tpl'} onClick={() => act('tpl', async () => { await api.put('/api/settings', { templates, auto }); toast('Ayarlar kaydedildi', 'ok'); router.refresh(); })} className="btn btn-primary">Kaydet</button></div>
      </Card>

      {st.simulation && (
        <Card title={<><FlaskConical className="h-4 w-4 text-violet-500" />Test aracı · sahte Instagram mesajı</>}>
          <p className="mb-3 text-xs text-neutral-500">Instagram bağlamadan akışı denemek için. Aynı Instagram ID ile tekrar gönderirseniz aynı müşteriye düşer. Canlıda <code>ALLOW_SIMULATION=false</code> yapın.</p>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Instagram ID"><input value={sim.igsid} onChange={(e) => setSim({ ...sim, igsid: e.target.value })} className="input" /></Field>
            <Field label="Kullanıcı adı"><input value={sim.username} onChange={(e) => setSim({ ...sim, username: e.target.value })} className="input" /></Field>
            <Field label="Ad Soyad"><input value={sim.name} onChange={(e) => setSim({ ...sim, name: e.target.value })} className="input" /></Field>
            <Field label="Mesaj" className="md:col-span-3"><textarea value={sim.text} onChange={(e) => setSim({ ...sim, text: e.target.value })} className="input" /></Field>
          </div>
          <button disabled={busy === 'sim'} onClick={() => act('sim', async () => { const r = await api.post('/api/simulate/instagram', sim); toast('Mesaj düşürüldü', 'ok'); if (r.customer) router.push(`/mesajlar/${r.customer.id}`); })} className="btn mt-3">Mesajı düşür</button>
        </Card>
      )}

      <Card title={<><Server className="h-4 w-4 text-neutral-500" />Sistem</>}>
        <dl className="kv">
          <dt>Node</dt><dd>{st.node_version}{st.is_vercel ? ' · Vercel' : ''}</dd>
          <dt>Panel şifresi</dt><dd>{st.panel_password_set ? 'aktif' : <span className="text-red-600">tanımlı değil · PANEL_PASSWORD ekleyin</span>}</dd>
          <dt>Otomasyon</dt><dd>{st.is_vercel ? 'cron ile (yukarıdaki adres)' : st.automation.enabled ? `sunucu içi zamanlayıcı · kargo sorgusu ${st.automation.trackPollMinutes} dk` : 'kapalı'} · cevapsız memnuniyet {st.automation.satisfactionAutoCloseDays} gün sonra kapanır</dd>
          <dt>Adres</dt><dd className="font-mono text-xs">{st.base_url}</dd>
        </dl>
      </Card>
    </div>
  );
}
