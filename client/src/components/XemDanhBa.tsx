import { useState, useMemo } from 'react';
import { useChat } from '../state/ChatContext';
import { useCall } from '../state/CallContext';
import { api } from '../lib/api';
import { roleLabel } from '../lib/format';
import type { FriendUser, SearchUserResult } from '../types';
import AnhDaiDien from './AnhDaiDien';
import Modal, { btn } from './ui/HopThoai';
import { CheckIcon, PhoneIcon, PlusIcon, SearchIcon, SendIcon, TrashIcon, UserMinusIcon, UserPlusIcon, UsersIcon, XIcon } from './BieuTuong';

interface XemDanhBaProps {
  onOpenDirect: (userId: string) => void;
}

type SubTab = 'friends' | 'requests' | 'sent';

export default function XemDanhBa({ onOpenDirect }: XemDanhBaProps) {
  const {
    state,
    friends,
    incomingRequests,
    outgoingRequests,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
  } = useChat();
  const { startCall } = useCall();

  const [subTab, setSubTab] = useState<SubTab>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [friendFilter, setFriendFilter] = useState('');
  const [confirmUnfriend, setConfirmUnfriend] = useState<FriendUser | null>(null);

  // Tìm kiếm chính xác khi nhấn nút Tìm kiếm hoặc Enter (không gợi ý tự động khi đang gõ)
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    setSearchedQuery(q);
    try {
      const res = await api<{ users: SearchUserResult[] }>(`/api/users/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.users);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchedQuery('');
    setSearchResults(null);
  };

  const [roleFilter, setRoleFilter] = useState<'ALL' | 'LECTURER' | 'STUDENT'>('ALL');

  // Lọc danh sách bạn bè theo tên / MSSV / email và phân loại vai trò
  const filteredFriends = useMemo(() => {
    let base = friends;
    if (roleFilter === 'LECTURER') base = friends.filter((f) => f.role === 'LECTURER' || f.role === 'ADMIN');
    else if (roleFilter === 'STUDENT') base = friends.filter((f) => f.role === 'STUDENT');

    const q = friendFilter.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q) ||
        (f.studentCode && f.studentCode.toLowerCase().includes(q)),
    );
  }, [friends, friendFilter, roleFilter]);

  const handleActionClick = async (u: SearchUserResult) => {
    if (u.friendStatus === 'none') {
      const ok = await sendFriendRequest(u.id);
      if (ok) {
        setSearchResults((prev) =>
          prev ? prev.map((item) => (item.id === u.id ? { ...item, friendStatus: 'pending_sent' } : item)) : null,
        );
      }
    } else if (u.friendStatus === 'pending_received') {
      const channel = await acceptFriendRequest(u.requestId, u.id);
      if (channel) {
        onOpenDirect(u.id);
      }
    } else if (u.friendStatus === 'friend') {
      onOpenDirect(u.id);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-white dark:bg-[#18191a]">
      {/* CỘT 1: Danh bạ Sub-sidebar (phong cách Zalo Web desktop) */}
      <aside className="flex h-full w-80 shrink-0 flex-col border-r border-slate-200 bg-white select-none dark:border-slate-800 dark:bg-[#202124]">
        {/* Header danh bạ */}
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Danh bạ</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Quản lý bạn bè & lời mời kết bạn
          </p>

          {/* Form tìm kiếm kết bạn bằng MSSV hoặc Email trường */}
          <form onSubmit={handleSearch} className="mt-3 space-y-2">
            <div className="relative flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm transition focus-within:border-sky-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-100 dark:border-slate-700 dark:bg-slate-800/80 dark:focus-within:bg-slate-800 dark:focus-within:ring-sky-950/40">
              <SearchIcon className="h-4 w-4 text-slate-400 shrink-0 mr-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nhập MSSV hoặc Email trường..."
                className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100"
              />
              {searchQuery && (
                <button type="button" onClick={handleClearSearch} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400 dark:text-slate-500">Gõ đúng MSSV / email</span>
              <button
                type="submit"
                disabled={searching || !searchQuery.trim()}
                className="flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 transition"
              >
                {searching ? 'Đang tìm...' : 'Tìm kiếm'}
              </button>
            </div>
          </form>
        </div>

        {/* Menu danh mục danh bạ */}
        <nav className="flex-1 space-y-1 p-3">
          <button
            onClick={() => setSubTab('friends')}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm transition ${
              subTab === 'friends'
                ? 'bg-sky-50 text-sky-800 font-semibold dark:bg-sky-950/50 dark:text-sky-300'
                : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${subTab === 'friends' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                <UsersIcon className="h-5 w-5" />
              </div>
              <span>Danh sách bạn bè</span>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {friends.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('requests')}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm transition ${
              subTab === 'requests'
                ? 'bg-sky-50 text-sky-800 font-semibold dark:bg-sky-950/50 dark:text-sky-300'
                : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${subTab === 'requests' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                <UserPlusIcon className="h-5 w-5" />
              </div>
              <span>Lời mời kết bạn</span>
            </div>
            {incomingRequests.length > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white shadow">
                {incomingRequests.length}
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                0
              </span>
            )}
          </button>

          <button
            onClick={() => setSubTab('sent')}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm transition ${
              subTab === 'sent'
                ? 'bg-sky-50 text-sky-800 font-semibold dark:bg-sky-950/50 dark:text-sky-300'
                : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${subTab === 'sent' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                <SendIcon className="h-4 w-4" />
              </div>
              <span>Lời mời đã gửi</span>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {outgoingRequests.length}
            </span>
          </button>
        </nav>
      </aside>

      {/* CỘT 2: Khu vực nội dung chính (Desktop Web App Main Area) */}
      <section className="flex flex-1 min-w-0 flex-col bg-slate-50 dark:bg-[#18191a] overflow-hidden">
        {/* Top Header của Content */}
        <header className="flex min-h-[68px] items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-[#202124]">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {subTab === 'friends' && `Danh sách bạn bè (${filteredFriends.length})`}
              {subTab === 'requests' && `Lời mời kết bạn đã nhận (${incomingRequests.length})`}
              {subTab === 'sent' && `Lời mời kết bạn đã gửi (${outgoingRequests.length})`}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {subTab === 'friends' && 'Danh sách tất cả người dùng trong khoa đã kết bạn với bạn'}
              {subTab === 'requests' && 'Xem và chấp nhận các lời mời kết bạn từ sinh viên hoặc giảng viên'}
              {subTab === 'sent' && 'Danh sách các lời mời kết bạn bạn đã gửi đang chờ đối phương phản hồi'}
            </p>
          </div>

          {/* Bộ lọc vai trò và ô tìm kiếm nhanh */}
          {subTab === 'friends' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  onClick={() => setRoleFilter('ALL')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    roleFilter === 'ALL'
                      ? 'bg-white text-slate-800 shadow-sm dark:bg-[#202124] dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Tất cả ({friends.length})
                </button>
                <button
                  onClick={() => setRoleFilter('LECTURER')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    roleFilter === 'LECTURER'
                      ? 'bg-white text-slate-800 shadow-sm dark:bg-[#202124] dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Giảng viên ({friends.filter((f) => f.role === 'LECTURER' || f.role === 'ADMIN').length})
                </button>
                <button
                  onClick={() => setRoleFilter('STUDENT')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    roleFilter === 'STUDENT'
                      ? 'bg-white text-slate-800 shadow-sm dark:bg-[#202124] dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Sinh viên ({friends.filter((f) => f.role === 'STUDENT').length})
                </button>
              </div>

              {friends.length > 0 && (
                <div className="w-56">
                  <div className="relative flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs transition focus-within:border-sky-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-100 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:bg-slate-800 dark:focus-within:ring-sky-950/40">
                    <SearchIcon className="h-3.5 w-3.5 text-slate-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      value={friendFilter}
                      onChange={(e) => setFriendFilter(e.target.value)}
                      placeholder="Lọc theo tên, MSSV..."
                      className="w-full bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100 text-xs"
                    />
                    {friendFilter && (
                      <button onClick={() => setFriendFilter('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <XIcon className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </header>

        {/* Nội dung danh bạ có thể cuộn */}
        <div className="scroll-thin flex-1 overflow-y-auto p-6 space-y-6">
          {/* Kết quả tìm kiếm (chỉ hiển thị khi đã bấm Tìm kiếm) */}
          {searchResults !== null && (
            <div className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm dark:border-sky-950/80 dark:bg-slate-900">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Kết quả tìm kiếm cho: <span className="text-sky-700 dark:text-sky-300">&quot;{searchedQuery}&quot;</span>
                </div>
                <button
                  onClick={handleClearSearch}
                  className="rounded-lg px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Đóng kết quả
                </button>
              </div>

              {searchResults.length === 0 ? (
                <div className="py-4 text-center text-sm text-rose-600 dark:text-rose-400 font-medium">
                  Không tìm thấy tài khoản nào khớp chính xác với MSSV hoặc Email này. Vui lòng kiểm tra lại.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {searchResults.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <AnhDaiDien id={u.id} name={u.name} src={u.avatar} size={46} online={!!state.online[u.id]} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">{u.name}</span>
                            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/80 dark:text-sky-300">
                              {roleLabel[u.role]}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {u.studentCode && <span className="font-medium text-slate-700 dark:text-slate-300 mr-2">MSSV: {u.studentCode}</span>}
                            <span>{u.email}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {u.friendStatus === 'none' && (
                          <button
                            onClick={() => handleActionClick(u)}
                            className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 transition"
                          >
                            <PlusIcon className="h-3.5 w-3.5" /> Kết bạn
                          </button>
                        )}
                        {u.friendStatus === 'pending_sent' && (
                          <span className="inline-block rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            Đã gửi lời mời
                          </span>
                        )}
                        {u.friendStatus === 'pending_received' && (
                          <button
                            onClick={() => handleActionClick(u)}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                          >
                            <CheckIcon className="h-3.5 w-3.5" /> Chấp nhận
                          </button>
                        )}
                        {u.friendStatus === 'friend' && (
                          <button
                            onClick={() => handleActionClick(u)}
                            className="flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/60 transition"
                          >
                            Nhắn tin
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 1: Danh sách bạn bè */}
          {subTab === 'friends' && (
            <div>
              {filteredFriends.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-[#202124]">
                  <UsersIcon className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                    {friendFilter ? 'Không tìm thấy bạn bè nào khớp với từ khoá' : 'Chưa có bạn bè nào'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {friendFilter
                      ? 'Thử tìm kiếm với tên hoặc MSSV khác.'
                      : 'Nhập chính xác Mã số sinh viên hoặc Email trường ở khung tìm kiếm bên trái để gửi lời mời kết bạn.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredFriends.map((f) => (
                    <div
                      key={f.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-[#202124]"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <AnhDaiDien id={f.id} name={f.name} src={f.avatar} size={48} online={!!state.online[f.id]} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">{f.name}</span>
                            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/80 dark:text-sky-300">
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
                        <button
                          onClick={() => startCall(f)}
                          title={`Gọi thoại cho ${f.name}`}
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 transition"
                        >
                          <PhoneIcon className="h-3.5 w-3.5" />
                          <span>Gọi</span>
                        </button>
                        <button
                          onClick={() => setConfirmUnfriend(f)}
                          title={`Xoá kết bạn với ${f.name}`}
                          className="flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/60 transition"
                        >
                          <UserMinusIcon className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Xoá bạn</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Lời mời kết bạn đã nhận */}
          {subTab === 'requests' && (
            <div>
              {incomingRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-[#202124]">
                  <UserPlusIcon className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">Không có lời mời nào đang chờ</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Khi người khác gửi lời mời kết bạn cho bạn, yêu cầu sẽ hiển thị tại đây để bạn duyệt.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {incomingRequests.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#202124]"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <AnhDaiDien id={r.user.id} name={r.user.name} src={r.user.avatar} size={48} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">{r.user.name}</span>
                            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/80 dark:text-sky-300">
                              {roleLabel[r.user.role]}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {r.user.studentCode ? `MSSV: ${r.user.studentCode} · ` : ''}
                            {r.user.email}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                        <button
                          onClick={async () => {
                            const channel = await acceptFriendRequest(r.id, r.user.id);
                            if (channel) onOpenDirect(r.user.id);
                          }}
                          className="flex-1 rounded-xl bg-sky-600 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 transition"
                        >
                          Đồng ý
                        </button>
                        <button
                          onClick={() => declineFriendRequest(r.id, r.user.id)}
                          className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750 transition"
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Lời mời kết bạn đã gửi */}
          {subTab === 'sent' && (
            <div>
              {outgoingRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-[#202124]">
                  <SendIcon className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">Bạn chưa gửi lời mời nào</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Nhập chính xác MSSV hoặc Email ở ô tìm kiếm bên trái và bấm &quot;Tìm kiếm&quot; để gửi lời mời kết bạn mới.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {outgoingRequests.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#202124]"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <AnhDaiDien id={r.user.id} name={r.user.name} src={r.user.avatar} size={48} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">{r.user.name}</span>
                            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/80 dark:text-sky-300">
                              {roleLabel[r.user.role]}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {r.user.studentCode ? `MSSV: ${r.user.studentCode} · ` : ''}
                            {r.user.email}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                        <button
                          onClick={() => declineFriendRequest(r.id, r.user.id)}
                          className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750 transition"
                        >
                          Huỷ yêu cầu
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Modal xác nhận huỷ kết bạn */}
      {confirmUnfriend && (
        <Modal
          title="Xác nhận huỷ kết bạn"
          onClose={() => setConfirmUnfriend(null)}
          width="max-w-sm"
          footer={
            <>
              <button
                className={btn.secondary}
                onClick={() => setConfirmUnfriend(null)}
              >
                Giữ lại
              </button>
              <button
                className={btn.danger}
                onClick={async () => {
                  const target = confirmUnfriend;
                  setConfirmUnfriend(null);
                  await removeFriend(target.id);
                }}
              >
                Huỷ kết bạn
              </button>
            </>
          }
        >
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Bạn có chắc chắn muốn huỷ kết bạn với{' '}
              <span className="font-semibold text-slate-800 dark:text-white">{confirmUnfriend.name}</span>{' '}
              {confirmUnfriend.studentCode ? `(MSSV: ${confirmUnfriend.studentCode})` : `(${confirmUnfriend.email})`} không?
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Sau khi huỷ, người này sẽ bị xoá khỏi danh bạ bạn bè của bạn.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
