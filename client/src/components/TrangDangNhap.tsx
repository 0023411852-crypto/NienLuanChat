import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import type { User } from '../types';

const DEMO = [
  { label: 'Sinh viên', email: 'sv01@khoachat.edu.vn', password: 'SinhVien@123' },
  { label: 'Giảng viên', email: 'gv.an@khoachat.edu.vn', password: 'GiangVien@123' },
  { label: 'Quản trị', email: 'admin@khoachat.edu.vn', password: 'Admin@123' },
];

export default function TrangDangNhap({ onLogin }: { onLogin: (token: string, user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res =
        mode === 'login'
          ? await api<{ token: string; user: User }>('/api/auth/login', { method: 'POST', json: { email, password } })
          : await api<{ token: string; user: User }>('/api/auth/register', {
              method: 'POST',
              json: { email, password, name, studentCode: studentCode || undefined },
            });
      onLogin(res.token, res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  }

  const input =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:text-white dark:bg-slate-800 dark:border-slate-700 dark:focus:border-sky-500 dark:focus:ring-sky-950/40';

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl shadow-indigo-100 md:grid-cols-2">
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-indigo-600 to-sky-500 p-10 text-white md:flex">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="" className="h-11 w-11 rounded-xl ring-2 ring-white/40" />
            <span className="text-2xl font-bold tracking-tight">KhoaChat</span>
          </div>
          <div>
            <h2 className="text-3xl font-bold leading-tight">Nhắn tin nội bộ cho lớp học &amp; khoa</h2>
            <ul className="mt-6 space-y-3 text-sm text-indigo-50">
              <li>✦ Kênh lớp học phần, kênh thông báo, nhắn tin riêng</li>
              <li>✦ Nhắn tin thời gian thực, đồng bộ "đã đọc" mọi thiết bị</li>
              <li>✦ Không mất tin khi mất kết nối mạng</li>
            </ul>
          </div>
          <p className="text-xs text-indigo-100/80">Niên luận · Khoa Công nghệ Thông tin</p>
        </div>

        <div className="p-8 sm:p-10">
          <div className="mb-6 flex items-center gap-3 md:hidden">
            <img src="/logo.svg" alt="" className="h-10 w-10" />
            <span className="text-xl font-bold">KhoaChat</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'login' ? 'Dùng email trường để tiếp tục' : 'Tài khoản mới mặc định là sinh viên'}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Họ và tên</label>
                  <input className={input} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Nguyễn Văn A" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Mã số sinh viên</label>
                  <input className={input} value={studentCode} onChange={(e) => setStudentCode(e.target.value)} placeholder="B2100123" />
                </div>
              </>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ten@khoachat.edu.vn" autoComplete="username" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Mật khẩu</label>
              <input className={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </div>
            {error && <div className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            {mode === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
            <button className="font-semibold text-indigo-600 hover:underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
              {mode === 'login' ? 'Đăng ký' : 'Đăng nhập'}
            </button>
          </p>

          {mode === 'login' && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Tài khoản dùng thử</p>
              <div className="flex flex-wrap gap-2">
                {DEMO.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => { setEmail(d.email); setPassword(d.password); }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
