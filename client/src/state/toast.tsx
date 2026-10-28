import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface Toast {
  id: number;
  kind: 'message' | 'info' | 'error' | 'success' | 'warning';
  title: string;
  body?: string;
  avatar?: { id: string; name: string; src: string | null };
  badge?: string;
  onClick?: () => void;
  timeout?: number;
}

interface ToastApi {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

const Ctx = createContext<ToastApi | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setThongBaoNhanh] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setThongBaoNhanh((ts) => ts.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = nextId++;
      setThongBaoNhanh((ts) => [...ts.slice(-3), { ...t, id }]);
      window.setTimeout(() => dismiss(id), t.timeout ?? (t.kind === 'error' ? 6000 : 5000));
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast phải nằm trong ToastProvider');
  return c;
}
