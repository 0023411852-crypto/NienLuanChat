import { useToast } from '../state/toast';
import AnhDaiDien from './AnhDaiDien';
import { AlertIcon, CheckIcon, XIcon } from './BieuTuong';

export default function ThongBaoNhanh() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          data-toast={t.kind}
          onClick={() => { t.onClick?.(); dismiss(t.id); }}
          className={`pointer-events-auto flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-3 shadow-xl shadow-slate-200/70 transition hover:-translate-y-0.5 ${
            t.kind === 'error' ? 'border-rose-200' : t.kind === 'warning' ? 'border-amber-200' : t.kind === 'success' ? 'border-emerald-200' : 'border-slate-200'
          }`}
          style={{ animation: 'toastIn .25s ease-out' }}
        >
          {t.avatar ? (
            <AnhDaiDien id={t.avatar.id} name={t.avatar.name} src={t.avatar.src} size={36} />
          ) : (
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.kind === 'error' ? 'bg-rose-100 text-rose-600' : t.kind === 'warning' ? 'bg-amber-100 text-amber-600' : t.kind === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
              {t.kind === 'error' || t.kind === 'warning' ? <AlertIcon className="h-5 w-5" /> : <CheckIcon className="h-5 w-5" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-800">{t.title}</p>
              {t.badge && <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">{t.badge}</span>}
            </div>
            {t.body && <p className="line-clamp-2 text-xs text-slate-500">{t.body}</p>}
          </div>
          <button onClick={(e) => { e.stopPropagation(); dismiss(t.id); }} className="text-slate-300 hover:text-slate-500"><XIcon /></button>
        </div>
      ))}
    </div>
  );
}
