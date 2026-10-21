'use client';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Spinner } from '@/components/Loading';
import { useToast } from '@/components/Toast';

type SelectionContextValue = {
  selected: number[];
  toggle: (id: number) => void;
  clear: () => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function OrderSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<number[]>([]);
  const value = useMemo<SelectionContextValue>(() => ({
    selected,
    toggle: (id) => setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]),
    clear: () => setSelected([]),
  }), [selected]);

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

function useOrderSelection() {
  const value = useContext(SelectionContext);
  if (!value) throw new Error('OrderSelectionProvider içinde kullanılmalı');
  return value;
}

export function OrderSelectCheckbox({ id, orderNo }: { id: number; orderNo: number }) {
  const { selected, toggle } = useOrderSelection();
  return (
    <input
      type="checkbox"
      aria-label={`Sipariş #${orderNo} seç`}
      checked={selected.includes(id)}
      onChange={() => toggle(id)}
      onClick={(event) => event.stopPropagation()}
      className="h-4 w-4 shrink-0 rounded border-neutral-300 text-primary"
    />
  );
}

export function SelectedOrdersExportButton() {
  const { selected, clear } = useOrderSelection();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const download = async () => {
    if (!selected.length) return;
    setLoading(true);
    try {
      const response = await fetch('/api/orders/porego-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selected }),
        cache: 'no-store',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `İndirme başarısız (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/i)?.[1] || 'porego-secili-siparisler.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`${selected.length} seçili sipariş Excel olarak indirildi`, 'ok');
      clear();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Excel indirilemedi', 'err');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={download} disabled={loading || selected.length === 0} className="btn" title="Seçili siparişleri Porego Excel şablonunda indir">
      {loading ? <Spinner /> : <FileSpreadsheet className="h-4 w-4" />}
      <span>Seçilenleri Excel indir{selected.length ? ` (${selected.length})` : ''}</span>
    </button>
  );
}