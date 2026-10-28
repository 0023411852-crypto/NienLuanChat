import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { fmtSize } from '../../lib/files';

interface Stats {
  users: Record<string, number>;
  lockedUsers: number;
  channels: Record<string, number>;
  archivedChannels: number;
  messages: number;
  messagesToday: number;
  files: number;
  filesSize: number;
  online: number;
  pushSubscriptions: number;
  messagesPerDay: { day: string; count: number }[];
  topChannels: { id: string; name: string; courseCode: string | null; type: string; n: number }[];
}

const Card = ({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
    {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
  </div>
);
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export default function BangDieuKhien() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const load = () => api<Stats>('/api/admin/stats').then(setS).catch((e) => setErr(e.message));
    load();
    const t = window.setInterval(load, 15000);
    return () => window.clearInterval(t);
  }, []);
  if (err) return <p className="text-rose-600">{err}</p>;
  if (!s) return <p className="text-slate-400">Đang tải thống kê...</p>;
  const totalUsers = Object.values(s.users).reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...s.messagesPerDay.map((d) => d.count));
  const topMax = Math.max(1, ...s.topChannels.map((c) => c.n));
  return (
    <div className="space-y-6" data-admin-dashboard>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Card label="Người dùng" value={totalUsers} sub={`${s.users.STUDENT ?? 0} SV · ${s.users.LECTURER ?? 0} GV · ${s.users.ADMIN ?? 0} QTV${s.lockedUsers ? ` · ${s.lockedUsers} bị khoá` : ''}`} color="text-indigo-600" />
        <Card label="Đang trực tuyến" value={s.online} sub={`${s.pushSubscriptions} thiết bị bật thông báo đẩy`} color="text-emerald-600" />
        <Card label="Tin nhắn" value={s.messages.toLocaleString('vi-VN')} sub={`${s.messagesToday} tin hôm nay`} color="text-sky-600" />
        <Card label="Tệp đã chia sẻ" value={s.files} sub={`Tổng dung lượng ${fmtSize(s.filesSize)}`} color="text-amber-600" />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h3 className="mb-4 font-semibold text-slate-800">Tin nhắn 7 ngày gần đây</h3>
          <div className="flex h-48 items-end gap-3">
            {s.messagesPerDay.map((d) => {
              const date = new Date(`${d.day}T00:00:00`);
              return (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-slate-600">{d.count}</span>
                  <div className="w-full rounded-t-lg bg-gradient-to-t from-indigo-500 to-sky-400" style={{ height: `${Math.max(4, (d.count / max) * 150)}px` }} />
                  <span className="text-[11px] text-slate-500">{WD[date.getDay()]} {date.getDate()}/{date.getMonth() + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-800">Kênh sôi nổi nhất (7 ngày)</h3>
          <ul className="space-y-3">
            {s.topChannels.map((c) => (
              <li key={c.id}>
                <div className="mb-1 flex justify-between text-sm"><span className="truncate">{c.courseCode ? <b className="text-sky-700">{c.courseCode} </b> : null}{c.name}</span><span className="font-semibold text-slate-600">{c.n}</span></div>
                <div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${(c.n / topMax) * 100}%` }} /></div>
              </li>
            ))}
            {!s.topChannels.length && <li className="text-sm text-slate-400">Chưa có hoạt động</li>}
          </ul>
          <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-sky-50 p-2"><b className="block text-lg text-sky-700">{s.channels.CLASS ?? 0}</b>Lớp HP</div>
            <div className="rounded-xl bg-amber-50 p-2"><b className="block text-lg text-amber-700">{s.channels.ANNOUNCEMENT ?? 0}</b>Thông báo</div>
            <div className="rounded-xl bg-slate-100 p-2"><b className="block text-lg text-slate-700">{s.archivedChannels}</b>Lưu trữ</div>
          </div>
        </div>
      </div>
    </div>
  );
}
