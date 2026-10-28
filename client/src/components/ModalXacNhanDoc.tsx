import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { fmtShort } from '../lib/format';
import type { UiMessage } from '../types';
import AnhDaiDien from './AnhDaiDien';
import Modal from './ui/HopThoai';

interface Row { id: string; name: string; studentCode: string | null; avatar: string | null; ackedAt: string | null; seen: boolean }
interface Report { total: number; acked: Row[]; pending: Row[] }

export default function ModalXacNhanDoc({ message, onClose }: { message: UiMessage; onClose: () => void }) {
  const [r, setR] = useState<Report | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'acked' | 'pending'>('pending');
  useEffect(() => {
    api<Report>(`/api/messages/${message.id}/acks`).then(setR).catch((e) => setErr(e.message));
  }, [message.id, message.ackUserIds.length]);
  const list = r ? r[tab] : [];
  const pct = r && r.total ? Math.round((r.acked.length / r.total) * 100) : 0;
  return (
    <Modal title="Xác nhận đã đọc thông báo" onClose={onClose} width="max-w-md">
      <p className="mb-3 line-clamp-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-slate-700 dark:bg-amber-950/40 dark:text-amber-200">{message.content}</p>
      {err && <p className="text-sm text-rose-600 dark:text-rose-400">{err}</p>}
      {r && (
        <>
          <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400"><span>{r.acked.length}/{r.total} người đã xác nhận</span><span>{pct}%</span></div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
          <div className="mb-3 flex gap-1 rounded-xl bg-slate-100 p-1 text-sm dark:bg-slate-800">
            <button onClick={() => setTab('pending')} className={`flex-1 rounded-lg py-1.5 font-medium ${tab === 'pending' ? 'bg-white shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Chưa xác nhận ({r.pending.length})</button>
            <button onClick={() => setTab('acked')} className={`flex-1 rounded-lg py-1.5 font-medium ${tab === 'acked' ? 'bg-white shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Đã xác nhận ({r.acked.length})</button>
          </div>
          <ul className="scroll-thin max-h-72 space-y-1 overflow-y-auto">
            {list.map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                <AnhDaiDien id={u.id} name={u.name} src={u.avatar} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{u.name}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{u.studentCode ?? ''}</p>
                </div>
                <span className={`text-[11px] ${u.ackedAt ? 'text-emerald-600 dark:text-emerald-400' : u.seen ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {u.ackedAt ? fmtShort(u.ackedAt) : u.seen ? 'Đã xem, chưa xác nhận' : 'Chưa xem'}
                </span>
              </li>
            ))}
            {!list.length && <li className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">Không có ai</li>}
          </ul>
        </>
      )}
    </Modal>
  );
}
