import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useChat } from '../../state/ChatContext';
import { useToast } from '../../state/toast';
import { HashIcon, MegaphoneIcon, PlusIcon, SearchIcon, XIcon } from '../BieuTuong';
import Modal, { btn, inputCls } from '../ui/HopThoai';
import ModalThanhVien from './ModalThanhVien';
import ChonNguoiDung, { type LookupUser } from './ChonNguoiDung';

interface AdminChannel {
  id: string; type: 'CLASS' | 'ANNOUNCEMENT'; name: string; courseCode: string | null; description: string | null;
  archived: boolean; createdAt: string; memberCount: number; messageCount: number;
  managers: { id: string; name: string; role: string }[];
}

function ChannelForm({ channel, isAdmin, onClose, onSaved }: { channel?: AdminChannel; isAdmin: boolean; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<'CLASS' | 'ANNOUNCEMENT'>(channel?.type ?? 'CLASS');
  const [name, setName] = useState(channel?.name ?? '');
  const [courseCode, setCourseCode] = useState(channel?.courseCode ?? '');
  const [description, setDescription] = useState(channel?.description ?? '');
  const [owners, setOwners] = useState<LookupUser[]>([]);
  const [addAll, setAddAll] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setErr(null);
    try {
      if (channel) {
        await api(`/api/admin/channels/${channel.id}`, {
          method: 'PATCH',
          json: { name, description: description || null, ...(isAdmin ? { courseCode: courseCode || null } : {}) },
        });
      } else {
        await api('/api/admin/channels', {
          method: 'POST',
          json: { type, name, courseCode: courseCode || undefined, description: description || undefined, ownerIds: owners.map((o) => o.id), addAllUsers: addAll },
        });
      }
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Modal title={channel ? 'Sửa kênh' : 'Tạo kênh mới'} onClose={onClose}
      footer={<><button className={btn.ghost} onClick={onClose}>Huỷ</button><button className={btn.primary} onClick={save}>{channel ? 'Lưu' : 'Tạo kênh'}</button></>}>
      <div className="space-y-4">
        {!channel && (
          <div className="grid grid-cols-2 gap-2">
            {(['CLASS', 'ANNOUNCEMENT'] as const).map((t) => (
              <button key={t} onClick={() => setType(t)} className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm ${type === t ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
                {t === 'CLASS' ? <HashIcon className="h-5 w-5 text-sky-600" /> : <MegaphoneIcon className="h-5 w-5 text-amber-600" />}
                <span><b className="block">{t === 'CLASS' ? 'Lớp học phần' : 'Kênh thông báo'}</b><span className="text-xs text-slate-500">{t === 'CLASS' ? 'GV + SV trao đổi' : 'Chỉ GV/QTV đăng'}</span></span>
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Mã học phần{type === 'CLASS' ? ' *' : ''}</span>
            <input className={inputCls} value={courseCode} disabled={!!channel && !isAdmin} onChange={(e) => setCourseCode(e.target.value.toUpperCase())} placeholder="CT101" />
          </label>
          <label className="col-span-2 block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Tên kênh *</span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Lập trình căn bản - Nhóm 01" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Mô tả</span>
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Học kỳ 1, 2026-2027" />
        </label>
        {!channel && (
          <>
            <div>
              <span className="mb-1 block text-xs font-semibold text-slate-600">Giảng viên phụ trách (chủ kênh)</span>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {owners.map((o) => (
                  <span key={o.id} className="flex items-center gap-1 rounded-full bg-indigo-50 py-1 pl-3 pr-1.5 text-xs text-indigo-700">
                    {o.name}<button onClick={() => setOwners(owners.filter((x) => x.id !== o.id))}><XIcon className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
              <ChonNguoiDung role="LECTURER" exclude={owners.map((o) => o.id)} onPick={(u) => setOwners([...owners, u])} placeholder="Tìm giảng viên..." />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={addAll} onChange={(e) => setAddAll(e.target.checked)} className="accent-indigo-600" />
              Thêm tất cả người dùng vào kênh {type === 'ANNOUNCEMENT' ? '(khuyên dùng cho kênh thông báo)' : ''}
            </label>
          </>
        )}
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </Modal>
  );
}

export default function QuanTriKenh() {
  const { me } = useChat();
  const toast = useToast();
  const isAdmin = me.role === 'ADMIN';
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [archived, setArchived] = useState('false');
  const [list, setList] = useState<AdminChannel[] | null>(null);
  const [edit, setEdit] = useState<AdminChannel | 'new' | null>(null);
  const [members, setMembers] = useState<string | null>(null);
  const [del, setDel] = useState<AdminChannel | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams({ archived });
    if (q.trim()) p.set('q', q.trim());
    if (type) p.set('type', type);
    api<{ channels: AdminChannel[] }>(`/api/admin/channels?${p}`).then((r) => setList(r.channels)).catch((e) => toast.push({ kind: 'error', title: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, type, archived]);
  useEffect(() => {
    const t = window.setTimeout(load, 200);
    return () => window.clearTimeout(t);
  }, [load]);

  const setArchive = async (c: AdminChannel, value: boolean) => {
    try {
      await api(`/api/admin/channels/${c.id}`, { method: 'PATCH', json: { archived: value } });
      toast.push({ kind: 'success', title: value ? `Đã lưu trữ ${c.name}` : `Đã khôi phục ${c.name}` });
      load();
    } catch (e) {
      toast.push({ kind: 'error', title: (e as Error).message });
    }
  };
  const remove = async (c: AdminChannel) => {
    setDel(null);
    try {
      await api(`/api/admin/channels/${c.id}`, { method: 'DELETE' });
      toast.push({ kind: 'success', title: `Đã xoá kênh ${c.name}` });
      load();
    } catch (e) {
      toast.push({ kind: 'error', title: (e as Error).message });
    }
  };
  const sel = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none';

  return (
    <div data-admin-channels>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-72">
          <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên hoặc mã học phần..." className={`${inputCls} bg-white pl-9`} />
        </div>
        {isAdmin && (
          <select className={sel} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Mọi loại kênh</option><option value="CLASS">Lớp học phần</option><option value="ANNOUNCEMENT">Thông báo</option>
          </select>
        )}
        <select className={sel} value={archived} onChange={(e) => setArchived(e.target.value)}>
          <option value="false">Đang hoạt động</option><option value="true">Đã lưu trữ</option><option value="all">Tất cả</option>
        </select>
        {isAdmin && <button className={`${btn.primary} ml-auto flex items-center gap-2`} onClick={() => setEdit('new')}><PlusIcon /> Tạo kênh</button>}
      </div>
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {list?.map((c) => (
          <div key={c.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${c.archived ? 'border-dashed border-slate-300 opacity-75' : 'border-slate-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${c.type === 'ANNOUNCEMENT' ? 'bg-amber-100 text-amber-600' : 'bg-sky-100 text-sky-600'}`}>
                {c.type === 'ANNOUNCEMENT' ? <MegaphoneIcon /> : <HashIcon />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-800">{c.courseCode && <span className="text-sky-700">{c.courseCode} </span>}{c.name}</p>
                <p className="truncate text-xs text-slate-500">{c.description || (c.type === 'ANNOUNCEMENT' ? 'Kênh thông báo' : 'Lớp học phần')}</p>
              </div>
              {c.archived && <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">LƯU TRỮ</span>}
            </div>
            <div className="mt-4 flex gap-4 text-xs text-slate-500">
              <span><b className="text-slate-800">{c.memberCount ?? 0}</b> thành viên</span>
              <span><b className="text-slate-800">{c.messageCount ?? 0}</b> tin nhắn</span>
            </div>
            <p className="mt-1 truncate text-xs text-slate-500">Phụ trách: {c.managers?.map((m) => m.name).join(', ') || '—'}</p>
            <div className="mt-4 flex flex-wrap gap-1 border-t border-slate-100 pt-3">
              <button className={btn.ghost} onClick={() => setMembers(c.id)}>Thành viên</button>
              <button className={btn.ghost} onClick={() => setEdit(c)}>Sửa</button>
              {isAdmin && <button className={btn.ghost} onClick={() => setArchive(c, !c.archived)}>{c.archived ? 'Khôi phục' : 'Lưu trữ'}</button>}
              <button className={`${btn.ghost} ml-auto text-rose-600`} onClick={() => setDel(c)}>Giải tán</button>
            </div>
          </div>
        ))}
        {list && !list.length && <p className="col-span-full py-10 text-center text-slate-400">Không có kênh nào</p>}
      </div>
      {edit && <ChannelForm channel={edit === 'new' ? undefined : edit} isAdmin={isAdmin} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); toast.push({ kind: 'success', title: 'Đã lưu kênh' }); }} />}
      {members && <ModalThanhVien channelId={members} onClose={() => { setMembers(null); load(); }} />}
      {del && (
        <Modal title="Giải tán kênh vĩnh viễn?" onClose={() => setDel(null)} width="max-w-sm"
          footer={<><button className={btn.ghost} onClick={() => setDel(null)}>Huỷ</button><button className={btn.danger} onClick={() => remove(del)}>Giải tán vĩnh viễn</button></>}>
          <p className="text-sm text-slate-600">Toàn bộ <b>{del.messageCount}</b> tin nhắn và tệp của <b>{del.name}</b> sẽ bị xoá vĩnh viễn. Hành động này không thể hoàn tác.</p>
        </Modal>
      )}
    </div>
  );
}
