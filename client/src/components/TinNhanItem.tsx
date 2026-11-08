import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { fmtTime, roleLabel } from '../lib/format';
import { parseContactCard, type Channel, type ContactCardData, type UiMessage } from '../types';
import { useChat } from '../state/ChatContext';
import AnhDaiDien from './AnhDaiDien';
import TepDinhKem from './TepDinhKem';
import VanBanDinhDang from './VanBanDinhDang';
import {
  AlertIcon, CheckIcon, ClockIcon, ContactCardIcon, DoubleCheckIcon, EditIcon, PinIcon, PinOutlineIcon, ReplyIcon, TrashIcon,
} from './BieuTuong';

export interface MessageActions {
  onReply: (m: UiMessage) => void;
  onPin: (m: UiMessage, pinned: boolean) => void;
  onEdit: (m: UiMessage, content: string) => Promise<boolean>;
  onDelete: (m: UiMessage) => void;
  onAck?: (m: UiMessage) => void;
  onShowAcks?: (m: UiMessage) => void;
  onJump: (messageId: string) => void;
  onRetry: (m: UiMessage) => void;
  onDiscard: (m: UiMessage) => void;
}

function StatusBadge({ m }: { m: UiMessage }) {
  if (m.status === 'pending')
    return (
      <span className="inline-flex items-center gap-1 text-amber-500" title="Đang chờ gửi">
        <ClockIcon /> {m.progress !== undefined ? `Đang tải lên ${m.progress}%` : 'Đang gửi'}
      </span>
    );
  if (m.status === 'failed')
    return <span className="inline-flex items-center gap-1 text-rose-500" title={m.error}><AlertIcon /> Gửi thất bại{m.error ? `: ${m.error}` : ''}</span>;

  // Đã có người nhận/xem (bất kỳ ai khác người gửi đã đọc)
  const isReceived = (m.ackUserIds || []).some((id) => id !== m.senderId);

  if (isReceived) {
    return (
      <span className="inline-flex items-center text-sky-500 dark:text-sky-400" title="Đã nhận">
        <DoubleCheckIcon className="h-3.5 w-3.5" />
      </span>
    );
  }

  // 1 dấu tích: Đã gửi đến máy chủ
  return (
    <span className="inline-flex items-center text-slate-400 dark:text-slate-500" title="Đã gửi">
      <CheckIcon className="h-3.5 w-3.5" />
    </span>
  );
}

function ContactCardBubble({
  card,
  mine,
  meId,
  pinned,
  deleted,
}: {
  card: ContactCardData;
  mine: boolean;
  meId: string;
  pinned: boolean;
  deleted: boolean;
}) {
  const { openDirect, state } = useChat();

  if (deleted) {
    return (
      <div className={`whitespace-pre-wrap break-words chat-bubble rounded-2xl px-4 py-2 text-sm leading-relaxed ${mine ? 'bubble-mine bg-sky-600 text-white rounded-tr-md' : 'bg-white text-slate-800 ring-1 ring-slate-100 shadow-sm rounded-tl-md dark:bg-[#2b2d31] dark:text-slate-200 dark:ring-slate-700/60'}`}>
        <em className="opacity-60">Tin nhắn đã bị thu hồi</em>
      </div>
    );
  }

  const isSelf = card.userId === meId;

  const handleMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    openDirect(card.userId);
  };

  return (
    <div className={`w-64 sm:w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${mine ? 'rounded-tr-md' : 'rounded-tl-md'}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-3.5 py-2 dark:border-slate-700 dark:bg-slate-800/90">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-800 dark:text-sky-300">
          <ContactCardIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          <span>Danh thiếp liên hệ</span>
        </div>
        {pinned && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            <PinIcon className="h-3 w-3" /> Đã ghim
          </span>
        )}
      </div>

      {/* Body info */}
      <div className="p-3.5">
        <div className="flex items-start gap-3">
          <AnhDaiDien id={card.userId} name={card.name} src={card.avatar} size={44} online={!!state.online[card.userId]} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{card.name}</span>
              <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/80 dark:text-sky-300">
                {roleLabel[card.role]}
              </span>
            </div>
            {card.studentCode && (
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">MSSV: {card.studentCode}</p>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-400 truncate">{card.email}</p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="border-t border-slate-100 bg-slate-50/50 p-2 flex items-center gap-1.5 justify-end text-xs dark:border-slate-700 dark:bg-slate-800/50">
        {isSelf ? (
          <span className="text-xs text-slate-400 italic px-2 py-1">Danh thiếp của bạn</span>
        ) : (
          <button
            onClick={handleMessage}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1 font-semibold text-sky-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-sky-300 dark:hover:bg-slate-600"
          >
            Nhắn tin
          </button>
        )}
      </div>
    </div>
  );
}

function TinNhanItem({
  m, mine, grouped, online, channel, meId, mentioned, actions, tokens,
}: {
  m: UiMessage; mine: boolean; grouped: boolean; online: boolean; channel: Channel; meId: string;
  mentioned: boolean; actions: MessageActions; tokens?: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.content);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const announcement = channel.type === 'ANNOUNCEMENT';
  const deleted = !!m.deletedAt;
  const sent = m.status === 'sent';
  const contactCard = !deleted ? parseContactCard(m.content) : null;

  useEffect(() => {
    if (editing) {
      const el = editRef.current;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);

  async function saveEdit() {
    const text = draft.trim();
    if (!text && !m.attachments.length) return;
    if (text === m.content) return setEditing(false);
    if (await actions.onEdit(m, text)) setEditing(false);
  }
  function onEditKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      setEditing(false);
      setDraft(m.content);
    }
  }

  const bubble = mine
    ? `bubble-mine bg-sky-600 text-white ${!sent ? 'opacity-70' : ''}`
    : announcement
      ? 'bg-amber-50 text-slate-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30'
      : 'bg-white text-slate-800 ring-1 ring-slate-100 shadow-sm dark:bg-[#2b2d31] dark:text-slate-100 dark:ring-slate-700/60';
  const hasText = !!m.content || deleted;

  return (
    <div
      data-mid={m.id}
      className={`group relative flex gap-3 px-2 ${mine ? 'flex-row-reverse' : ''} ${
        grouped ? (announcement ? 'mt-3.5' : 'mt-2.5') : 'mt-4'
      } ${
        mentioned ? 'rounded-xl bg-slate-50 dark:bg-slate-800/60 py-1' : ''
      }`}
      onContextMenu={(e) => {
        e.preventDefault();
        if ((mine || channel.canModerate) && sent && !deleted && !editing) {
          actions.onDelete(m);
        }
      }}
    >
      {!mine && (
        <div className="w-9 shrink-0">
          {!grouped && <AnhDaiDien id={m.sender.id} name={m.sender.name} src={m.sender.avatar} size={36} online={online} />}
        </div>
      )}
      <div className={`flex min-w-0 max-w-[85%] sm:max-w-[75%] md:max-w-[68%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {!grouped && (
          <div className={`mb-1 flex items-baseline gap-2 text-xs ${mine ? 'flex-row-reverse' : ''}`}>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{mine ? 'Bạn' : m.sender.name}</span>
            {!mine && m.sender.role !== 'STUDENT' && (
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-sky-950/80 dark:text-sky-300">{roleLabel[m.sender.role]}</span>
            )}
            <span className="text-slate-400 dark:text-slate-500">{fmtTime(m.createdAt)}</span>
          </div>
        )}

        {m.replyTo && !deleted && (
          <button
            onClick={() => actions.onJump(m.replyTo!.id)}
            className={`mb-1 flex max-w-full items-start gap-2 rounded-xl border-l-4 px-3 py-1.5 text-left text-xs ${
              mine
                ? 'border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-200'
                : 'border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300'
            } hover:brightness-95`}
            title="Xem tin được trả lời"
          >
            <ReplyIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0">
              <span className="font-semibold">{m.replyTo.senderName}</span>
              <span className="line-clamp-1 opacity-80">
                {m.replyTo.deleted
                  ? 'Tin nhắn đã bị thu hồi'
                  : parseContactCard(m.replyTo.content)
                  ? `📇 [Danh thiếp] ${parseContactCard(m.replyTo.content)?.name}`
                  : m.replyTo.content || (m.replyTo.attachmentCount ? '📎 Tệp đính kèm' : '')}
              </span>
            </span>
          </button>
        )}

        {editing ? (
          <div className="w-[min(32rem,100%)] rounded-2xl border border-indigo-300 bg-white p-2 shadow-sm ring-4 ring-indigo-50 dark:border-sky-500 dark:bg-slate-800 dark:ring-sky-950/40">
            <textarea
              ref={editRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onEditKey}
              rows={Math.min(6, draft.split('\n').length + 1)}
              className="w-full resize-none bg-transparent px-2 py-1 text-sm text-slate-800 dark:text-slate-100 outline-none chat-bubble break-words"
            />
            <div className="flex items-center justify-end gap-2 text-xs">
              <span className="mr-auto text-slate-400 dark:text-slate-500">Esc để huỷ · Enter để lưu</span>
              <button onClick={() => { setEditing(false); setDraft(m.content); }} className="rounded-lg px-2.5 py-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">Huỷ</button>
              <button onClick={saveEdit} className="rounded-lg bg-indigo-600 px-3 py-1 font-semibold text-white hover:bg-indigo-700 dark:bg-sky-600 dark:hover:bg-sky-500">Lưu</button>
            </div>
          </div>
        ) : (
          hasText && (
            contactCard ? (
              <ContactCardBubble
                card={contactCard}
                mine={mine}
                meId={meId}
                pinned={m.pinned}
                deleted={deleted}
              />
            ) : (
              <div className={`whitespace-pre-wrap break-words chat-bubble rounded-2xl px-4 py-2 text-sm leading-relaxed ${bubble} ${mine ? 'rounded-tr-md' : 'rounded-tl-md'}`}>
                {m.pinned && !deleted && (
                  <span className={`mb-1 flex items-center gap-1 text-[11px] font-medium ${mine ? 'text-indigo-200' : 'text-amber-600 dark:text-amber-400'}`}>
                    <PinIcon /> Đã ghim
                  </span>
                )}
                {deleted ? (
                  <em className="opacity-60">Tin nhắn đã bị thu hồi</em>
                ) : (
                  <VanBanDinhDang content={m.content} mentions={m.mentions} mentionAll={m.mentionAll} meId={meId} tokens={tokens} />
                )}
                {m.editedAt && !deleted && <span className={`ml-1 text-[11px] ${mine ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`}>(đã sửa)</span>}
              </div>
            )
          )
        )}
        {!hasText && m.pinned && (
          <span className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400"><PinIcon /> Đã ghim</span>
        )}
        {!deleted && <TepDinhKem items={m.attachments} mine={mine} progress={m.progress} />}

        {mine && (
          <div className="mt-0.5 flex items-center gap-2 text-[11px]">
            {grouped && <span className="text-slate-400 dark:text-slate-500 opacity-0 transition group-hover:opacity-100">{fmtTime(m.createdAt)}</span>}
            <StatusBadge m={m} />
            {m.status === 'failed' && (
              <>
                <button onClick={() => actions.onRetry(m)} className="font-semibold text-indigo-600 hover:underline">Thử lại</button>
                <button onClick={() => actions.onDiscard(m)} className="text-slate-500 hover:underline">Xoá</button>
              </>
            )}
          </div>
        )}
      </div>

      {sent && !deleted && !editing && (
        <div className="mt-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
          {channel.canPost && (
            <button
              onClick={() => actions.onReply(m)}
              className="rounded p-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              title="Trả lời"
            >
              <ReplyIcon className="h-3.5 w-3.5" />
            </button>
          )}
          {channel.canPin && (
            <button
              onClick={() => actions.onPin(m, !m.pinned)}
              className="rounded p-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              title={m.pinned ? 'Bỏ ghim' : 'Ghim tin'}
            >
              {m.pinned ? <PinIcon className="h-3.5 w-3.5" /> : <PinOutlineIcon className="h-3.5 w-3.5" />}
            </button>
          )}
          {mine && !contactCard && (
            <button
              onClick={() => { setDraft(m.content); setEditing(true); }}
              className="rounded p-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              title="Sửa"
            >
              <EditIcon className="h-3.5 w-3.5" />
            </button>
          )}
          {(mine || channel.canModerate) && (
            <button
              onClick={() => actions.onDelete(m)}
              className="rounded p-1 text-xs text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/60 dark:hover:text-rose-400"
              title="Thu hồi"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(TinNhanItem);
