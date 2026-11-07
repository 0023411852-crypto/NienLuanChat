import { useState, useMemo } from 'react';
import { useChat } from '../state/ChatContext';
import { roleLabel } from '../lib/format';
import type { FriendUser } from '../types';
import AnhDaiDien from './AnhDaiDien';
import { SearchIcon, ShieldIcon, UsersIcon, XIcon } from './BieuTuong';

interface XemDanhBaProps {
  onOpenDirect: (userId: string) => void;
}

type RoleCategory = 'ALL' | 'STUDENT' | 'LECTURER' | 'ADMIN';

export default function XemDanhBa({ onOpenDirect }: XemDanhBaProps) {
  const { state, friends } = useChat();
  const [roleFilter, setRoleFilter] = useState<RoleCategory>('ALL');
  const [keyword, setKeyword] = useState('');

  // Lọc danh bạ thành viên theo 3 phân loại người dùng (Sinh viên, Giảng viên, Admin)
  const filteredMembers = useMemo(() => {
    let base = friends;
    if (roleFilter === 'STUDENT') {
      base = friends.filter((f) => f.role === 'STUDENT');
    } else if (roleFilter === 'LECTURER') {
      base = friends.filter((f) => f.role === 'LECTURER');
    } else if (roleFilter === 'ADMIN') {
      base = friends.filter((f) => f.role === 'ADMIN');
    }

    const q = keyword.trim().toLowerCase();
    if (!q) return base;

    return base.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q) ||
        (f.studentCode && f.studentCode.toLowerCase().includes(q)),
    );
  }, [friends, keyword, roleFilter]);

  const studentCount = useMemo(
    () => friends.filter((f) => f.role === 'STUDENT').length,
    [friends],
  );
  const lecturerCount = useMemo(
    () => friends.filter((f) => f.role === 'LECTURER').length,
    [friends],
  );
  const adminCount = useMemo(
    () => friends.filter((f) => f.role === 'ADMIN').length,
    [friends],
  );

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-900';
      case 'LECTURER':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-900';
      case 'STUDENT':
      default:
        return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-900';
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-white dark:bg-[#18191a]">
      {/* CỘT 1: Danh bạ Sub-sidebar */}
      <aside className="flex h-full w-80 shrink-0 flex-col border-r border-slate-200 bg-white select-none dark:border-slate-800 dark:bg-[#202124]">
        {/* Header danh bạ */}
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Danh bạ nội bộ</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            3 phân loại: Sinh viên, Giảng viên & Quản trị viên
          </p>

          {/* Ô tìm kiếm nhanh */}
          <div className="relative mt-3 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm transition focus-within:border-sky-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-100 dark:border-slate-700 dark:bg-slate-800/80 dark:focus-within:bg-slate-800 dark:focus-within:ring-sky-950/40">
            <SearchIcon className="h-4 w-4 text-slate-400 shrink-0 mr-2" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo tên, MSSV, email..."
              className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100"
            />
            {keyword && (
              <button
                type="button"
                onClick={() => setKeyword('')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Danh mục phân loại 3 vai trò người dùng */}
        <nav className="flex-1 space-y-1 p-3">
          {/* Tất cả */}
          <button
            onClick={() => setRoleFilter('ALL')}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm transition ${
              roleFilter === 'ALL'
                ? 'bg-sky-50 text-sky-800 font-semibold dark:bg-sky-950/50 dark:text-sky-300'
                : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  roleFilter === 'ALL'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                <UsersIcon className="h-5 w-5" />
              </div>
              <span>Tất cả thành viên</span>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {friends.length}
            </span>
          </button>

          {/* 1. Sinh viên */}
          <button
            onClick={() => setRoleFilter('STUDENT')}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm transition ${
              roleFilter === 'STUDENT'
                ? 'bg-sky-50 text-sky-800 font-semibold dark:bg-sky-950/50 dark:text-sky-300'
                : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  roleFilter === 'STUDENT'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                <UsersIcon className="h-5 w-5 text-sky-500" />
              </div>
              <span>Sinh viên</span>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {studentCount}
            </span>
          </button>

          {/* 2. Giảng viên */}
          <button
            onClick={() => setRoleFilter('LECTURER')}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm transition ${
              roleFilter === 'LECTURER'
                ? 'bg-sky-50 text-sky-800 font-semibold dark:bg-sky-950/50 dark:text-sky-300'
                : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  roleFilter === 'LECTURER'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                <UsersIcon className="h-5 w-5 text-indigo-500" />
              </div>
              <span>Giảng viên</span>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {lecturerCount}
            </span>
          </button>

          {/* 3. Quản trị viên (Admin) */}
          <button
            onClick={() => setRoleFilter('ADMIN')}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm transition ${
              roleFilter === 'ADMIN'
                ? 'bg-rose-50 text-rose-800 font-semibold dark:bg-rose-950/50 dark:text-rose-300'
                : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  roleFilter === 'ADMIN'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                <ShieldIcon className="h-5 w-5 text-rose-500" />
              </div>
              <span>Quản trị viên (Admin)</span>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {adminCount}
            </span>
          </button>
        </nav>
      </aside>

      {/* CỘT 2: Khu vực danh sách thành viên */}
      <section className="flex flex-1 min-w-0 flex-col bg-slate-50 dark:bg-[#18191a] overflow-hidden">
        {/* Top Header */}
        <header className="flex min-h-[68px] items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-[#202124]">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {roleFilter === 'ALL' && `Tất cả thành viên (${filteredMembers.length})`}
              {roleFilter === 'STUDENT' && `Sinh viên (${filteredMembers.length})`}
              {roleFilter === 'LECTURER' && `Giảng viên (${filteredMembers.length})`}
              {roleFilter === 'ADMIN' && `Quản trị viên (${filteredMembers.length})`}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nhắn tin hoặc gọi thoại trực tiếp với bất kỳ ai trong danh bạ nội bộ
            </p>
          </div>

          {/* Tabs chuyển nhanh trên thanh tiêu đề */}
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              onClick={() => setRoleFilter('ALL')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                roleFilter === 'ALL'
                  ? 'bg-white text-slate-800 shadow-sm dark:bg-[#202124] dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Tất cả ({friends.length})
            </button>
            <button
              onClick={() => setRoleFilter('STUDENT')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                roleFilter === 'STUDENT'
                  ? 'bg-white text-slate-800 shadow-sm dark:bg-[#202124] dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Sinh viên ({studentCount})
            </button>
            <button
              onClick={() => setRoleFilter('LECTURER')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                roleFilter === 'LECTURER'
                  ? 'bg-white text-slate-800 shadow-sm dark:bg-[#202124] dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Giảng viên ({lecturerCount})
            </button>
            <button
              onClick={() => setRoleFilter('ADMIN')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                roleFilter === 'ADMIN'
                  ? 'bg-white text-slate-800 shadow-sm dark:bg-[#202124] dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Admin ({adminCount})
            </button>
          </div>
        </header>

        {/* Nội dung danh bạ có thể cuộn */}
        <div className="scroll-thin flex-1 overflow-y-auto p-6">
          {filteredMembers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-[#202124]">
              <UsersIcon className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                {keyword ? 'Không tìm thấy thành viên nào khớp từ khoá' : 'Chưa có thành viên nào trong danh mục'}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {keyword ? 'Thử tìm kiếm với họ tên, mã số sinh viên (MSSV) hoặc email khác.' : ''}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredMembers.map((f: FriendUser) => (
                <div
                  key={f.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-[#202124]"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <AnhDaiDien id={f.id} name={f.name} src={f.avatar} size={48} online={!!state.online[f.id]} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">{f.name}</span>
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${getRoleBadgeStyle(f.role)}`}>
                          {roleLabel[f.role]}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {f.studentCode ? `MSSV: ${f.studentCode}` : f.email}
                      </div>
                      <div className="text-[11px] mt-1">
                        {state.online[f.id] ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">● Đang hoạt động</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">Ngoại tuyến</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <button
                      onClick={() => onOpenDirect(f.id)}
                      className="flex-1 rounded-xl bg-sky-600 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 transition text-center"
                    >
                      Nhắn tin
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
