'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileSpreadsheet, AlertTriangle, ExternalLink } from 'lucide-react';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Loading';
import { STATUSES, ONLINE_SUBE_URL } from '@/lib/constants';
import type { OrderStatus } from '@/lib/types';

interface Preview { total: number; ready: number; problems: { id: number; order_no: number; name: string; missing: string[]; warnings: string[] }[] }
const PICKABLE: OrderStatus[] = ['yeni', 'hazirlaniyor', 'kargoya_verildi'];

export function DhlExportButton() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<OrderStatus[]>(['yeni', 'hazirlaniyor']);
  const [skipTracked, setSkipTracked] = useState(true);
  const [format, setFormat] = useState<'xls' | 'xlsx'>('xls');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);

  const query = `durum=${statuses.join(',')}&atla=${skipTracked ? 1 : 0}`;
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    api.get<Preview>(`/api/orders/dhl-export?${query}&onizle=1`).then((p) => { if (alive) setPreview(p); }).catch(() => { if (alive) setPreview(null); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, query]);

  const toggle = (s: OrderStatus) => setStatuses((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  const download = () => {
    window.location.href = `/api/orders/dhl-export?${query}&bicim=${format}`;
    toast('Excel indiriliyor · DHL Online Şube › Toplu Gönderi Aktarımı sayfasına yükleyin', 'ok');
    setOpen(false);
  };
  const blocked = preview?.problems.filter((p) => p.missing.length) || [];
  const warned = preview?.problems.filter((p) => !p.missing.length && p.warnings.length) || [];

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn" title="DHL Online Şube toplu gönderi dosyası"><FileSpreadsheet className="h-4 w-4" /><span className="hidden sm:inline">DHL Excel</span><span className="sm:hidden">DHL</span></button>
      <Modal open={open} onClose={() => setOpen(false)} title="DHL toplu gönderi dosyası"
        footer={<><button className="btn" onClick={() => setOpen(false)}>Vazgeç</button><button className="btn btn-primary" onClick={download} disabled={loading || !preview || preview.ready === 0}>{loading && <Spinner />}Excel indir{preview ? ` (${preview.ready})` : ''}</button></>}>
        <div className="space-y-4 text-sm">
          <p className="text-neutral-600">Seçilen siparişler DHL'nin toplu aktarım şablonuna yazılır. İndirdiğiniz dosyayı <a href={ONLINE_SUBE_URL} target="_blank" rel="noopener" className="text-primary-text hover:underline">Online Şube <ExternalLink className="inline h-3 w-3" /></a> › Toplu Gönderi Aktarımı sayfasına yükleyin; DHL'nin verdiği takip numaralarını sonra siparişlere girin.</p>
          <div>
            <p className="label">Hangi durumdaki siparişler?</p>
            <div className="flex flex-wrap gap-2">
              {PICKABLE.map((s) => (
                <label key={s} className={`chip cursor-pointer ${statuses.includes(s) ? 'chip-active' : ''}`}><input type="checkbox" className="sr-only" checked={statuses.includes(s)} onChange={() => toggle(s)} />{STATUSES[s].label}</label>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Dosya biçimi</p>
            <div className="flex flex-wrap gap-2">
              {(['xls', 'xlsx'] as const).map((f) => <label key={f} className={`chip cursor-pointer ${format === f ? 'chip-active' : ''}`}><input type="radio" name="bicim" className="sr-only" checked={format === f} onChange={() => setFormat(f)} />.{f}{f === 'xls' ? ' (DHL şablonu gibi)' : ''}</label>)}
            </div>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={skipTracked} onChange={(e) => setSkipTracked(e.target.checked)} className="h-4 w-4 rounded border-neutral-300 text-primary" />Takip numarası girilmiş siparişleri dahil etme</label>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
            {loading && !preview ? <span className="inline-flex items-center gap-2 text-neutral-500"><Spinner />Sayılıyor…</span> : preview ? (
              <p><span className="font-semibold">{preview.ready}</span> sipariş dosyaya yazılacak{preview.total !== preview.ready && <span className="text-neutral-500"> · {preview.total - preview.ready} sipariş eksik bilgi yüzünden atlanacak</span>}</p>
            ) : <span className="text-neutral-500">Özet alınamadı</span>}
          </div>
          {blocked.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
              <p className="mb-1 flex items-center gap-1.5 font-medium text-red-700"><AlertTriangle className="h-4 w-4" />Eksik bilgi (dosyaya yazılmaz)</p>
              <ul className="space-y-0.5">
                {blocked.map((p) => <li key={p.id}><Link href={`/siparisler/${p.id}`} className="text-primary-text hover:underline">#{p.order_no} {p.name}</Link><span className="text-neutral-600"> · {p.missing.join(', ')}</span></li>)}
              </ul>
            </div>
          )}
          {warned.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="mb-1 font-medium text-amber-800">Uyarılar (yine de yazılır)</p>
              <ul className="space-y-0.5">
                {warned.map((p) => <li key={p.id}><Link href={`/siparisler/${p.id}`} className="text-primary-text hover:underline">#{p.order_no} {p.name}</Link><span className="text-neutral-600"> · {p.warnings.join(', ')}</span></li>)}
              </ul>
            </div>
          )}
          <p className="text-xs text-neutral-500">Varsayılanlar: teslim şekli adrese teslim, alıcıya SMS evet, gönderici SMS hayır, kıymet = sipariş toplamı, kapıda ödeme siparişlerinde kapıda tahsilat evet. Kargo ödemesi siparişteki "kargo ödeyen" alanından gelir.</p>
        </div>
      </Modal>
    </>
  );
}
