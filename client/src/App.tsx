import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, tokenStore } from './lib/api';
import { disablePush, registerSW } from './lib/notify';
import type { User } from './types';
import TrangDangNhap from './components/TrangDangNhap';
import BoCucChat from './components/BoCucChat';
import ThongBaoNhanh from './components/ThongBaoNhanh';
import { ChatProvider } from './state/ChatContext';
import { CallProvider } from './state/CallContext';
import ModalCuocGoi from './components/ModalCuocGoi';
import { ToastProvider } from './state/toast';

const USER_KEY = 'khoachat.user';

export default function App() {
  const [me, setMe] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw && tokenStore.get() ? (JSON.parse(raw) as User) : null;
  });

  /** Phiên hết hạn / bị khoá: chỉ xoá dữ liệu cục bộ */
  const clearSession = useCallback(() => {
    tokenStore.clear();
    localStorage.removeItem(USER_KEY);
    setMe(null);
  }, []);

  /** Người dùng bấm đăng xuất: huỷ đăng ký push trên trình duyệt này + xoá cookie */
  const logout = useCallback(async () => {
    await disablePush();
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    clearSession();
    if (location.hash) history.replaceState(null, '', location.pathname);
  }, [clearSession]);

  useEffect(() => {
    registerSW();
  }, []);

  useEffect(() => {
    const onUserUpdated = (event: Event) => {
      const user = (event as CustomEvent<User>).detail;
      if (!user || user.id !== me?.id) return;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      setMe(user);
    };
    window.addEventListener('khoachat:user-updated', onUserUpdated);
    return () => window.removeEventListener('khoachat:user-updated', onUserUpdated);
  }, [me?.id]);

  // Kiểm tra lại phiên đăng nhập (nếu mất mạng thì vẫn dùng thông tin đã lưu -> xem được tin cũ & soạn tin offline)
  useEffect(() => {
    if (!tokenStore.get()) return;
    api<{ user: User }>('/api/auth/me')
      .then(({ user }) => {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        setMe(user);
      })
      .catch((e) => {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) clearSession();
      });
  }, [clearSession]);

  const onLogin = (token: string, user: User) => {
    tokenStore.set(token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setMe(user);
  };

  return (
    <ToastProvider>
      {me ? (
        <ChatProvider key={me.id} me={me} onUnauthorized={clearSession}>
          <CallProvider>
            <BoCucChat onLogout={logout} />
            <ModalCuocGoi />
          </CallProvider>
        </ChatProvider>
      ) : (
        <TrangDangNhap onLogin={onLogin} />
      )}
      <ThongBaoNhanh />
    </ToastProvider>
  );
}

// Bọc an toàn chống lỗi sập trang (Trắng màn hình)
import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Lỗi giao diện:', error, errorInfo);
  }

  handleReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-full items-center justify-center bg-slate-50 p-6 text-center">
          <div className="max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-slate-800">Đã xảy ra sự cố hiển thị</h2>
            <p className="mt-2 text-sm text-slate-500">
              Bộ nhớ tạm (cache) của phiên đăng nhập trước có thể bị lỗi. Nhấn nút bên dưới để khôi phục lại trang.
            </p>
            {this.state.error && (
              <pre className="mt-4 max-h-48 overflow-auto rounded-xl bg-rose-50 p-3 text-left text-xs font-mono text-rose-700 border border-rose-200">
                <strong>{this.state.error.message}</strong>
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="mt-6 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
            >
              Xóa bộ nhớ tạm &amp; Về trang Đăng nhập
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
