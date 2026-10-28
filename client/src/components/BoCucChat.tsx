import { useCallback, useEffect, useMemo, useState } from 'react';
import { useChat } from '../state/ChatContext';
import ThanhBen from './ThanhBen';
import XemKenh from './XemKenh';
import ModalTimKiem from './ModalTimKiem';
import type { PanelTab } from './CotPhai';
import TrangQuanTri from './admin/TrangQuanTri';
import ThanhDieuHuong, { type MainNavTab } from './ThanhDieuHuong';
import XemDanhBa from './XemDanhBa';
import ChinhSuaAnhDaiDien from './ChinhSuaAnhDaiDien';
import { api } from '../lib/api';
import { useToast } from '../state/toast';

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export default function BoCucChat({ onLogout }: { onLogout: () => void }) {
  const { state, me, selectChannel, openDirect, incomingRequests } = useChat();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<MainNavTab>('chats');
  const [panel, setPanel] = useState<PanelTab | null>(() => (localStorage.getItem('khoachat.panel') as PanelTab | null) || 'members');
  const [search, setSearch] = useState<{ channelId?: string } | null>(null);
  const [showChinhSuaAnhDaiDien, setShowChinhSuaAnhDaiDien] = useState(false);
  const hash = useHash();
  const joinToken = hash.match(/^#\/join\/([A-Za-z0-9_-]{40,50})$/)?.[1] ?? null;
  const adminRoute = hash.startsWith('#/admin') && me.role === 'ADMIN' ? hash.slice('#/admin'.length).replace(/^\//, '') : null;

  useEffect(() => {
    if (hash.startsWith('#/admin') && me.role !== 'ADMIN') location.hash = '#/';
  }, [hash, me.role]);

  useEffect(() => {
    if (!joinToken || !state.ready) return;
    let active = true;
    api<{ channel: { id: string } }>(`/api/channels/join/${joinToken}`, { method: 'POST', json: {} })
      .then(({ channel }) => {
        if (!active) return;
        location.hash = '#/';
        selectChannel(channel.id);
        setActiveTab('chats');
        toast.push({ kind: 'success', title: 'Đã tham gia nhóm' });
      })
      .catch((e) => {
        if (active) toast.push({ kind: 'error', title: (e as Error).message || 'Không thể tham gia nhóm' });
      });
    return () => { active = false; };
  }, [joinToken, state.ready, selectChannel, toast]);

  const totalUnread = useMemo(
    () => Object.values(state.channels).reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    [state.channels],
  );

  const onPanel = useCallback((t: PanelTab | null) => {
    setPanel(t);
    localStorage.setItem('khoachat.panel', t ?? '');
  }, []);

  // Tự chọn kênh gần nhất khi mở app
  useEffect(() => {
    if (!state.ready || (state.activeId && state.channels[state.activeId])) return;
    const last = localStorage.getItem('khoachat.lastChannel');
    const list = Object.values(state.channels);
    const pick = (last && state.channels[last]) || list.find((c) => c.type === 'CLASS') || list[0];
    if (pick) selectChannel(pick.id);
  }, [state.ready, state.channels, state.activeId, selectChannel]);

  // Ctrl/Cmd + K: tìm kiếm toàn cục
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearch((s) => (s ? null : {}));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Nhảy tới tin nhắn (từ tìm kiếm / thông báo) khi đang ở trang quản trị -> về khung chat
  const jumpNonce = state.jump?.nonce;
  useEffect(() => {
    if (jumpNonce) {
      if (location.hash.startsWith('#/admin')) location.hash = '#/';
      setActiveTab('chats');
    }
  }, [jumpNonce]);

  const active = state.activeId ? state.channels[state.activeId] : null;
  const closeSearch = useCallback(() => setSearch(null), []);

  const handleOpenDirect = useCallback(async (userId: string) => {
    await openDirect(userId);
    setActiveTab('chats');
  }, [openDirect]);

  // Khi ở route admin, hiển thị toàn màn hình không có ThanhDieuHuong/ThanhBen
  if (adminRoute !== null) {
    return (
      <div className="flex h-full w-full bg-white dark:bg-[#18191a]">
        <TrangQuanTri route={adminRoute} onLogout={onLogout} />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-100 dark:bg-[#18191a]">
      {/* Zalo-style Navigation Rail (Desktop Web App) */}
      <ThanhDieuHuong
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        unreadTotal={totalUnread}
        pendingRequestsTotal={(incomingRequests || []).length}
        me={me}
        onOpenProfile={() => setShowChinhSuaAnhDaiDien(true)}
        onOpenAdmin={() => (location.hash = '#/admin')}
        onLogout={onLogout}
      />

      {/* Main App Container */}
      {activeTab === 'chats' ? (
        <div className="flex min-w-0 flex-1 h-full overflow-hidden">
          {/* Chat ThanhBen (Channel list) */}
          <ThanhBen onLogout={onLogout} onSearch={() => setSearch({})} adminActive={adminRoute !== null} />

          {/* Chat Window */}
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-[#18191a]">
            {state.connection === 'offline' && (
              <div className="flex items-center justify-center gap-2 bg-amber-50 dark:bg-amber-950/60 px-4 py-2 text-sm text-amber-800 dark:text-amber-200 border-b border-amber-200 dark:border-amber-900/60">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                Mất kết nối mạng — tin nhắn bạn soạn sẽ được lưu lại và tự gửi khi có mạng trở lại.
              </div>
            )}
            {active ? (
              <XemKenh key={active.id} channel={active} panel={panel} onPanel={onPanel} onSearch={(channelId) => setSearch({ channelId })} />
            ) : (
              <div className="flex flex-1 items-center justify-center text-slate-400 dark:text-slate-500">
                {state.ready ? 'Chọn một kênh để bắt đầu trò chuyện' : 'Đang tải...'}
              </div>
            )}
          </main>
        </div>
      ) : (
        /* Contacts / Friends Tab */
        <main className="flex min-w-0 flex-1 h-full overflow-hidden bg-white dark:bg-[#18191a]">
          <XemDanhBa onOpenDirect={handleOpenDirect} />
        </main>
      )}

      {search && <ModalTimKiem initialChannelId={search.channelId} onClose={closeSearch} />}
      {showChinhSuaAnhDaiDien && (
        <ChinhSuaAnhDaiDien
          me={me}
          onClose={() => setShowChinhSuaAnhDaiDien(false)}
          onUpdated={(user) => window.dispatchEvent(new CustomEvent('khoachat:user-updated', { detail: user }))}
        />
      )}
    </div>
  );
}
