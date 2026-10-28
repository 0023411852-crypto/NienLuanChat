import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '../state/ChatContext';
import { useToast } from '../state/toast';
import { channelTitle, directPeer, fmtShort, roleLabel } from '../lib/format';
import { disablePush, enableNotifications, hasPushSubscription, notifySupported, playSound, soundPref } from '../lib/notify';
import { parseCallLog, parseContactCard, type Channel } from '../types';
import AnhDaiDien from './AnhDaiDien';
import {
  BellIcon,
  BellOffIcon,
  CheckIcon,
  DotsHorizontalIcon,
  HashIcon,
  LogoutIcon,
  MegaphoneIcon,
  PinIcon,
  PinOutlineIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from './BieuTuong';
import ModalTinNhanRieng from './ModalTinNhanRieng';
import ModalTaoCongDong from './ModalTaoCongDong';
import ChinhSuaAnhDaiDien from './ChinhSuaAnhDaiDien';
import Modal from './ui/HopThoai';

function preview(c: Channel) {
  const m = c.lastMessage;
  if (!m) return '';
  if (m.deletedAt) return 'Tin nhắn đã bị xoá';
  if (m.content) {
    const card = parseContactCard(m.content);
    if (card) return `📇 [Danh thiếp] ${card.name}`;
    const call = parseCallLog(m.content);
    if (call) {
      if (call.status === 'ended') {
        const d = call.duration || 0;
        return `📞 Cuộc gọi thoại (${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')})`;
      }
      if (call.status === 'missed') return '📞 Cuộc gọi nhỡ';
      if (call.status === 'declined') return '📞 Cuộc gọi bị từ chối';
      return '📞 Cuộc gọi đã huỷ';
    }
    return m.content;
  }
  if (m.attachments?.length) return m.attachments.every((a) => a.isImage) ? '[Ảnh]' : `[Tệp] ${m.attachments[0].filename}`;
  return '';
}

function NotifySettings({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [perm, setPerm] = useState(notifySupported() ? Notification.permission : 'denied');
  const [push, setPush] = useState(false);
  const [sound, setSound] = useState(soundPref.get());
  const [busy, setBusy] = useState(false);
  useEffect(() => { hasPushSubscription().then(setPush); }, []);
  const toggle = async () => {
    setBusy(true);
    if (push) {
      await disablePush();
      setPush(false);
      toast.push({ kind: 'info', title: 'Đã tắt thông báo đẩy trên trình duyệt này' });
    } else {
      const r = await enableNotifications();
      setPerm(r.permission);
      setPush(r.push);
      if (r.push) toast.push({ kind: 'success', title: 'Đã bật thông báo', body: 'Bạn sẽ nhận thông báo kể cả khi đóng tab' });
      else if (r.permission === 'denied') toast.push({ kind: 'error', title: 'Trình duyệt đã chặn thông báo', body: 'Hãy cho phép trong cài đặt trang web' });
      else if (r.error) toast.push({ kind: 'error', title: 'Không bật được thông báo đẩy', body: r.error });
    }
    setBusy(false);
  };
  return (
    <Modal title="Cài đặt thông báo" onClose={onClose} width="max-w-md">
      <div className="space-y-4 text-sm">
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">Thông báo trình duyệt & Web Push</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nhận thông báo khi tab bị ẩn hoặc đã đóng. Trạng thái quyền:{' '}
              <b>{perm === 'granted' ? 'đã cho phép' : perm === 'denied' ? 'bị chặn' : 'chưa hỏi'}</b>
            </p>
          </div>
          <button disabled={busy} onClick={toggle} className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold ${push ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200' : 'bg-indigo-600 dark:bg-sky-600 text-white'} disabled:opacity-50`}>
            {push ? 'Tắt' : 'Bật'}
          </button>
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">Âm thanh khi có tin nhắn</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Phát tiếng "ting" khi có tin cần chú ý</p>
          </div>
          <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={sound} onChange={(e) => { soundPref.set(e.target.checked); setSound(e.target.checked); if (e.target.checked) playSound(); }} />
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">Mức thông báo cho từng kênh (tất cả / chỉ khi nhắc tên / tắt) chỉnh ở biểu tượng chuông trên đầu mỗi kênh.</p>
      </div>
    </Modal>
  );
}

function sortByActivity(a: Channel, b: Channel) {
  return (b.lastMessage?.seq ?? 0) - (a.lastMessage?.seq ?? 0);
}

interface ContextMenuState {
  channel: Channel;
  x: number;
  y: number;
}

export default function ThanhBen({
  onLogout,
  onSearch,
  adminActive,
  onSelectChannel,
}: {
  onLogout: () => void;
  onSearch: () => void;
  adminActive?: boolean;
  onSelectChannel?: (id: string) => void;
}) {
  const { state, me, selectChannel, markRead, setNotifyLevel, upsertChannel } = useChat();
  const toast = useToast();
  const [showNew, setShowNew] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [showNotify, setShowNotify] = useState(false);
  const [showChinhSuaAnhDaiDien, setShowChinhSuaAnhDaiDien] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'direct' | 'class' | 'community'>('all');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [actionMenuChannelId, setActionMenuChannelId] = useState<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Quản lý ghim hội thoại (lưu vào localStorage theo tài khoản)
  const PINNED_KEY = `khoachat.pinned_chats.${me.id}`;
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(PINNED_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const isPinned = (channelId: string) => pinnedIds.includes(channelId);

  const togglePin = (channelId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setPinnedIds((prev) => {
      const next = prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [channelId, ...prev];
      localStorage.setItem(PINNED_KEY, JSON.stringify(next));
      toast.push({
        kind: 'success',
        title: prev.includes(channelId) ? 'Đã bỏ ghim đoạn chat' : 'Đã ghim đoạn chat lên đầu',
        timeout: 2000,
      });
      return next;
    });
    setContextMenu(null);
    setActionMenuChannelId(null);
  };

  const handleToggleMute = async (channel: Channel, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const nextLevel = channel.notifyLevel === 'NONE' ? 'DEFAULT' : 'NONE';
    await setNotifyLevel(channel.id, nextLevel);
    toast.push({
      kind: 'info',
      title: nextLevel === 'NONE' ? 'Đã tắt thông báo cuộc trò chuyện' : 'Đã bật thông báo cuộc trò chuyện',
      timeout: 2000,
    });
    setContextMenu(null);
    setActionMenuChannelId(null);
  };

  const handleMarkAsRead = (channel: Channel, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (channel.lastMessage) {
      markRead(channel.id, channel.lastMessage.id);
      toast.push({ kind: 'info', title: 'Đã đánh dấu là đã đọc', timeout: 1500 });
    }
    setContextMenu(null);
    setActionMenuChannelId(null);
  };

  // Đóng context menu khi click ra ngoài hoặc scroll
  useEffect(() => {
    const onWindowClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setActionMenuChannelId(null);
      }
    };
    const onScroll = () => {
      setContextMenu(null);
      setActionMenuChannelId(null);
    };
    window.addEventListener('click', onWindowClick);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('click', onWindowClick);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  const canAdmin = me.role === 'ADMIN';
  const conn = state.connection;

  const allChannels = useMemo(() => Object.values(state.channels), [state.channels]);

  const totalUnread = useMemo(
    () => allChannels.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [allChannels],
  );

  // Lọc theo tabs: Tất cả / Chưa đọc + Phân loại (Lớp học / Cá nhân)
  const filteredChannels = useMemo(() => {
    let list = allChannels;
    if (filterTab === 'unread') {
      list = list.filter((c) => (c.unreadCount || 0) > 0);
    }
    if (typeFilter === 'direct') {
      list = list.filter((c) => c.type === 'DIRECT');
    } else if (typeFilter === 'class') {
      list = list.filter((c) => c.type === 'CLASS');
    } else if (typeFilter === 'community') {
      list = list.filter((c) => c.type === 'COMMUNITY');
    }
    return list;
  }, [allChannels, filterTab, typeFilter]);

  // Phân chia nhóm Đã ghim và Nhóm thông thường
  const { pinnedChannels, regularChannels } = useMemo(() => {
    const pinned: Channel[] = [];
    const regular: Channel[] = [];
    filteredChannels.forEach((c) => {
      if (isPinned(c.id)) pinned.push(c);
      else regular.push(c);
    });
    return {
      pinnedChannels: pinned.sort(sortByActivity),
      regularChannels: regular.sort(sortByActivity),
    };
  }, [filteredChannels, pinnedIds]);

  const openContextMenu = (channel: Channel, x: number, y: number) => {
    // Điều chỉnh toạ độ để không bị tràn màn hình
    const menuWidth = 190;
    const menuHeight = 150;
    const posX = x + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 10 : x;
    const posY = y + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 10 : y;
    setContextMenu({ channel, x: posX, y: posY });
  };

  const renderChannelItem = (c: Channel, pinned: boolean) => {
    const active = !adminActive && state.activeId === c.id;
    const mentions = active ? 0 : c.mentionCount;
    const muted = c.notifyLevel === 'NONE';
    const unread = active ? 0 : c.unreadCount;
    const peer = c.type === 'DIRECT' ? directPeer(c, me) : null;

    const initials = c.courseCode
      ? c.courseCode.slice(0, 2).toUpperCase()
      : (c.name || 'KC').slice(0, 2).toUpperCase();

    return (
      <li key={c.id} className="relative group select-none">
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            selectChannel(c.id);
            onSelectChannel?.(c.id);
            if (adminActive) location.hash = '#/';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              selectChannel(c.id);
              onSelectChannel?.(c.id);
              if (adminActive) location.hash = '#/';
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openContextMenu(c, e.clientX, e.clientY);
          }}
          className={`flex w-full cursor-pointer items-center gap-3 px-3.5 py-3 text-left transition ${
            active
              ? 'bg-sky-50 text-sky-950 dark:bg-sky-950/40 dark:text-sky-200 font-semibold border-l-[3.5px] border-sky-600 dark:border-sky-500'
              : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/60 border-l-[3.5px] border-transparent'
          }`}
        >
          {/* AnhDaiDien chuẩn Zalo */}
          <div className="relative shrink-0">
            {peer ? (
              <AnhDaiDien id={peer.id} name={peer.name} src={peer.avatar} size={46} online={!!state.online[peer.id]} />
            ) : c.avatar ? (
              <AnhDaiDien id={c.id} name={c.name} src={`/api/channel-avatars/${c.id}`} size={46} />
            ) : c.type === 'CLASS' ? (
              <div className={`flex h-[46px] w-[46px] items-center justify-center rounded-full ${active ? 'bg-sky-600 text-white' : 'bg-sky-100 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300'} font-bold shadow-sm`}>
                <span className="text-sm">{initials}</span>
              </div>
            ) : c.type === 'COMMUNITY' ? (
              <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/80 dark:text-violet-300 shadow-sm">
                <UsersIcon className="h-5 w-5" />
              </div>
            ) : (
              <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 shadow-sm">
                <MegaphoneIcon className="h-5 w-5" />
              </div>
            )}
          </div>

          {/* Text Content */}
          <div className="min-w-0 flex-1">
            {/* Top row: Name & Time / Quick Hover Buttons */}
            <div className="flex items-center justify-between gap-1.5">
              <span className={`truncate text-sm ${unread ? 'font-bold text-slate-900 dark:text-white' : active ? 'font-semibold text-sky-900 dark:text-sky-200' : 'font-medium text-slate-800 dark:text-slate-200'}`}>
                {c.type === 'CLASS' && c.courseCode ? (
                  <>{c.courseCode} · {c.name}</>
                ) : c.type === 'COMMUNITY' ? (
                  <>{c.name} · Cộng đồng</>
                ) : (
                  channelTitle(c, me)
                )}
              </span>

              {/* Normal Time vs Hover Actions */}
              <div className="shrink-0 flex items-center">
                {/* Bình thường: Hiển thị thời gian */}
                <span className="text-[11px] text-slate-400 group-hover:hidden">
                  {c.lastMessage ? fmtShort(c.lastMessage.createdAt) : ''}
                </span>

                {/* Khi rê chuột: Nút ghim nhanh & Nút menu ba chấm kiểu Zalo */}
                <div className="hidden group-hover:flex items-center gap-1">
                  <button
                    onClick={(e) => togglePin(c.id, e)}
                    title={pinned ? 'Bỏ ghim đoạn chat' : 'Ghim đoạn chat'}
                    className={`rounded-md p-1 transition ${
                      pinned
                        ? 'text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/40'
                        : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {pinned ? <PinIcon className="h-3.5 w-3.5" /> : <PinOutlineIcon className="h-3.5 w-3.5" />}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const rect = e.currentTarget.getBoundingClientRect();
                      openContextMenu(c, rect.right, rect.bottom);
                    }}
                    title="Tuỳ chọn"
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition"
                  >
                    <DotsHorizontalIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom row: Message Snippet & Indicators */}
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className={`truncate text-xs ${unread ? 'font-semibold text-slate-800 dark:text-slate-100' : active ? 'text-sky-800 dark:text-sky-300' : 'text-slate-500 dark:text-slate-400'}`}>
                {c.lastMessage
                  ? `${c.lastMessage.senderId === me.id ? 'Bạn: ' : `${c.lastMessage.sender.name.split(' ').pop()}: `}${preview(c)}`
                  : 'Chưa có tin nhắn'}
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                {pinned && (
                  <PinIcon className="h-3.5 w-3.5 text-slate-400" />
                )}
                {muted && (
                  <BellOffIcon className="h-3.5 w-3.5 text-slate-400" />
                )}
                {mentions > 0 && (
                  <span
                    data-mention-badge
                    title={`${mentions} lần nhắc đến bạn`}
                    className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-slate-900"
                  >
                    @{mentions > 1 ? mentions : ''}
                  </span>
                )}
                {unread > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white shadow-sm">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </li>
    );
  };

  return (
    <aside className="flex h-full min-h-0 w-80 shrink-0 flex-col bg-white text-slate-800 border-r border-slate-200 select-none dark:bg-[#202124] dark:border-slate-800 dark:text-slate-100">
      {/* 1. Header & Tìm kiếm kiểu Zalo */}
      <div className="p-3 pb-2 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Ô tìm kiếm Zalo */}
          <button
            onClick={onSearch}
            data-open-search
            className="flex-1 flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 transition hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <SearchIcon className="h-4 w-4 text-slate-400" />
            <span className="flex-1 text-left">Tìm kiếm...</span>
            <kbd className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 dark:text-slate-300 font-mono">
              Ctrl K
            </kbd>
          </button>

          {/* Nút tạo nhóm mới */}
          <button
            onClick={() => setShowCreateCommunity(true)}
            title={me.role === 'LECTURER' ? 'Tạo cộng đồng (tối đa 2.000 thành viên)' : 'Tạo nhóm (tối đa 101 thành viên)'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition hover:bg-sky-50 dark:hover:bg-slate-700 hover:text-sky-700 dark:hover:text-white"
          >
            <UserPlusIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Link Trang Quản trị nếu có quyền */}
        {canAdmin && (
          <a
            href={adminActive ? '#/' : '#/admin'}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              adminActive
                ? 'bg-sky-600 text-white'
                : 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/60'
            }`}
          >
            <ShieldIcon className="h-3.5 w-3.5" />
            <span>{adminActive ? 'Quay lại trò chuyện' : 'Trang quản trị Khoa'}</span>
          </a>
        )}

        {/* 2. Tabs phân loại Zalo: Tất cả / Chưa đọc + Phân loại nhỏ */}
        <div className="flex items-center justify-between gap-1 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0">
            <button
              onClick={() => setFilterTab('all')}
              className={`rounded-lg px-2.5 py-1 whitespace-nowrap shrink-0 transition ${
                filterTab === 'all'
                  ? 'bg-sky-100/70 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Tất cả
            </button>

            <button
              onClick={() => setFilterTab('unread')}
              className={`relative rounded-lg px-2.5 py-1 whitespace-nowrap shrink-0 transition flex items-center gap-1.5 ${
                filterTab === 'unread'
                  ? 'bg-sky-100/70 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>Chưa đọc</span>
              {totalUnread > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </button>
          </div>

          {/* Lọc loại tin: Tất cả / Lớp học / Bạn bè */}
          <div className="min-w-0 shrink">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | 'direct' | 'class' | 'community')}
              className="w-full truncate rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 outline-none hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
            >
              <option value="all">Phân loại: Tất cả</option>
              <option value="class">Lớp học phần</option>
              <option value="community">Cộng đồng</option>
              <option value="direct">Tin nhắn riêng</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Danh sách cuộc trò chuyện Zalo Stream (Đã ghim lên đầu) */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto">
        {filteredChannels.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
            {filterTab === 'unread' ? 'Không có tin nhắn chưa đọc' : 'Chưa có cuộc trò chuyện nào'}
          </div>
        ) : (
          <ul className="divide-y divide-slate-50 dark:divide-slate-800/40">
            {/* Nhóm Đã Ghim */}
            {pinnedChannels.length > 0 && (
              <>
                <li className="bg-slate-50/60 dark:bg-slate-900/40 px-4 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <PinIcon className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                  <span>Đã ghim ({pinnedChannels.length})</span>
                </li>
                {pinnedChannels.map((c) => renderChannelItem(c, true))}
              </>
            )}

            {/* Nhóm Hội Thoại Khác */}
            {regularChannels.length > 0 && (
              <>
                {pinnedChannels.length > 0 && (
                  <li className="bg-slate-50/60 dark:bg-slate-900/40 px-4 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Tin nhắn khác
                  </li>
                )}
                {regularChannels.map((c) => renderChannelItem(c, false))}
              </>
            )}
          </ul>
        )}
      </nav>

      {/* 4. Footer kết nối & Cài đặt thông báo */}
      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-4 py-2 text-xs bg-slate-50/50 dark:bg-[#1e1f22]">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${conn === 'online' ? 'bg-emerald-500' : conn === 'connecting' ? 'animate-pulse bg-amber-400' : 'bg-rose-500'}`} />
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {conn === 'online' ? 'Đã kết nối' : conn === 'connecting' ? 'Đang kết nối...' : 'Mất mạng'}
          </span>
        </div>

        <button
          onClick={() => setShowNotify(true)}
          title="Cài đặt âm thanh & thông báo"
          className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-400 transition py-1 px-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <BellIcon className="h-3.5 w-3.5" />
          <span>Thông báo</span>
        </button>
      </div>

      {/* Context Menu khi click chuột phải hoặc bấm nút '...' */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[190px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 text-xs text-slate-700 dark:text-slate-200 shadow-xl animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-700 text-[11px] font-semibold text-slate-400 dark:text-slate-500 truncate">
            {channelTitle(contextMenu.channel, me)}
          </div>

          <button
            onClick={() => togglePin(contextMenu.channel.id)}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left hover:bg-sky-50 dark:hover:bg-sky-950/50 hover:text-sky-700 dark:hover:text-sky-300 transition"
          >
            <PinIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <span>{isPinned(contextMenu.channel.id) ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại'}</span>
          </button>

          {contextMenu.channel.unreadCount > 0 && (
            <button
              onClick={() => handleMarkAsRead(contextMenu.channel)}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left hover:bg-sky-50 dark:hover:bg-sky-950/50 hover:text-sky-700 dark:hover:text-sky-300 transition"
            >
              <CheckIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>Đánh dấu đã đọc</span>
            </button>
          )}

          <button
            onClick={() => handleToggleMute(contextMenu.channel)}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left hover:bg-sky-50 dark:hover:bg-sky-950/50 hover:text-sky-700 dark:hover:text-sky-300 transition"
          >
            {contextMenu.channel.notifyLevel === 'NONE' ? (
              <>
                <BellIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span>Bật thông báo</span>
              </>
            ) : (
              <>
                <BellOffIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span>Tắt thông báo</span>
              </>
            )}
          </button>
        </div>
      )}

      {showNew && <ModalTinNhanRieng onClose={() => setShowNew(false)} />}
      {showCreateCommunity && (
        <ModalTaoCongDong
          onClose={() => setShowCreateCommunity(false)}
          onCreated={(channel) => {
            upsertChannel(channel);
            selectChannel(channel.id);
            setShowCreateCommunity(false);
          }}
        />
      )}
      {showNotify && <NotifySettings onClose={() => setShowNotify(false)} />}
      {showChinhSuaAnhDaiDien && (
        <ChinhSuaAnhDaiDien
          me={me}
          onClose={() => setShowChinhSuaAnhDaiDien(false)}
          onUpdated={(user) => window.dispatchEvent(new CustomEvent('khoachat:user-updated', { detail: user }))}
        />
      )}
    </aside>
  );
}
