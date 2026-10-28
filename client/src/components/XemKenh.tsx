import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useChat } from '../state/ChatContext';
import { useCall } from '../state/CallContext';
import { useToast } from '../state/toast';
import { channelTitle, directPeer, fmtShort, roleLabel } from '../lib/format';
import { parseCallLog, parseContactCard, type Channel, type Message, type UiMessage } from '../types';
import AnhDaiDien from './AnhDaiDien';
import KhungSoanTin, { type KhungSoanTinHandle } from './KhungSoanTin';
import DanhSachTinNhan from './DanhSachTinNhan';
import type { MessageActions } from './TinNhanItem';
import CotPhai, { type PanelTab } from './CotPhai';
import MenuThongBao from './MenuThongBao';
import Modal, { btn } from './ui/HopThoai';
import ModalSuaKenh from './ModalSuaKenh';
import ChinhSuaAnhKenh from './ChinhSuaAnhKenh';
import { FolderIcon, HashIcon, MegaphoneIcon, PhoneIcon, PinIcon, SearchIcon, UploadIcon, UsersIcon, PencilIcon } from './BieuTuong';

function PinnedBar({ channel, onOpen }: { channel: Channel; onOpen: () => void }) {
  const { state, loadPins, jumpTo } = useChat();
  const pins = state.pins[channel.id];
  useEffect(() => {
    if (channel.pinnedCount > 0 && !pins) loadPins(channel.id);
  }, [channel.id, channel.pinnedCount, pins, loadPins]);
  if (!channel.pinnedCount || !pins?.length) return null;
  const p = pins[0];
  return (
    <div data-pinned-bar className="flex items-center gap-3 border-b border-amber-100 bg-amber-50/70 px-6 py-2 dark:border-amber-950/60 dark:bg-amber-950/30">
      <PinIcon className="h-4 w-4 shrink-0 text-amber-500" />
      <button onClick={() => jumpTo(channel.id, p.id)} className="min-w-0 flex-1 text-left" title="Đi tới tin đã ghim">
        <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">Tin đã ghim · {p.sender.name}</p>
        <p className="truncate text-xs text-slate-600 dark:text-slate-300">
          {parseCallLog(p.content)
            ? `📞 [Cuộc gọi] ${parseCallLog(p.content)?.status === 'ended' ? 'Đã kết thúc' : 'Cuộc gọi nhỡ'}`
            : parseContactCard(p.content)
            ? `📇 [Danh thiếp] ${parseContactCard(p.content)?.name}`
            : p.content || (p.attachments.length ? `📎 ${p.attachments[0].filename}` : '')}
        </p>
      </button>
      {channel.pinnedCount > 1 && (
        <button onClick={onOpen} className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-slate-800 dark:text-amber-300 dark:ring-amber-900/60 dark:hover:bg-slate-700">
          Xem tất cả ({channel.pinnedCount})
        </button>
      )}
    </div>
  );
}

export default function XemKenh({
  channel, panel, onPanel, onSearch,
}: { channel: Channel; panel: PanelTab | null; onPanel: (t: PanelTab | null) => void; onSearch: (channelId?: string) => void }) {
  const { state, me, loadHistory, markRead, editMessage, deleteMessage, togglePin, jumpTo, retry, discard } = useChat();
  const { startCall } = useCall();
  const toast = useToast();
  const cm = state.messages[channel.id];
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [confirmDel, setConfirmDel] = useState<UiMessage | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showChinhSuaAnhDaiDien, setShowChinhSuaAnhDaiDien] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const composer = useRef<KhungSoanTinHandle>(null);
  const [unreadFromSeq] = useState(() => (channel.unreadCount > 0 ? channel.lastReadSeq : null));

  useEffect(() => {
    if (cm?.loaded) return;
    loadHistory(channel.id).catch(() => setLoadError('Không tải được tin nhắn. Sẽ thử lại khi có mạng.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, cm?.loaded, state.connection]);

  // Đánh dấu đã đọc tới tin mới nhất (chỉ khi đang xem phần cuối cuộc trò chuyện)
  const lastSent = useMemo(() => {
    if (cm?.hasNewer) return null;
    const items = cm?.items ?? [];
    for (let i = items.length - 1; i >= 0; i--) if (items[i].status === 'sent') return items[i];
    return null;
  }, [cm?.items, cm?.hasNewer]);

  useEffect(() => {
    if (!lastSent) return;
    const tryMark = () => {
      if (document.visibilityState === 'visible') markRead(channel.id, lastSent.id);
    };
    tryMark();
    document.addEventListener('visibilitychange', tryMark);
    window.addEventListener('focus', tryMark);
    return () => {
      document.removeEventListener('visibilitychange', tryMark);
      window.removeEventListener('focus', tryMark);
    };
  }, [channel.id, lastSent, markRead, state.connection, channel.lastReadSeq]);

  const actions = useMemo<MessageActions>(
    () => ({
      onReply: (m) => { setReplyTo(m); composer.current?.focus(); },
      onPin: async (m, pinned) => {
        if (await togglePin(m.id, pinned)) toast.push({ kind: 'success', title: pinned ? 'Đã ghim tin nhắn' : 'Đã bỏ ghim', timeout: 2500 });
      },
      onEdit: (m, content) => editMessage(m.id, content),
      onDelete: (m) => setConfirmDel(m),
      onJump: (id) => jumpTo(channel.id, id),
      onRetry: (m) => retry(m.clientId),
      onDiscard: (m) => discard(m.clientId, channel.id),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channel.id, togglePin, editMessage, jumpTo, retry, discard],
  );

  const peer = channel.type === 'DIRECT' ? directPeer(channel, me) : null;
  const onlineCount = (channel.members || []).filter((m) => state.online[m.id]).length;
  const typers = Object.entries(state.typing[channel.id] ?? {})
    .filter(([uid]) => uid !== me.id)
    .map(([, t]) => t.name)
    .filter(Boolean);

  const hasFiles = (e: DragEvent) => [...e.dataTransfer.types].includes('Files');
  const dragProps = channel.canPost
    ? {
        onDragEnter: (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth.current++; setDragging(true); },
        onDragOver: (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); },
        onDragLeave: () => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); },
        onDrop: (e: DragEvent) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          composer.current?.addFiles([...e.dataTransfer.files]);
        },
      }
    : {};

  const headBtn = (active: boolean) =>
    `relative rounded-xl p-2 transition ${active ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-700 dark:hover:text-sky-300'}`;
  const toggle = (t: PanelTab) => onPanel(panel === t ? null : t);

  return (
    <div className="relative flex min-h-0 flex-1">
      <section className="relative flex min-w-0 flex-1 flex-col bg-slate-50 dark:bg-[#18191a]" {...dragProps}>
        <header className="flex min-h-[68px] items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 sm:gap-3 sm:px-6 sm:py-3 dark:border-slate-800 dark:bg-[#202124]">
          {peer ? (
            <AnhDaiDien id={peer.id} name={peer.name} src={peer.avatar} size={40} online={!!state.online[peer.id]} />
          ) : channel.avatar ? (
            <AnhDaiDien id={channel.id} name={channel.name} src={`/api/channel-avatars/${channel.id}`} size={40} />
          ) : (
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${channel.type === 'ANNOUNCEMENT' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300' : channel.type === 'COMMUNITY' ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300' : 'bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300'}`}>
              {channel.type === 'ANNOUNCEMENT' ? <MegaphoneIcon /> : channel.type === 'COMMUNITY' ? <UsersIcon /> : <HashIcon />}
            </div>
          )}
          {!peer && channel.canManage && (
            <button onClick={() => setShowChinhSuaAnhDaiDien(true)} title="Đổi ảnh đại diện kênh" className="-ml-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-800">
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-bold text-slate-900 dark:text-white">
                {channelTitle(channel, me)}
                {channel.archived && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">ĐÃ LƯU TRỮ</span>}
              </h2>
              {(channel.myRole === 'OWNER' || me.role === 'ADMIN') && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  title="Chỉnh sửa thông tin nhóm"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {peer
                ? state.online[peer.id]
                  ? 'Đang hoạt động'
                  : `${roleLabel[peer.role]}${peer.lastSeenAt ? ` · Hoạt động lúc ${fmtShort(peer.lastSeenAt)}` : ''}`
                : `${(channel.members || []).length} thành viên · ${onlineCount} đang hoạt động${channel.description ? ` · ${channel.description}` : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            {peer && (
              <button
                onClick={() => startCall(peer, channel.id)}
                title={`Gọi thoại cho ${peer.name}`}
                className={headBtn(false)}
                data-call-btn
              >
                <PhoneIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </button>
            )}
            <button onClick={() => onSearch(channel.id)} title="Tìm trong kênh này" className={headBtn(false)}><SearchIcon className="h-5 w-5" /></button>
            <button onClick={() => toggle('pins')} title="Tin đã ghim" className={headBtn(panel === 'pins')} data-open-pins>
              <PinIcon className="h-5 w-5" />
              {channel.pinnedCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">{channel.pinnedCount}</span>}
            </button>
            <button onClick={() => toggle('files')} title="Tài liệu của kênh" className={headBtn(panel === 'files')} data-open-files><FolderIcon /></button>
            {!peer && <button onClick={() => toggle('members')} title="Thành viên" className={headBtn(panel === 'members')}><UsersIcon /></button>}
            <MenuThongBao channel={channel} />
          </div>
        </header>

        <PinnedBar channel={channel} onOpen={() => onPanel('pins')} />
        {loadError && !cm?.loaded && <div className="px-6 py-2 text-sm text-rose-600">{loadError}</div>}
        <DanhSachTinNhan channel={channel} data={cm} unreadFromSeq={unreadFromSeq} actions={actions} />

        <div className="h-6 px-6 text-xs text-slate-500 dark:text-slate-400">
          {typers.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex gap-0.5">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
              </span>
              {typers.length === 1 ? `${typers[0]} đang soạn tin...` : `${typers.length} người đang soạn tin...`}
            </span>
          )}
        </div>
        <KhungSoanTin ref={composer} channel={channel} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />

        {dragging && (
          <div className="pointer-events-none absolute inset-3 z-30 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-indigo-400 bg-indigo-50/90 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-950/90 dark:text-indigo-300">
            <UploadIcon className="mb-2 h-10 w-10" />
            <p className="text-lg font-semibold">Thả tệp vào đây để gửi</p>
            <p className="text-sm text-indigo-500 dark:text-indigo-400">Ảnh, PDF, Word, Excel, PowerPoint, ZIP... tối đa 20MB mỗi tệp</p>
          </div>
        )}
      </section>
      {panel && (
        <div className="flex h-full w-80 shrink-0">
          <CotPhai channel={channel} tab={panel} onTab={onPanel} onClose={() => onPanel(null)} />
        </div>
      )}
      {confirmDel && (
        <Modal
          title="Xoá tin nhắn?"
          onClose={() => setConfirmDel(null)}
          width="max-w-sm"
          footer={
            <>
              <button className={btn.ghost} onClick={() => setConfirmDel(null)}>Huỷ</button>
              <button
                className={btn.danger}
                onClick={async () => {
                  const m = confirmDel;
                  setConfirmDel(null);
                  if (await deleteMessage(m.id)) toast.push({ kind: 'success', title: 'Đã xoá tin nhắn', timeout: 2500 });
                }}
              >
                Xoá
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-600">Tin nhắn sẽ bị xoá với mọi người trong kênh. Không thể hoàn tác.</p>
          <p className="mt-3 line-clamp-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {parseCallLog(confirmDel.content)
              ? `📞 [Cuộc gọi] ${parseCallLog(confirmDel.content)?.status === 'ended' ? 'Đã kết thúc' : 'Cuộc gọi nhỡ'}`
              : parseContactCard(confirmDel.content)
              ? `📇 [Danh thiếp] ${parseContactCard(confirmDel.content)?.name}`
              : confirmDel.content || '📎 Tệp đính kèm'}
          </p>
        </Modal>
      )}
      {showChinhSuaAnhDaiDien && (
        <ChinhSuaAnhKenh
          channel={channel}
          onClose={() => setShowChinhSuaAnhDaiDien(false)}
          onUpdated={(updated) => {
            window.dispatchEvent(new CustomEvent('khoachat:channel-avatar-updated', { detail: updated }));
            setShowChinhSuaAnhDaiDien(false);
          }}
        />
      )}
      {showEditModal && (
        <ModalSuaKenh
          channel={channel}
          onClose={() => setShowEditModal(false)}
          onUpdated={(updatedChannel) => {
            // Update channel in context
            // This will automatically update the UI since channel is from useChat context
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
}
