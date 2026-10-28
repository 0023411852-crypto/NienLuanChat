import { useChat } from '../../state/ChatContext';
import { ChartIcon, HashIcon, UsersIcon } from '../BieuTuong';
import BangDieuKhien from './BangDieuKhien';
import QuanTriNguoiDung from './QuanTriNguoiDung';
import QuanTriKenh from './QuanTriKenh';

export default function TrangQuanTri({ route, onLogout }: { route: string; onLogout: () => void }) {
  const { me } = useChat();
  const isAdmin = me.role === 'ADMIN';
  const tabs = isAdmin
    ? [
        { key: '', label: 'Tổng quan', icon: <ChartIcon /> },
        { key: 'users', label: 'Người dùng', icon: <UsersIcon className="h-4 w-4" /> },
        { key: 'channels', label: 'Kênh & lớp học phần', icon: <HashIcon className="h-4 w-4" /> },
      ]
    : [{ key: 'channels', label: 'Lớp học phần của tôi', icon: <HashIcon className="h-4 w-4" /> }];
  const current = tabs.some((t) => t.key === route) ? route : tabs[0].key;
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50 dark:bg-[#18191a]" data-admin-page>
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#202124] px-8 pt-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{isAdmin ? 'Trang quản trị' : 'Quản lý lớp học phần'}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isAdmin ? 'Quản lý tài khoản, kênh lớp học phần, kênh thông báo và theo dõi hoạt động hệ thống' : 'Thêm / bớt sinh viên trong các lớp bạn phụ trách'}
            </p>
          </div>
          <button
            onClick={onLogout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Đăng xuất
          </button>
        </div>
        <nav className="mt-4 flex gap-1">
          {tabs.map((t) => (
            <a
              key={t.key}
              href={`#/admin${t.key ? `/${t.key}` : ''}`}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold ${current === t.key ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-300' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
            >
              {t.icon} {t.label}
            </a>
          ))}
        </nav>
      </header>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-8">
        {current === '' && <BangDieuKhien />}
        {current === 'users' && <QuanTriNguoiDung />}
        {current === 'channels' && <QuanTriKenh />}
      </div>
    </div>
  );
}
