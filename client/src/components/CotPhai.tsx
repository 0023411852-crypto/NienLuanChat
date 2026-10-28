import React, { useEffect, useMemo, useState } from 'react';
import { useChat } from '../state/ChatContext';
import { useToast } from '../state/toast';
import { api } from '../lib/api';
import { fmtShort, roleLabel } from '../lib/format';
import { fmtSize, isImageName, isVideoName } from '../lib/files';
import type { Channel, FileResult, LinkItem, Member } from '../types';
import AnhDaiDien from './AnhDaiDien';
import { FileIconBadge, Lightbox } from './TepDinhKem';
import {
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ImageIcon,
  LinkIcon,
  PinIcon,
  ShieldIcon,
  TrashIcon,
  UserMinusIcon,
  VideoIcon,
  XIcon,
} from './BieuTuong';
import Modal, { btn } from './ui/HopThoai';
import ModalThanhVien from './admin/ModalThanhVien';

export type PanelTab = 'members' | 'files' | 'pins';
const rank: Record<string, number> = { ADMIN: 0, LECTURER: 1, STUDENT: 2 };

function MembersTab({ channel }: { channel: Channel }) {
  const { state, me, openDirect, friends, removeFriend, selectChannel } = useChat();
  const [manage, setManage] = useState(false);
  const [confirmUnfriend, setConfirmUnfriend] = useState(false);
  const [confirmDisband, setConfirmDisband] = useState(false);
  const [disbanding, setDisbanding] = useState(false);
  const isOwner = channel.myRole === 'OWNER' || me.role === 'ADMIN';

  const peer = channel.type === 'DIRECT' ? (channel.members || []).find((m) => m.id !== me.id) : null;
  const isFriend = peer ? friends.some((f) => f.id === peer.id) : false;
  const sorted = [...(channel.members || [])].sort(
    (a, b) => Number(!!state.online[b.id]) - Number(!!state.online[a.id]) || rank[a.role] - rank[b.role] || a.name.localeCompare(b.name, 'vi'),
  );
  const online = sorted.filter((m) => state.online[m.id]);
  const offline = sorted.filter((m) => !state.online[m.id]);
  const row = (m: Member) => (
    <li key={m.id}>
      <button
        disabled={m.id === me.id}
        onClick={() => openDirect(m.id)}
        title={m.id === me.id ? undefined : `Nhắn tin riêng với ${m.name}`}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/60 disabled:hover:bg-transparent"
      >
        <AnhDaiDien id={m.id} name={m.name} src={m.avatar} size={32} online={!!state.online[m.id]} />
        <div className="min-w-0">
          <div className={`truncate text-sm ${state.online[m.id] ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
            {m.name} {m.id === me.id && <span className="text-xs text-slate-400 dark:text-slate-500">(bạn)</span>}
          </div>
          <div className="truncate text-[11px] text-slate-400 dark:text-slate-500">
            {roleLabel[m.role]}
            {m.memberRole === 'OWNER' ? ' · Chủ kênh' : m.memberRole === 'MODERATOR' ? ' · Quản lý' : ''}
          </div>
        </div>
      </button>
    </li>
  );

  const toast = useToast();

  const leaveChannel = async () => {
    if (!confirm('Bạn có chắc chắn muốn rời khỏi kênh này?')) return;

    try {
      await api(`/api/channels/${channel.id}/membership`, { method: 'DELETE' });
      toast.push({ kind: 'success', title: `Đã rời khỏi kênh ${channel.name}` });
      // UI will automatically update via realtime event 'channel:removed'
    } catch (e) {
      toast.push({ kind: 'error', title: 'Không thể rời khỏi kênh', body: (e as Error).message });
    }
  };

  return (
    <>
      {channel.canManage && channel.type !== 'DIRECT' && (
        <button onClick={() => setManage(true)} className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/60">
          <ShieldIcon /> Quản lý thành viên
        </button>
      )}

      {/* Nút rời khỏi kênh cho thành viên thường */}
      {channel.myRole !== 'OWNER' && channel.type !== 'DIRECT' && (
        <button
          onClick={leaveChannel}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60"
        >
          <XIcon className="h-4 w-4" /> Rời khỏi kênh
        </button>
      )}

      {/* Nút giải tán nhóm cho chủ kênh hoặc quản trị viên */}
      {isOwner && channel.type !== 'DIRECT' && (
        <button
          onClick={() => setConfirmDisband(true)}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 transition"
        >
          <TrashIcon className="h-4 w-4" /> Giải tán nhóm
        </button>
      )}

      {/* Nút xoá bạn cho cuộc trò chuyện trực tiếp 1-1 */}
      {channel.type === 'DIRECT' && peer && isFriend && (
        <button
          onClick={() => setConfirmUnfriend(true)}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 transition"
        >
          <UserMinusIcon className="h-4 w-4" /> Xoá kết bạn
        </button>
      )}

      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Đang hoạt động — {online.length}</h3>
      <ul className="mb-4 space-y-0.5">{online.map(row)}</ul>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ngoại tuyến — {offline.length}</h3>
      <ul className="space-y-0.5">{offline.map(row)}</ul>
      {manage && <ModalThanhVien channelId={channel.id} onClose={() => setManage(false)} />}
      {confirmDisband && (
        <Modal
          title="Xác nhận giải tán nhóm"
          onClose={() => setConfirmDisband(false)}
          width="max-w-sm"
          footer={
            <>
              <button className={btn.secondary} onClick={() => setConfirmDisband(false)} disabled={disbanding}>
                Giữ lại
              </button>
              <button
                className={btn.danger}
                disabled={disbanding}
                onClick={async () => {
                  setDisbanding(true);
                  try {
                    await api(`/api/admin/channels/${channel.id}`, { method: 'DELETE' });
                    toast.push({ kind: 'success', title: `Đã giải tán nhóm "${channel.name}"` });
                    setConfirmDisband(false);
                    selectChannel(null);
                  } catch (e) {
                    toast.push({ kind: 'error', title: 'Không thể giải tán nhóm', body: (e as Error).message });
                  } finally {
                    setDisbanding(false);
                  }
                }}
              >
                {disbanding ? 'Đang giải tán...' : 'Giải tán ngay'}
              </button>
            </>
          }
        >
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Bạn có chắc chắn muốn giải tán nhóm <span className="font-semibold text-slate-800 dark:text-white">{channel.name}</span> không?
            </p>
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              Nhóm và toàn bộ lịch sử tin nhắn sẽ bị xoá vĩnh viễn cho tất cả thành viên.
            </p>
          </div>
        </Modal>
      )}
      {confirmUnfriend && peer && (
        <Modal
          title="Xác nhận xoá kết bạn"
          onClose={() => setConfirmUnfriend(false)}
          width="max-w-sm"
          footer={
            <>
              <button className={btn.secondary} onClick={() => setConfirmUnfriend(false)}>Giữ lại</button>
              <button
                className={btn.danger}
                onClick={async () => {
                  setConfirmUnfriend(false);
                  if (peer) {
                    await removeFriend(peer.id);
                  }
                }}
              >
                Xoá bạn
              </button>
            </>
          }
        >
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Bạn có chắc chắn muốn xoá kết bạn với <span className="font-semibold text-slate-800 dark:text-white">{peer.name}</span> không?
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Người này sẽ bị xoá khỏi danh bạ bạn bè của bạn.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}

type FileCategory = 'image' | 'file' | 'link' | 'video';

function FilesTab({ channel }: { channel: Channel }) {
  const { jumpTo } = useChat();
  const [category, setCategory] = useState<FileCategory>('image');
  const [fileFilter, setFileFilter] = useState<'all' | 'pdf' | 'word' | 'excel' | 'ppt' | 'archive'>('all');
  const [files, setFiles] = useState<FileResult[] | null>(null);
  const [links, setLinks] = useState<LinkItem[] | null>(null);
  const [view, setView] = useState<number | null>(null);
  const lastId = channel.lastMessage?.id;

  useEffect(() => {
    let off = false;
    api<{ files: FileResult[] }>(`/api/channels/${channel.id}/files?limit=150`)
      .then((r) => !off && setFiles(r.files))
      .catch(() => !off && setFiles([]));

    api<{ links: LinkItem[] }>(`/api/channels/${channel.id}/links`)
      .then((r) => !off && setLinks(r.links))
      .catch(() => !off && setLinks([]));

    return () => {
      off = true;
    };
  }, [channel.id, lastId]);

  const images = useMemo(() => (files ?? []).filter((f) => isImageName(f.filename, f.mime)), [files]);
  const videos = useMemo(() => (files ?? []).filter((f) => isVideoName(f.filename, f.mime)), [files]);
  const allDocs = useMemo(
    () => (files ?? []).filter((f) => !isImageName(f.filename, f.mime) && !isVideoName(f.filename, f.mime)),
    [files],
  );

  const filteredDocs = useMemo(() => {
    if (fileFilter === 'all') return allDocs;
    return allDocs.filter((f) => {
      const lower = f.filename.toLowerCase();
      if (fileFilter === 'pdf') return lower.endsWith('.pdf') || f.mime.includes('pdf');
      if (fileFilter === 'word') return lower.endsWith('.doc') || lower.endsWith('.docx') || f.mime.includes('word');
      if (fileFilter === 'excel') return lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv') || f.mime.includes('sheet');
      if (fileFilter === 'ppt') return lower.endsWith('.ppt') || lower.endsWith('.pptx') || f.mime.includes('presentation');
      if (fileFilter === 'archive') return lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.7z') || f.mime.includes('zip');
      return true;
    });
  }, [allDocs, fileFilter]);

  const tabs: { key: FileCategory; label: string; icon: (props: { className?: string }) => React.ReactNode; count: number }[] = [
    { key: 'image', label: 'Ảnh', icon: ImageIcon, count: images.length },
    { key: 'file', label: 'File', icon: FileTextIcon, count: allDocs.length },
    { key: 'link', label: 'Link', icon: LinkIcon, count: links?.length ?? 0 },
    { key: 'video', label: 'Video', icon: VideoIcon, count: videos.length },
  ];

  const loading = files === null && links === null;

  return (
    <div data-files-tab className="space-y-3">
      {/* 4 Nhóm chính: Ảnh, File, Link, Video */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = category === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setCategory(t.key)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-semibold transition ${
                active
                  ? 'bg-white text-sky-700 shadow-sm dark:bg-slate-700 dark:text-sky-300'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-1">
                <Icon className="h-4 w-4" />
                <span>{t.label}</span>
              </div>
              <span
                className={`text-[10px] mt-0.5 ${
                  active ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {loading && <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">Đang tải...</p>}

      {/* 1. TAB HÌNH ẢNH */}
      {category === 'image' && (
        <div>
          {images.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
              <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Chưa có hình ảnh nào được chia sẻ
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {images.map((f, i) => (
                <button
                  key={f.id}
                  onClick={() => setView(i)}
                  title={f.filename}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 ring-1 ring-black/5 dark:ring-white/5"
                >
                  <img
                    src={f.url}
                    alt={f.filename}
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] p-1 text-center truncate">
                    {f.filename}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. TAB FILE (pptx, word, PDF, ...) */}
      {category === 'file' && (
        <div className="space-y-2">
          {/* Lọc nhanh định dạng file */}
          {allDocs.length > 0 && (
            <div className="flex flex-wrap gap-1 pb-1">
              {[
                { key: 'all' as const, label: 'Tất cả' },
                { key: 'pdf' as const, label: 'PDF' },
                { key: 'word' as const, label: 'Word' },
                { key: 'ppt' as const, label: 'PowerPoint' },
                { key: 'excel' as const, label: 'Excel' },
                { key: 'archive' as const, label: 'Nén' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFileFilter(f.key)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                    fileFilter === f.key
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {filteredDocs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
              <FileTextIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
              {allDocs.length === 0
                ? 'Chưa có tệp tài liệu nào (Word, PowerPoint, PDF...)'
                : 'Không có tệp nào theo bộ lọc này'}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {filteredDocs.map((f) => (
                <li
                  key={f.id}
                  className="group flex items-center gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-800/70 p-2 shadow-xs hover:border-sky-300 dark:hover:border-sky-700 transition"
                >
                  <FileIconBadge name={f.filename} mime={f.mime} size="h-9 w-9" />
                  <button
                    onClick={() => f.messageId && jumpTo(channel.id, f.messageId)}
                    className="min-w-0 flex-1 text-left"
                    title="Xem trong cuộc trò chuyện"
                  >
                    <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400">
                      {f.filename}
                    </p>
                    <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                      {fmtSize(f.size)} · {f.uploader?.name || 'Người dùng'} · {fmtShort(f.createdAt)}
                    </p>
                  </button>
                  <a
                    href={`${f.url}?download=1`}
                    download={f.filename}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-sky-400"
                    title="Tải xuống"
                  >
                    <DownloadIcon />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 3. TAB LINK */}
      {category === 'link' && (
        <div>
          {!links || links.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
              <LinkIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Chưa có liên kết web nào được gửi
            </div>
          ) : (
            <ul className="space-y-2">
              {links.map((l) => (
                <li
                  key={l.id}
                  className="group flex items-start gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-800/70 p-2.5 shadow-xs hover:border-sky-300 dark:hover:border-sky-700 transition"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 mt-0.5">
                    <LinkIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 max-w-full text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400"
                      title={l.url}
                    >
                      <span className="truncate">{l.title || l.url}</span>
                      <ExternalLinkIcon className="h-3 w-3 shrink-0" />
                    </a>
                    <p className="truncate text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{l.url}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      <span>
                        {l.sender.name} · {fmtShort(l.createdAt)}
                      </span>
                      <button
                        onClick={() => jumpTo(channel.id, l.messageId)}
                        className="text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300 font-medium"
                      >
                        Đến tin nhắn
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 4. TAB VIDEO */}
      {category === 'video' && (
        <div>
          {videos.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
              <VideoIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Chưa có video nào được chia sẻ
            </div>
          ) : (
            <div className="space-y-3">
              {videos.map((f) => (
                <div
                  key={f.id}
                  className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-800/70 p-2.5 shadow-xs space-y-2"
                >
                  <video
                    src={f.url}
                    controls
                    preload="metadata"
                    className="w-full aspect-video rounded-lg bg-black object-contain"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200"
                        title={f.filename}
                      >
                        {f.filename}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {fmtSize(f.size)} · {f.uploader?.name || 'Người dùng'} · {fmtShort(f.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {f.messageId && (
                        <button
                          onClick={() => jumpTo(channel.id, f.messageId!)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-700 dark:hover:text-sky-400"
                          title="Xem trong cuộc trò chuyện"
                        >
                          <ExternalLinkIcon className="h-4 w-4" />
                        </button>
                      )}
                      <a
                        href={`${f.url}?download=1`}
                        download={f.filename}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-700 dark:hover:text-sky-400"
                        title="Tải xuống"
                      >
                        <DownloadIcon />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view !== null && <Lightbox images={images} index={view} onClose={() => setView(null)} />}
    </div>
  );
}

function PinsTab({ channel }: { channel: Channel }) {
  const { state, loadPins, jumpTo, togglePin } = useChat();
  const pins = state.pins[channel.id];
  useEffect(() => {
    loadPins(channel.id);
  }, [channel.id, loadPins]);
  if (!pins) return <p className="text-xs text-slate-400 dark:text-slate-500">Đang tải...</p>;
  if (!pins.length) return <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">Chưa có tin nào được ghim</p>;
  return (
    <ul className="space-y-2" data-pins-tab>
      {pins.map((p) => (
        <li key={p.id} className="group relative rounded-xl border border-amber-200 bg-white p-3 shadow-sm dark:border-amber-950/60 dark:bg-slate-800/90">
          <button onClick={() => jumpTo(channel.id, p.id)} className="block w-full text-left" title="Đi tới tin nhắn">
            <div className="mb-1 flex items-center gap-2">
              <AnhDaiDien id={p.sender.id} name={p.sender.name} src={p.sender.avatar} size={22} />
              <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{p.sender.name}</span>
              <span className="ml-auto shrink-0 text-[10px] text-slate-400 dark:text-slate-500">{fmtShort(p.createdAt)}</span>
            </div>
            <p className="line-clamp-3 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{p.content || (p.attachments?.length ? `📎 ${p.attachments.map((a) => a.filename).join(', ')}` : '')}</p>
            {p.content && (p.attachments?.length ?? 0) > 0 && <p className="mt-1 truncate text-[11px] text-indigo-600 dark:text-sky-400">📎 {p.attachments.length} tệp đính kèm</p>}
          </button>
          {channel.canPin && (
            <button onClick={() => togglePin(p.id, false)} title="Bỏ ghim" className="absolute right-2 top-2 hidden rounded-md bg-white p-1 text-slate-400 shadow hover:text-rose-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:text-rose-400 group-hover:block">
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function CotPhai({ channel, tab, onTab, onClose }: { channel: Channel; tab: PanelTab; onTab: (t: PanelTab) => void; onClose: () => void }) {
  const tabs: { key: PanelTab; label: string }[] = [
    ...(channel.type !== 'DIRECT' ? [{ key: 'members' as const, label: 'Thành viên' }] : []),
    { key: 'files', label: 'Tài liệu' },
    { key: 'pins', label: `Đã ghim${channel.pinnedCount ? ` (${channel.pinnedCount})` : ''}` },
  ];
  const current = channel.type === 'DIRECT' && tab === 'members' ? 'files' : tab;
  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-[#1f2023] md:h-auto md:w-80" data-right-panel>
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 px-2 py-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onTab(t.key)}
            className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold ${current === t.key ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-sky-400 dark:ring-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            {t.key === 'pins' && <PinIcon className="h-3 w-3" />}
            {t.label}
          </button>
        ))}
        <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" title="Đóng"><XIcon /></button>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
        {current === 'members' && <MembersTab channel={channel} />}
        {current === 'files' && <FilesTab channel={channel} />}
        {current === 'pins' && <PinsTab channel={channel} />}
      </div>
    </aside>
  );
}
