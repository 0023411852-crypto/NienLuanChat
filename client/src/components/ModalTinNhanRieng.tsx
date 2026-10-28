import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { roleLabel } from '../lib/format';
import { useChat } from '../state/ChatContext';
import type { Role } from '../types';
import AnhDaiDien from './AnhDaiDien';

interface U { id: string; name: string; email: string; role: Role; avatar: string | null }

export default function ModalTinNhanRieng({ onClose }: { onClose: () => void }) {
  const { openDirect, state } = useChat();
  const [users, setUsers] = useState<U[]>([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ users: U[] }>('/api/users').then((r) => setUsers(r.users)).catch(() => setErr('Không tải được danh sách người dùng'));
  }, []);

  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
  const list = users.filter((u) => norm(u.name + ' ' + u.email).includes(norm(q)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 dark:border dark:border-slate-800 p-5 text-slate-800 dark:text-slate-100 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">Tin nhắn mới</h3>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên hoặc email..."
          className="mt-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 dark:focus:border-sky-500 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
        />
        {err && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{err}</p>}
        <ul className="scroll-thin mt-3 max-h-80 space-y-1 overflow-y-auto">
          {list.map((u) => (
            <li key={u.id}>
              <button
                onClick={async () => { await openDirect(u.id); onClose(); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <AnhDaiDien id={u.id} name={u.name} src={u.avatar} size={36} online={!!state.online[u.id]} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{u.name}</div>
                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">{roleLabel[u.role]} · {u.email}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
