import { useEffect, useRef, useState } from 'react';
import { useChat } from '../state/ChatContext';
import { NOTIFY_LABELS } from '../lib/notify';
import type { Channel, NotifyLevel } from '../types';
import { BellIcon, BellOffIcon, CheckIcon } from './BieuTuong';

export default function MenuThongBao({ channel }: { channel: Channel }) {
  const { setNotifyLevel } = useChat();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  const muted = channel.notifyLevel === 'NONE';
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Cài đặt thông báo"
        className={`rounded-xl p-2 transition ${open ? 'bg-indigo-50 text-indigo-600 dark:bg-sky-950/60 dark:text-sky-300' : muted ? 'text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
      >
        {muted ? <BellOffIcon /> : <BellIcon />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-750 dark:bg-slate-850 dark:text-slate-100">
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-400">Thông báo cho kênh này</p>
          {(Object.keys(NOTIFY_LABELS) as NotifyLevel[]).map((lv) => (
            <button
              key={lv}
              onClick={() => { setNotifyLevel(channel.id, lv); setOpen(false); }}
              className={`flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 ${channel.notifyLevel === lv ? 'bg-indigo-50/60 dark:bg-sky-950/50' : ''}`}
            >
              <span className="mt-0.5 w-4 text-indigo-600 dark:text-sky-400">{channel.notifyLevel === lv && <CheckIcon className="h-4 w-4" />}</span>
              <span>
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{NOTIFY_LABELS[lv].title}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{NOTIFY_LABELS[lv].desc}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
