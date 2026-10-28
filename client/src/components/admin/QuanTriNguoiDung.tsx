import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { copyToClipboard, fmtShort, roleLabel } from '../../lib/format';
import { useChat } from '../../state/ChatContext';
import { useToast } from '../../state/toast';
import type { Role } from '../../types';
import AnhDaiDien from '../AnhDaiDien';
import { LockIcon, PlusIcon, SearchIcon, UploadIcon } from '../BieuTuong';
import Modal, { btn, inputCls } from '../ui/HopThoai';

export interface AdminUser {
  id: string; email: string; name: string; role: Role; studentCode: string | null; avatar: string | null;
  locked: boolean; lastSeenAt: string | null; createdAt: string; online: boolean;
  _count?: { messages?: number; memberships?: number };
}

const roleColor: Record<Role, string> = {
  ADMIN: 'bg-rose-50 text-rose-700 ring-rose-200',
  LECTURER: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  STUDENT: 'bg-slate-50 text-slate-600 ring-slate-200',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function PasswordNotice({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const copyPw = async () => {
    const ok = await copyToClipboard(password);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.push({ kind: 'success', title: 'Đã sao chép mật khẩu' });
    }
  };
  return (
    <Modal title="Mật khẩu tạm thời" onClose={onClose} width="max-w-sm" footer={<button className={btn.primary} onClick={onClose}>Đã lưu</button>}>
      <p className="text-sm text-slate-600">Gửi mật khẩu này cho <b>{email}</b>. Mật khẩu chỉ hiển thị một lần.</p>
      <div className="mt-3 flex items-center gap-2">
        <code data-temp-password className="flex-1 rounded-xl bg-slate-100 px-3 py-2 font-mono text-base font-semibold">{password}</code>
        <button className={`${copied ? 'bg-emerald-600 text-white' : btn.secondary} transition`} onClick={copyPw}>
          {copied ? '✓ Đã chép' : 'Sao chép'}
        </button>
      </div>
    </Modal>
  );
}

function UserForm({ user, onClose, onSaved }: { user?: AdminUser; onClose: () => void; onSaved: (pw?: { email: string; password: string }) => void }) {
  const [f, setF] = useState({ name: user?.name ?? '', email: user?.email ?? '', role: user?.role ?? ('STUDENT' as Role), studentCode: user?.studentCode ?? '', password: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (user) {
        await api(`/api/admin/users/${user.id}`, { method: 'PATCH', json: { name: f.name, email: f.email, role: f.role, studentCode: f.studentCode || null } });
        onSaved();
      } else {
        const r = await api<{ password?: string }>('/api/admin/users', {
          method: 'POST',
          json: { name: f.name, email: f.email, role: f.role, studentCode: f.studentCode || undefined, password: f.password || undefined },
        });
        onSaved(r.password ? { email: f.email, password: r.password } : undefined);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={user ? 'Sửa tài khoản' : 'Tạo tài khoản mới'}
      onClose={onClose}
      footer={<><button className={btn.ghost} onClick={onClose}>Huỷ</button><button className={btn.primary} disabled={busy} onClick={save}>{user ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button></>}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Field label="Họ và tên"><input className={inputCls} value={f.name} onChange={set('name')} placeholder="Nguyễn Văn A" /></Field></div>
        <div className="col-span-2"><Field label="Email"><input className={inputCls} value={f.email} onChange={set('email')} placeholder="sv@khoachat.edu.vn" /></Field></div>
        <Field label="Vai trò">
          <select className={inputCls} value={f.role} onChange={set('role')}>
            <option value="STUDENT">Sinh viên</option><option value="LECTURER">Giảng viên</option><option value="ADMIN">Quản trị viên</option>
          </select>
        </Field>
        <Field label="Mã số sinh viên"><input className={inputCls} value={f.studentCode} onChange={set('studentCode')} placeholder="B2100001" /></Field>
        {!user && (
          <div className="col-span-2">
            <Field label="Mật khẩu (để trống để tạo ngẫu nhiên)"><input className={inputCls} value={f.password} onChange={set('password')} type="text" /></Field>
          </div>
        )}
      </div>
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
    </Modal>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [csv, setCsv] = useState('email,name,studentCode\n');
  const [pw, setPw] = useState('SinhVien@123');
  const [channelId, setChannelId] = useState('');
  const [channels, setChannels] = useState<{ id: string; name: string; courseCode: string | null }[]>([]);
  const [res, setRes] = useState<{ created: number; skipped: { line: number; email: string; reason: string }[]; addedToChannel: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<{ channels: { id: string; name: string; courseCode: string | null; type: string; archived: boolean }[] }>('/api/admin/channels?type=CLASS&archived=false')
      .then((r) => setChannels(r.channels)).catch(() => {});
  }, []);
  const run = async () => {
    setErr(null);
    try {
      const r = await api<typeof res & object>('/api/admin/users/import', { method: 'POST', json: { csv, defaultPassword: pw, channelId: channelId || undefined } });
      setRes(r);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Modal title="Nhập sinh viên từ CSV" onClose={onClose} width="max-w-2xl" footer={<><button className={btn.ghost} onClick={onClose}>Đóng</button><button className={btn.primary} onClick={run}>Nhập</button></>}>
      <p className="mb-3 text-xs text-slate-500">Mỗi dòng: <code>email,họ tên,MSSV[,mật khẩu][,vai trò]</code>. Dòng tiêu đề (có cột <code>email</code>) là tuỳ chọn. Hỗ trợ dấu phẩy hoặc chấm phẩy (Excel).</p>
      <div className="mb-3 flex items-center gap-3">
        <label className={`${btn.secondary} flex cursor-pointer items-center gap-2`}>
          <UploadIcon /> Chọn tệp .csv
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} />
        </label>
        <span className="text-xs text-slate-400">hoặc dán nội dung vào ô bên dưới</span>
      </div>
      <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={8} className={`${inputCls} font-mono text-xs`} />
      <div className="mt-3 grid grid-cols-2 gap-4">
        <Field label="Mật khẩu mặc định"><input className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Field label="Thêm luôn vào lớp học phần (tuỳ chọn)">
          <select className={inputCls} value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            <option value="">— Không —</option>
            {channels.map((c) => <option key={c.id} value={c.id}>{c.courseCode} {c.name}</option>)}
          </select>
        </Field>
      </div>
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      {res && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          Đã tạo <b>{res.created}</b> tài khoản{channelId ? `, thêm ${res.addedToChannel} người vào lớp` : ''}. Bỏ qua {res.skipped.length} dòng.
          {res.skipped.length > 0 && (
            <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-amber-800">
              {res.skipped.map((s) => <li key={s.line}>Dòng {s.line}: {s.email || '(trống)'} — {s.reason}</li>)}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function QuanTriNguoiDung() {
  const { me, state } = useChat();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ users: AdminUser[]; total: number; pageSize: number } | null>(null);
  const [edit, setEdit] = useState<AdminUser | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const [pw, setPw] = useState<{ email: string; password: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState<AdminUser | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: '15' });
    if (q.trim()) p.set('q', q.trim());
    if (role) p.set('role', role);
    if (status) p.set('locked', status === 'locked' ? 'true' : 'false');
    api<{ users: AdminUser[]; total: number; pageSize: number }>(`/api/admin/users?${p}`).then(setData).catch((e) => toast.push({ kind: 'error', title: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, role, status, page]);
  useEffect(() => {
    const t = window.setTimeout(load, 200);
    return () => window.clearTimeout(t);
  }, [load]);

  const toggleLock = async (u: AdminUser) => {
    try {
      await api(`/api/admin/users/${u.id}`, { method: 'PATCH', json: { locked: !u.locked } });
      toast.push({ kind: 'success', title: u.locked ? `Đã mở khoá ${u.name}` : `Đã khoá ${u.name}`, body: u.locked ? undefined : 'Người dùng bị đăng xuất khỏi mọi thiết bị' });
      load();
    } catch (e) {
      toast.push({ kind: 'error', title: (e as Error).message });
    }
  };
  const reset = async (u: AdminUser) => {
    setConfirmReset(null);
    try {
      const r = await api<{ password: string }>(`/api/admin/users/${u.id}/reset-password`, { method: 'POST', json: {} });
      setPw({ email: u.email, password: r.password });
    } catch (e) {
      toast.push({ kind: 'error', title: (e as Error).message });
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const sel = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none';

  return (
    <div data-admin-users>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-72">
          <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Tìm theo tên, email, MSSV..." className={`${inputCls} bg-white pl-9`} />
        </div>
        <select className={sel} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">Mọi vai trò</option><option value="STUDENT">Sinh viên</option><option value="LECTURER">Giảng viên</option><option value="ADMIN">Quản trị viên</option>
        </select>
        <select className={sel} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Mọi trạng thái</option><option value="active">Đang hoạt động</option><option value="locked">Đã khoá</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button className={`${btn.secondary} flex items-center gap-2`} onClick={() => setImporting(true)}><UploadIcon /> Nhập CSV</button>
          <button className={`${btn.primary} flex items-center gap-2`} onClick={() => setEdit('new')}><PlusIcon /> Thêm người dùng</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Người dùng</th><th className="px-4 py-3">MSSV</th><th className="px-4 py-3">Vai trò</th><th className="px-4 py-3">Hoạt động</th><th className="px-4 py-3 text-right">Kênh / Tin</th><th className="px-4 py-3 text-right">Thao tác</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.users.map((u) => (
              <tr key={u.id} className={u.locked ? 'bg-slate-50/80 text-slate-400' : ''} data-user-row={u.email}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <AnhDaiDien id={u.id} name={u.name} src={u.avatar} size={34} online={!!state.online[u.id] || u.online} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-medium text-slate-800">{u.name}{u.locked && <LockIcon className="h-3.5 w-3.5 text-rose-500" />}{u.id === me.id && <span className="text-xs text-slate-400">(bạn)</span>}</p>
                      <p className="truncate text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{u.studentCode ?? '—'}</td>
                <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${roleColor[u.role]}`}>{roleLabel[u.role]}</span></td>
                <td className="px-4 py-2.5 text-xs">
                  {u.locked ? <span className="font-semibold text-rose-600">Đã khoá</span> : state.online[u.id] || u.online ? <span className="text-emerald-600">● Trực tuyến</span> : u.lastSeenAt ? fmtShort(u.lastSeenAt) : 'Chưa đăng nhập'}
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-slate-500">{(u._count?.memberships ?? 0)} / {(u._count?.messages ?? 0)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <button className={btn.ghost} onClick={() => setEdit(u)}>Sửa</button>
                    <button className={btn.ghost} onClick={() => setConfirmReset(u)}>Đặt lại MK</button>
                    {u.id !== me.id && (
                      <button className={`${btn.ghost} ${u.locked ? 'text-emerald-700' : 'text-rose-600'}`} onClick={() => toggleLock(u)}>{u.locked ? 'Mở khoá' : 'Khoá'}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {data && !data.users.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Không có người dùng phù hợp</td></tr>}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span>{data?.total ?? 0} người dùng</span>
          <div className="flex items-center gap-2">
            <button className={btn.ghost} disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Trước</button>
            <span>Trang {page}/{pages}</span>
            <button className={btn.ghost} disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau ›</button>
          </div>
        </div>
      </div>

      {edit && (
        <UserForm
          user={edit === 'new' ? undefined : edit}
          onClose={() => setEdit(null)}
          onSaved={(p) => { setEdit(null); load(); toast.push({ kind: 'success', title: edit === 'new' ? 'Đã tạo tài khoản' : 'Đã lưu thay đổi' }); if (p) setPw(p); }}
        />
      )}
      {importing && <ImportModal onClose={() => setImporting(false)} onDone={load} />}
      {pw && <PasswordNotice {...pw} onClose={() => setPw(null)} />}
      {confirmReset && (
        <Modal title="Đặt lại mật khẩu?" onClose={() => setConfirmReset(null)} width="max-w-sm"
          footer={<><button className={btn.ghost} onClick={() => setConfirmReset(null)}>Huỷ</button><button className={btn.danger} onClick={() => reset(confirmReset)}>Đặt lại</button></>}>
          <p className="text-sm text-slate-600">Tạo mật khẩu tạm thời mới cho <b>{confirmReset.name}</b>. Mật khẩu cũ sẽ không dùng được nữa.</p>
        </Modal>
      )}
    </div>
  );
}
