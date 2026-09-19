'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type ToastKind = 'ok' | 'err' | 'info';
interface Toast { id: number; text: string; kind: ToastKind }

const Ctx = createContext<{ toast: (text: string, kind?: ToastKind) => void; fail: (e: unknown) => void }>({ toast: () => {}, fail: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, kind }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === 'err' ? 6000 : 3500);
  }, []);
  const fail = useCallback((e: unknown) => toast(e instanceof Error ? e.message : String(e), 'err'), [toast]);
  return (
    <Ctx.Provider value={{ toast, fail }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto max-w-sm rounded-lg px-4 py-2.5 text-sm text-white shadow-lg ${t.kind === 'err' ? 'bg-red-600' : t.kind === 'ok' ? 'bg-emerald-600' : 'bg-neutral-900'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
