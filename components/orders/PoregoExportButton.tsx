'use client';
import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Spinner } from '@/components/Loading';
import { useToast } from '@/components/Toast';

export function PoregoExportButton() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const download = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/orders/porego-export', { cache: 'no-store' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `İndirme başarısız (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/i)?.[1] || 'porego-siparis-aktarim.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Hazırlandı siparişleri içeren Porego Excel dosyası indirildi', 'ok');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Excel indirilemedi', 'err');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={download} disabled={loading} className="btn" title="Hazırlandı siparişlerini Porego Excel şablonunda indir">
      {loading ? <Spinner /> : <FileSpreadsheet className="h-4 w-4" />}
      <span className="hidden sm:inline">Excel indir</span>
      <span className="sm:hidden">Excel</span>
    </button>
  );
}