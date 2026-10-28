import { useEffect, useRef, useState } from 'react';
import type { User } from '../types';
import { getTheme, setTheme, type Theme } from '../lib/theme';
import AnhDaiDien from './AnhDaiDien';
import {
  ChatBubbleIcon,
  ContactBookIcon,
  GearIcon,
  LogoutIcon,
  MoonIcon,
  ShieldIcon,
  SunIcon,
} from './BieuTuong';

export type MainNavTab = 'chats' | 'contacts';

interface ThanhDieuHuongProps {
  activeTab: MainNavTab;
  onTabChange: (tab: MainNavTab) => void;
  unreadTotal: number;
  pendingRequestsTotal: number;
  me: User;
  onOpenProfile: () => void;
  onOpenAdmin?: () => void;
  onLogout: () => void;
}

export default function ThanhDieuHuong({
  activeTab,
  onTabChange,
  unreadTotal,
  pendingRequestsTotal,
  me,
  onOpenProfile,
  onOpenAdmin,
  onLogout,
}: ThanhDieuHuongProps) {
  const isAdmin = me.role === 'ADMIN';
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setCurrentTheme] = useState<Theme>(() => getTheme());
  const settingRef = useRef<HTMLDivElement>(null);

  // Đồng bộ theme khi có sự kiện thay đổi
  useEffect(() => {
    const onThemeChanged = (e: Event) => {
      const t = (e as CustomEvent<Theme>).detail;
      if (t) setCurrentTheme(t);
    };
    window.addEventListener('khoachat:theme-changed', onThemeChanged);
    return () => window.removeEventListener('khoachat:theme-changed', onThemeChanged);
  }, []);

  // Đóng menu cài đặt khi click ra ngoài
  useEffect(() => {
    const onWindowClick = (e: MouseEvent) => {
      if (settingRef.current && !settingRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    window.addEventListener('click', onWindowClick);
    return () => window.removeEventListener('click', onWindowClick);
  }, []);

  const handleThemeChange = (t: Theme) => {
    setCurrentTheme(t);
    setTheme(t);
  };

  return (
    <aside className="relative flex w-16 shrink-0 flex-col items-center justify-between bg-sky-800 py-3 text-white select-none shadow-md z-30 h-full dark:bg-[#18191a] dark:border-r dark:border-slate-800 transition-colors">
      {/* Top: AnhDaiDien & Main Tabs */}
      <div className="flex flex-col items-center gap-4 w-full">
        {/* AnhDaiDien / Profile */}
        <button
          onClick={onOpenProfile}
          title={`${me.name} (Bấm để xem hồ sơ / đổi ảnh đại diện)`}
          className="group relative p-1 rounded-2xl transition hover:ring-2 hover:ring-white/40"
        >
          <AnhDaiDien id={me.id} name={me.name} src={me.avatar} size={42} />
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-sky-800 dark:border-slate-900 bg-emerald-500" />
        </button>

        {/* Main Navigation Tabs */}
        <div className="flex flex-col items-center gap-2 w-full px-2 mt-1">
          <button
            onClick={() => onTabChange('chats')}
            title="Tin nhắn"
            className={`relative flex h-11 w-11 items-center justify-center rounded-2xl transition ${
              activeTab === 'chats'
                ? 'bg-white/20 text-white shadow-inner font-semibold'
                : 'text-sky-200 hover:bg-white/10 hover:text-white dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <ChatBubbleIcon className="h-6 w-6" />
            {unreadTotal > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow">
                {unreadTotal > 99 ? '99+' : unreadTotal}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('contacts')}
            title="Danh bạ & Bạn bè"
            className={`relative flex h-11 w-11 items-center justify-center rounded-2xl transition ${
              activeTab === 'contacts'
                ? 'bg-white/20 text-white shadow-inner font-semibold'
                : 'text-sky-200 hover:bg-white/10 hover:text-white dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <ContactBookIcon className="h-6 w-6" />
            {pendingRequestsTotal > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow">
                {pendingRequestsTotal > 99 ? '99+' : pendingRequestsTotal}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Bottom: Duy nhất 1 ô Cài đặt (Gear Icon) kiểu Zalo */}
      <div className="flex flex-col items-center w-full px-2" ref={settingRef}>
        <button
          onClick={() => setShowSettings((prev) => !prev)}
          title="Cài đặt"
          className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${
            showSettings
              ? 'bg-white/25 text-white shadow-inner'
              : 'text-sky-200 hover:bg-white/10 hover:text-white dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <GearIcon className="h-6 w-6" />
        </button>

        {/* Menu Cài đặt Zalo nổi sang bên phải */}
        {showSettings && (
          <div className="absolute bottom-3 left-16 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 text-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            {/* Header mục Giao diện */}
            <div className="px-2.5 py-1.5">
              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2">
                Giao diện ứng dụng
              </div>

              {/* Bộ chuyển đổi Sáng / Tối trực quan */}
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                    theme === 'light'
                      ? 'bg-white text-sky-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <SunIcon className="h-4 w-4 text-amber-500" />
                  <span>Sáng</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                    theme === 'dark'
                      ? 'bg-slate-900 text-sky-400 shadow-sm border border-slate-700'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <MoonIcon className="h-4 w-4 text-indigo-400" />
                  <span>Tối</span>
                </button>
              </div>
            </div>

            <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />

            {/* Thông tin hồ sơ */}
            <button
              type="button"
              onClick={() => {
                setShowSettings(false);
                onOpenProfile();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 transition"
            >
              <AnhDaiDien id={me.id} name={me.name} src={me.avatar} size={24} />
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate font-semibold">{me.name}</div>
                <div className="text-[10px] text-slate-400">Xem hồ sơ & đổi avatar</div>
              </div>
            </button>

            {/* Trang quản trị chỉ dành cho admin */}
            {isAdmin && onOpenAdmin && (
              <button
                type="button"
                onClick={() => {
                  setShowSettings(false);
                  onOpenAdmin();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 transition"
              >
                <ShieldIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <span className="truncate">Trang quản trị Khoa</span>
              </button>
            )}

            <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />

            {/* Đăng xuất */}
            <button
              type="button"
              onClick={() => {
                setShowSettings(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
            >
              <LogoutIcon className="h-4 w-4" />
              <span>Đăng xuất</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
