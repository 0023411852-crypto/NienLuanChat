import { useCallback, useEffect, useState } from 'react';
import { fileBadge, fmtSize } from '../lib/files';
import type { Attachment } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, XIcon } from './BieuTuong';

export function FileIconBadge({ name, mime, size = 'h-10 w-10' }: { name: string; mime?: string; size?: string }) {
  const b = fileBadge(name, mime);
  return (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-xl text-[10px] font-bold tracking-wide text-white ${b.color}`}>
      {b.label}
    </div>
  );
}

export function FileCard({ a, mine, progress }: { a: Attachment; mine?: boolean; progress?: number }) {
  const pending = !a.url;
  return (
    <div
      data-file-card
      className={`flex w-72 max-w-full items-center gap-3 rounded-2xl border p-2.5 ${mine ? 'border-indigo-200 bg-indigo-50 dark:border-sky-900/60 dark:bg-sky-950/40' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}
    >
      <FileIconBadge name={a.filename} mime={a.mime} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100" title={a.filename}>{a.filename}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {fmtSize(a.size)}
          {pending && (progress !== undefined ? ` · Đang tải lên ${progress}%` : ' · Chờ tải lên')}
        </p>
        {pending && progress !== undefined && (
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full bg-indigo-500 dark:bg-sky-500 transition-all" style={{ width: `${progress}%` }} /></div>
        )}
      </div>
      {!pending && (
        <a
          href={`${a.url}?download=1`}
          download={a.filename}
          title="Tải xuống"
          onClick={(e) => e.stopPropagation()}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-sky-300"
        >
          <DownloadIcon />
        </a>
      )}
    </div>
  );
}

export function Lightbox({ images, index, onClose }: { images: Attachment[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);
  const cur = images[i];
  const go = useCallback((d: number) => setI((x) => (x + d + images.length) % images.length), [images.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);
  if (!cur) return null;
  return (
    <div data-lightbox className="fixed inset-0 z-[70] flex flex-col bg-slate-950/90 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{cur.filename}</p>
          <p className="text-xs text-slate-400">{fmtSize(cur.size)}{images.length > 1 ? ` · ${i + 1}/${images.length}` : ''}</p>
        </div>
        <div className="flex items-center gap-1">
          {cur.url && (
            <a href={`${cur.url}?download=1`} download={cur.filename} className="rounded-lg p-2 hover:bg-white/10" title="Tải xuống"><DownloadIcon className="h-5 w-5" /></a>
          )}
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10" title="Đóng (Esc)"><XIcon className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        {images.length > 1 && (
          <button onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"><ChevronLeftIcon /></button>
        )}
        <img src={cur.localUrl ?? cur.url} alt={cur.filename} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
        {images.length > 1 && (
          <button onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"><ChevronRightIcon /></button>
        )}
      </div>
    </div>
  );
}

/** Ảnh dạng lưới thu nhỏ (bấm để xem lớn) + thẻ tệp */
export default function TepDinhKem({ items, mine, progress }: { items: Attachment[]; mine?: boolean; progress?: number }) {
  const [open, setOpen] = useState<number | null>(null);
  const images = items.filter((a) => a.isImage);
  const files = items.filter((a) => !a.isImage);
  if (!items.length) return null;
  return (
    <div className={`mt-1 flex flex-col gap-1.5 ${mine ? 'items-end' : 'items-start'}`}>
      {images.length > 0 && (
        <div className={`grid gap-1.5 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {images.map((a, i) => (
            <button
              key={a.id}
              data-image-thumb
              onClick={() => setOpen(i)}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
              title={a.filename}
            >
              <img
                src={a.localUrl ?? a.url}
                alt={a.filename}
                loading="lazy"
                className={`${images.length === 1 ? 'max-h-72 max-w-sm' : 'h-36 w-44'} object-cover transition group-hover:scale-[1.02] ${!a.url ? 'opacity-60' : ''}`}
              />
              {!a.url && (
                <span className="absolute inset-x-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
                  {progress !== undefined ? `Đang tải lên ${progress}%` : 'Chờ tải lên'}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {files.map((a) => <FileCard key={a.id} a={a} mine={mine} progress={progress} />)}
      {open !== null && <Lightbox images={images} index={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
