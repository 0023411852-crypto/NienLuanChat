import { useState, useMemo } from 'react';
import { useChat } from '../state/ChatContext';
import { api } from '../lib/api';
import { roleLabel } from '../lib/format';
import { useToast } from '../state/toast';
import type { ContactCardData, FriendUser, SearchUserResult } from '../types';
import AnhDaiDien from './AnhDaiDien';
import Modal from './ui/HopThoai';
import { ContactCardIcon, SearchIcon, SendIcon, UsersIcon, XIcon } from './BieuTuong';

interface ModalTheDanhBaProps {
  onClose: () => void;
  onSelect: (contact: ContactCardData) => void;
}

export default function ModalTheDanhBa({ onClose, onSelect }: ModalTheDanhBaProps) {
  const { me, friends, state } = useChat();
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const [searching, setSearching] = useState(false);
  const [exactUser, setExactUser] = useState<SearchUserResult | null>(null);
  const [searchedNotFound, setSearchedNotFound] = useState(false);

  // Lọc danh sách bạn bè theo tên / MSSV / email
  const filteredFriends = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q) ||
        (f.studentCode && f.studentCode.toLowerCase().includes(q)),
    );
  }, [friends, filter]);

  // Tìm kiếm chính xác người dùng khác qua MSSV / email nếu không có trong bạn bè
  const handleSearchExact = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = filter.trim();
    if (!q) return;

    setSearching(true);
    setSearchedNotFound(false);
    try {
      const res = await api<{ users: SearchUserResult[] }>(`/api/users/search?q=${encodeURIComponent(q)}`);
      if (res.users.length > 0) {
        setExactUser(res.users[0]);
      } else {
        setExactUser(null);
        setSearchedNotFound(true);
      }
    } catch {
      setExactUser(null);
      setSearchedNotFound(true);
    } finally {
      setSearching(false);
    }
  };

  const handleChoose = (user: {
    id: string;
    name: string;
    email: string;
    role: FriendUser['role'];
    studentCode?: string | null;
    avatar?: string | null;
  }) => {
    // Check if user is a friend
    const isFriend = friends.some(f => f.id === user.id);
    if (!isFriend && user.id !== me.id) {
      // If not a friend and not self, show error and return
      toast.push({ kind: 'error', title: 'Chỉ có thể gửi danh thiếp cho bạn bè' });
      return;
    }

    onSelect({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentCode: user.studentCode,
      avatar: user.avatar,
    });
    onClose();
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <ContactCardIcon className="h-5 w-5 text-sky-600" />
          <span>Gửi danh thiếp</span>
        </div>
      }
      onClose={onClose}
      width="max-w-md"
    >
      <div className="space-y-4">
        {/* Quick Send: My Own Card */}
        <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-3 dark:border-sky-950/80 dark:bg-sky-950/30">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-800 dark:text-sky-300 mb-2">
            Danh thiếp của bạn
          </div>
          <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-800 rounded-xl p-2.5 border border-sky-200/70 dark:border-sky-900/60 shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <AnhDaiDien id={me.id} name={me.name} src={me.avatar} size={38} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{me.name}</span>
                  <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/80 dark:text-sky-300">
                    {roleLabel[me.role]}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {me.studentCode ? `MSSV: ${me.studentCode} · ` : ''}
                  {me.email}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleChoose(me)}
              className="flex items-center gap-1 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 shrink-0"
            >
              <SendIcon className="h-3.5 w-3.5" /> Gửi
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div>
          <form onSubmit={handleSearchExact} className="flex items-center gap-1.5">
            <div className="relative flex-1 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus-within:border-sky-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-100 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:bg-slate-800 dark:focus-within:ring-sky-950/40">
              <SearchIcon className="h-4 w-4 text-slate-400 shrink-0 mr-2" />
              <input
                type="text"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setSearchedNotFound(false);
                }}
                placeholder="Tìm tên bạn bè hoặc nhập MSSV/email..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100"
              />
              {filter && (
                <button
                  type="button"
                  onClick={() => {
                    setFilter('');
                    setExactUser(null);
                    setSearchedNotFound(false);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={searching || !filter.trim()}
              title="Tìm kiếm chính xác bằng MSSV / Email"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750"
            >
              {searching ? '...' : 'Tìm MSSV'}
            </button>
          </form>

          {searchedNotFound && (
            <p className="mt-1.5 text-xs text-rose-500 px-1">
              Không tìm thấy người dùng nào với MSSV hoặc Email này.
            </p>
          )}

          {/* User found via exact search */}
          {exactUser && (
            <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 dark:border-emerald-950/80 dark:bg-emerald-950/30">
              <div className="text-[10px] font-semibold uppercase text-emerald-800 dark:text-emerald-300 mb-1.5">
                Kết quả tìm kiếm
              </div>
              <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-800 rounded-lg p-2 border border-emerald-100 dark:border-emerald-900/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AnhDaiDien id={exactUser.id} name={exactUser.name} src={exactUser.avatar} size={36} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{exactUser.name}</span>
                      <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/80 dark:text-sky-300">
                        {roleLabel[exactUser.role]}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {exactUser.studentCode ? `MSSV: ${exactUser.studentCode} · ` : ''}
                      {exactUser.email}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleChoose(exactUser)}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 shrink-0"
                >
                  <SendIcon className="h-3 w-3" /> Gửi
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Friends list */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Bạn bè ({filteredFriends.length})
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
            {filteredFriends.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-400">
                <UsersIcon className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-1.5" />
                {friends.length === 0 ? 'Bạn chưa có người bạn nào trong danh bạ.' : 'Không có bạn bè nào khớp từ khoá.'}
              </div>
            ) : (
              filteredFriends.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-2.5 transition hover:bg-slate-50 hover:border-slate-200 dark:border-slate-800 dark:bg-slate-850 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AnhDaiDien id={f.id} name={f.name} src={f.avatar} size={36} online={!!state.online[f.id]} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{f.name}</span>
                        <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/80 dark:text-sky-300">
                          {roleLabel[f.role]}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {f.studentCode ? `MSSV: ${f.studentCode} · ` : ''}
                        {f.email}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleChoose(f)}
                    className="flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 shrink-0"
                  >
                    <SendIcon className="h-3 w-3" /> Gửi
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
