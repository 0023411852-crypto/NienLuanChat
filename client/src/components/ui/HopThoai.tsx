import { useEffect, type ReactNode } from 'react';
import { XIcon } from '../BieuTuong';

export default function Modal({
  title, onClose, children, width = 'max-w-lg', footer,
}: { title: ReactNode; onClose: () => void; children: ReactNode; width?: string; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 backdrop-blur-sm p-4 pt-[8vh]" onMouseDown={onClose}>
      <div className={`w-full ${width} rounded-2xl bg-white text-slate-800 shadow-2xl dark:bg-slate-900 dark:text-slate-100 dark:border dark:border-slate-800`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="text-base font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"><XIcon /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">{footer}</div>}
      </div>
    </div>
  );
}

export const btn = {
  primary: 'rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 dark:bg-sky-600 dark:hover:bg-sky-500 disabled:opacity-50 transition',
  secondary: 'rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition',
  danger: 'rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition',
  ghost: 'rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition',
};
export const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-300 dark:focus:border-sky-500 dark:focus:ring-sky-950/40';
