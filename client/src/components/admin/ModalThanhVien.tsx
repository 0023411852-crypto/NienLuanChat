import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { copyToClipboard, roleLabel } from '../../lib/format';
import { useChat } from '../../state/ChatContext';
import { useToast } from '../../state/toast';
import type { MemberRole, Role } from '../../types';
import AnhDaiDien from '../AnhDaiDien';
import Modal, { btn, inputCls } from '../ui/HopThoai';
import ChonNguoiDung from './ChonNguoiDung';

interface Row { id: string; name: string; email: string; role: Role; studentCode: string | null; avatar: string | null; locked: boolean; memberRole: MemberRole; isMuted?: boolean }
interface FriendOption { id: string; name: string; email: string; role: Role; studentCode: string | null; avatar: string | null; locked?: boolean }

export default function ModalThanhVien({ channelId, onClose }: { channelId: string; onClose: () => void }) {
  const { me } = useChat();
  const toast = useToast();
  const [data, setData] = useState<{ channel: { name: string; courseCode: string | null; type: string; createdById: string | null; isChannelLocked?: boolean; canManage?: boolean }; members: Row[] } | null>(null);
  const [bulk, setBulk] = useState('');
  const [filter, setFilter] = useState('');
  const [friends, setFriends] = useState<FriendOption[]>([]);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteActive, setInviteActive] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteQr, setInviteQr] = useState('');
  const [copied, setCopied] = useState(false);
  const load = useCallback(() => {
    api<{ channel: { name: string; courseCode: string | null; type: string; createdById: string | null; isChannelLocked?: boolean; canManage?: boolean }; members: Row[] }>(`/api/admin/channels/${channelId}/members`)
      .then(setData).catch((e) => toast.push({ kind: 'error', title: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);
  useEffect(load, [load]);
  useEffect(() => {
    let active = true;
    api<{ friends: FriendOption[] }>('/api/friends').then((r) => { if (active) setFriends(r.friends); }).catch(() => { if (active) setFriends([]); });
    api<{ active: boolean; url?: string }>(`/api/admin/channels/${channelId}/invite`).then((r) => {
      if (active) {
        setInviteActive(r.active);
        if (r.url) {
          setInviteUrl(r.url);
          setInviteQr(`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(r.url)}`);
        }
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [channelId]);

  const add = async (body: { userIds?: string[]; identifiers?: string[] }) => {
    try {
      const r = await api<{ added: number; alreadyMember: number; notFound: string[] }>(`/api/admin/channels/${channelId}/members`, { method: 'POST', json: body });
      toast.push({
        kind: r.notFound.length ? 'error' : 'success',
        title: `Đã thêm ${r.added} thành viên`,
        body: [r.alreadyMember ? `${r.alreadyMember} người đã có trong kênh` : '', r.notFound.length ? `Không tìm thấy: ${r.notFound.slice(0, 5).join(', ')}${r.notFound.length > 5 ? '...' : ''}` : ''].filter(Boolean).join(' · ') || undefined,
      });
      load();
      return true;
    } catch (e) {
      toast.push({ kind: 'error', title: (e as Error).message });
      return false;
    }
  };
  const myMembership = data?.members.find((m) => m.id === me.id);
  const canEditRole = me.role === 'ADMIN' || myMembership?.memberRole === 'OWNER';

  const setRole = async (u: Row, role: MemberRole) => {
    if (!canEditRole) return;
    try {
      await api(`/api/admin/channels/${channelId}/members/${u.id}`, { method: 'PATCH', json: { role } });
      load();
    } catch (e) {
      toast.push({ kind: 'error', title: (e as Error).message });
    }
  };
  const remove = async (u: Row) => {
    if (!confirm(`Xoá ${u.name} khỏi kênh?`)) return;
    try {
      await api(`/api/admin/channels/${channelId}/members/${u.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      toast.push({ kind: 'error', title: (e as Error).message });
    }
  };
  const createInvite = async () => {
    setInviteBusy(true);
    try {
      const r = await api<{ url: string }>(`/api/admin/channels/${channelId}/invite`, { method: 'POST', json: {} });
      setInviteUrl(r.url);
      setInviteQr(`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(r.url)}`);
      setInviteActive(true);
    } catch (e) {
      toast.push({ kind: 'error', title: (e as Error).message });
    } finally {
      setInviteBusy(false);
    }
  };
  const revokeInvite = async () => {
    try {
      await api(`/api/admin/channels/${channelId}/invite`, { method: 'DELETE' });
      setInviteUrl('');
      setInviteQr('');
      setInviteActive(false);
      toast.push({ kind: 'success', title: 'Đã thu hồi liên kết mời' });
    } catch (e) {
      toast.push({ kind: 'error', title: (e as Error).message });
    }
  };
  const copyInvite = async () => {
    if (!inviteUrl) return;
    const ok = await copyToClipboard(inviteUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.push({ kind: 'success', title: 'Đã sao chép liên kết vào bộ nhớ tạm' });
    } else {
      toast.push({ kind: 'error', title: 'Không thể sao chép tự động. Vui lòng bấm vào ô liên kết và nhấn Ctrl+C để sao chép.' });
    }
  };
  const canManage = me.role === 'ADMIN' || myMembership?.memberRole === 'OWNER' || myMembership?.memberRole === 'MODERATOR';

  const toggleMute = async (u: Row) => {
    try {
      const r = await api<{ ok: boolean; muted: boolean }>(`/api/channels/${channelId}/mute/${u.id}`, { method: 'POST' });
      toast.push({
        kind: r.muted ? 'info' : 'success',
        title: r.muted ? `Đã cấm chat ${u.name}` : `Đã mở cấm chat cho ${u.name}`,
      });
      load();
    } catch (e) {
      toast.push({ kind: 'error', title: (e as Error).message });
    }
  };

  const toggleLockChat = async () => {
    try {
      const r = await api<{ ok: boolean; locked: boolean }>(`/api/channels/${channelId}/lock-chat`, { method: 'POST' });
      toast.push({
        kind: r.locked ? 'info' : 'success',
        title: r.locked ? 'Đã bật chế độ cấm chat nhóm' : 'Đã mở chat nhóm cho mọi thành viên',
        body: r.locked ? 'Chỉ chủ nhóm và quản lý mới được gửi tin nhắn' : undefined,
      });
      load();
    } catch (e) {
      toast.push({ kind: 'error', title: (e as Error).message });
    }
  };

  const ids = bulk.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  const shown = (data?.members ?? []).filter((m) => !filter || `${m.name} ${m.email} ${m.studentCode ?? ''}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Modal title={data ? `Thành viên · ${data.channel.courseCode ? `${data.channel.courseCode} ` : ''}${data.channel.name}` : 'Thành viên'} onClose={onClose} width="max-w-3xl">
      <div className="grid gap-6 md:grid-cols-5">
        <div className="md:col-span-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-700">{data?.members.length ?? 0} thành viên</h4>
            <div className="flex items-center gap-2">
              {data && (data.channel.type === 'CLASS' || data.channel.type === 'COMMUNITY') && canManage && (
                <button
                  onClick={toggleLockChat}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition ${
                    data.channel.isChannelLocked
                      ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                  title={data.channel.isChannelLocked ? 'Bấm để mở lại chat cho mọi thành viên' : 'Bấm để chỉ cho phép chủ nhóm/quản lý nhắn tin'}
                >
                  {data.channel.isChannelLocked ? '🔒 Đang cấm chat' : '🔓 Khóa chat'}
                </button>
              )}
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Lọc..." className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none" />
            </div>
          </div>
          <ul className="scroll-thin max-h-[50vh] space-y-1 overflow-y-auto pr-1" data-members-list>
            {shown.map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-50">
                <AnhDaiDien id={u.id} name={u.name} src={u.avatar} size={30} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${u.locked ? 'text-slate-400 line-through' : ''}`}>
                    {u.name}
                    {u.isMuted && <span className="ml-1.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">Đã cấm chat</span>}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">{roleLabel[u.role]} · {u.studentCode ?? u.email}</p>
                </div>
                {canEditRole ? (
                  <select value={u.memberRole} onChange={(e) => setRole(u, e.target.value as MemberRole)} disabled={u.id === me.id} className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs">
                    <option value="MEMBER">Thành viên</option><option value="MODERATOR">Quản lý</option><option value="OWNER">Chủ kênh</option>
                  </select>
                ) : <span className="text-xs text-slate-500">{u.memberRole === 'OWNER' ? 'Chủ nhóm' : u.memberRole === 'MODERATOR' ? 'Quản lý' : 'Thành viên'}</span>}
                {canManage && u.id !== me.id && u.memberRole !== 'OWNER' && (
                  <button
                    onClick={() => toggleMute(u)}
                    className={`rounded-lg px-2 py-1 text-xs transition ${
                      u.isMuted
                        ? 'text-rose-600 bg-rose-50 hover:bg-rose-100 font-semibold'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                    title={u.isMuted ? 'Mở lại quyền chat cho thành viên này' : 'Cấm thành viên này gửi tin nhắn trong nhóm'}
                  >
                    {u.isMuted ? 'Bỏ cấm' : 'Cấm chat'}
                  </button>
                )}
                <button onClick={() => remove(u)} disabled={u.id === me.id} className="rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-30">Xoá</button>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-5 md:col-span-2">
          {(data?.channel.type === 'CLASS' || data?.channel.type === 'COMMUNITY') && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/30">
              <h4 className="mb-2 text-sm font-semibold text-violet-800 dark:text-violet-200">Liên kết / QR tham gia</h4>
              {inviteActive ? (
                <>
                  {inviteUrl ? (
                    <input
                      readOnly
                      value={inviteUrl}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className={`${inputCls} select-all cursor-pointer font-mono text-xs`}
                      aria-label="Liên kết mời"
                      title="Nhấp để bôi đen toàn bộ liên kết (Ctrl+C để sao chép)"
                    />
                  ) : (
                    <p className="text-xs text-slate-500">Đã có liên kết mời. Thu hồi liên kết cũ trước khi tạo liên kết mới.</p>
                  )}
                  {inviteQr && <img src={inviteQr} alt="QR liên kết mời" className="mx-auto mt-3 h-44 w-44 rounded-lg bg-white p-2" />}
                  <div className="mt-2 flex gap-2">
                    {inviteUrl && (
                      <button
                        className={`${copied ? 'bg-emerald-600 text-white hover:bg-emerald-700' : btn.secondary} flex-1 font-medium transition`}
                        onClick={copyInvite}
                      >
                        {copied ? '✓ Đã sao chép!' : 'Sao chép link'}
                      </button>
                    )}
                    <button className={`${btn.ghost} flex-1`} onClick={revokeInvite}>Thu hồi</button>
                  </div>
                </>
              ) : (
                <button className={`${btn.primary} w-full`} disabled={inviteBusy} onClick={createInvite}>
                  {inviteBusy ? 'Đang tạo...' : 'Tạo link mời'}
                </button>
              )}
              <p className="mt-2 text-[11px] text-violet-700 dark:text-violet-300">Người mở link sẽ tham gia ngay nếu còn chỗ. Có thể quét QR hoặc sao chép link gửi cho bạn bè.</p>
            </div>
          )}
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-700">Thêm một người</h4>
            <ChonNguoiDung options={friends} exclude={data?.members.map((m) => m.id)} onPick={(u) => add({ userIds: [u.id] })} placeholder="Tìm theo tên, email hoặc MSSV..." />
          </div>
          <div>
            <h4 className="mb-1 text-sm font-semibold text-slate-700">Thêm hàng loạt</h4>
            <p className="mb-2 text-xs text-slate-500">Dán danh sách email hoặc MSSV của sinh viên / giảng viên trong Khoa.</p>
            <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={6} className={`${inputCls} font-mono text-xs`} placeholder={'B2100006\nsv07@khoachat.edu.vn'} />
            <button className={`${btn.primary} mt-2 w-full`} disabled={!ids.length} onClick={async () => { if (await add({ identifiers: ids })) setBulk(''); }}>
              Thêm {ids.length || ''} người
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
