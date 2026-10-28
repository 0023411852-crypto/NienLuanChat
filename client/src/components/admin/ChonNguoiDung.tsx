import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { roleLabel } from '../../lib/format';
import type { Role } from '../../types';
import AnhDaiDien from '../AnhDaiDien';
import { inputCls } from '../ui/HopThoai';

export interface LookupUser { id: string; name: string; email: string; role: Role; studentCode: string | null; avatar: string | null }

/** Ô tìm người dùng (tên / email / MSSV) -> chọn */
export default function ChonNguoiDung({ onPick, exclude = [], role, placeholder = 'Tìm theo tên, email hoặc MSSV...', options }: {
  onPick: (u: LookupUser) => void; exclude?: string[]; role?: Role; placeholder?: string;
  options?: LookupUser[];
}) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<LookupUser[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (options && !q.trim()) {
      setList(options);
      return;
    }
    const t = window.setTimeout(() => {
      const p = new URLSearchParams({ q: q.trim() });
      if (role) p.set('role', role);
      api<{ users: LookupUser[] }>(`/api/admin/user-lookup?${p}`)
        .then((r) => {
          const matchedFriends = options ? options.filter(f => `${f.name} ${f.email} ${f.studentCode ?? ''}`.toLowerCase().includes(q.toLowerCase())) : [];
          const combined = [...matchedFriends];
          for (const u of r.users) {
            if (!combined.some(c => c.id === u.id)) combined.push(u);
          }
          setList(combined);
        })
        .catch(() => {
          if (options) {
            setList(options.filter(f => `${f.name} ${f.email} ${f.studentCode ?? ''}`.toLowerCase().includes(q.toLowerCase())));
          } else {
            setList([]);
          }
        });
    }, 200);
    return () => window.clearTimeout(t);
  }, [q, role, open, options]);
  const shown = list.filter((u) => !exclude.includes(u.id));
  return (
    <div className="relative">
      <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder={placeholder} className={inputCls} />
      {open && shown.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          {shown.map((u) => (
            <li key={u.id}>
              <button onMouseDown={(e) => { e.preventDefault(); onPick(u); setQ(''); }} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-indigo-50">
                <AnhDaiDien id={u.id} name={u.name} src={u.avatar} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{u.name}</p>
                  <p className="truncate text-[11px] text-slate-500">{u.email}{u.studentCode ? ` · ${u.studentCode}` : ''}</p>
                </div>
                <span className="text-[11px] text-slate-400">{roleLabel[u.role]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
