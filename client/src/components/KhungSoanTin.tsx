import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
  type ClipboardEvent, type KeyboardEvent,
} from 'react';
import { useChat } from '../state/ChatContext';
import { useToast } from '../state/toast';
import { ApiError, uploadFile } from '../lib/api';
import { ACCEPT, checkFile, fmtSize, isImageName } from '../lib/files';
import { channelTitle, roleLabel } from '../lib/format';
import { unaccent } from '../lib/text';
import { uuid } from '../lib/uuid';
import { parseCallLog, parseContactCard, type Attachment, type Channel, type ContactCardData, type Message } from '../types';
import AnhDaiDien from './AnhDaiDien';
import { FileIconBadge } from './TepDinhKem';
import ModalTheDanhBa from './ModalTheDanhBa';
import { ContactCardIcon, LockIcon, PaperclipIcon, ReplyIcon, SendIcon, UsersIcon, XIcon } from './BieuTuong';

interface Chip {
  localId: string;
  file: File;
  status: 'uploading' | 'done' | 'queued' | 'error';
  progress: number;
  attachment?: Attachment;
  error?: string;
  preview?: string;
  abort?: AbortController;
}

interface MentionOption { id: string; name: string; sub: string; avatar: string | null; all?: boolean }

export interface KhungSoanTinHandle {
  addFiles: (files: File[]) => void;
  focus: () => void;
}

const MAX_FILES = 10;

const KhungSoanTin = forwardRef<KhungSoanTinHandle, { channel: Channel; replyTo: Message | null; onCancelReply: () => void }>(
  function KhungSoanTin({ channel, replyTo, onCancelReply }, ref) {
    const { send, setTyping, me, state } = useChat();
    const toast = useToast();
    const draftKey = `khoachat.draft.${channel.id}`;
    const [text, setText] = useState(() => localStorage.getItem(draftKey) ?? '');
    const [chips, setChips] = useState<Chip[]>([]);
    const [mentions, setMentions] = useState<{ id: string; name: string }[]>([]);
    const [showContactModal, setShowContactModal] = useState(false);
    const [mq, setMq] = useState<{ start: number; query: string } | null>(null);
    const [sel, setSel] = useState(0);
    const taRef = useRef<HTMLTextAreaElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const typingRef = useRef<{ sentAt: number; timer?: number }>({ sentAt: 0 });
    const online = state.connection === 'online';
    const pendingCaret = useRef<number | null>(null);
    const chipsRef = useRef(chips);
    chipsRef.current = chips;

    useEffect(() => {
      taRef.current?.focus();
    }, [channel.id, replyTo]);

    useLayoutEffect(() => {
      const el = taRef.current;
      if (!el) return;
      if (pendingCaret.current !== null) {
        el.focus();
        el.setSelectionRange(pendingCaret.current, pendingCaret.current);
        pendingCaret.current = null;
      }
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [text]);

    useEffect(() => () => {
      stopTyping();
      chipsRef.current.forEach((c) => { c.abort?.abort(); if (c.preview) URL.revokeObjectURL(c.preview); });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const patchChip = (id: string, p: Partial<Chip>) => setChips((cs) => cs.map((c) => (c.localId === id ? { ...c, ...p } : c)));

    const startUpload = useCallback(
      (chip: Chip) => {
        const abort = new AbortController();
        patchChip(chip.localId, { status: 'uploading', progress: 0, abort, error: undefined });
        uploadFile<{ attachment: Attachment }>(
          `/api/channels/${channel.id}/uploads`, chip.file, chip.file.name,
          (p) => patchChip(chip.localId, { progress: p }), abort.signal,
        )
          .then(({ attachment }) => patchChip(chip.localId, { status: 'done', progress: 100, attachment }))
          .catch((e: ApiError) => {
            if (e.code === 'ABORTED') return;
            // Mất mạng -> chuyển sang hàng đợi, sẽ tải lên khi có mạng (sau khi bấm gửi)
            if (e.status === 0) patchChip(chip.localId, { status: 'queued', progress: 0 });
            else patchChip(chip.localId, { status: 'error', error: e.message });
          });
      },
      [channel.id],
    );

    const addFiles = useCallback(
      (files: File[]) => {
        if (!channel.canPost) return;
        const room = MAX_FILES - chipsRef.current.length;
        if (files.length > room) toast.push({ kind: 'error', title: `Tối đa ${MAX_FILES} tệp mỗi tin nhắn` });
        const next: Chip[] = [];
        for (const f of files.slice(0, Math.max(room, 0))) {
          const err = checkFile(f);
          if (err) {
            toast.push({ kind: 'error', title: f.name, body: err });
            continue;
          }
          next.push({
            localId: uuid(), file: f, status: online ? 'uploading' : 'queued', progress: 0,
            preview: isImageName(f.name) ? URL.createObjectURL(f) : undefined,
          });
        }
        setChips((cs) => [...cs, ...next]);
        if (online) next.forEach(startUpload);
        taRef.current?.focus();
      },
      [channel.canPost, online, startUpload, toast],
    );

    useImperativeHandle(ref, () => ({ addFiles, focus: () => taRef.current?.focus() }), [addFiles]);

    function removeChip(c: Chip) {
      c.abort?.abort();
      if (c.preview) URL.revokeObjectURL(c.preview);
      setChips((cs) => cs.filter((x) => x.localId !== c.localId));
    }

    function stopTyping() {
      const t = typingRef.current;
      if (t.timer) window.clearTimeout(t.timer);
      if (t.sentAt) setTyping(channel.id, false);
      t.sentAt = 0;
    }

    // ---------- @nhắc tên ----------
    const options = useMemo<MentionOption[]>(() => {
      if (!mq) return [];
      const q = unaccent(mq.query.trim());
      const membersList = channel.members || [];
      const list: MentionOption[] = membersList
        .filter((m) => m.id !== me.id && unaccent(m.name).includes(q))
        .sort((a, b) => Number(unaccent(b.name).startsWith(q)) - Number(unaccent(a.name).startsWith(q)) || a.name.localeCompare(b.name, 'vi'))
        .slice(0, 8)
        .map((m) => ({ id: m.id, name: m.name, sub: roleLabel[m.role], avatar: m.avatar }));
      if (channel.canMentionAll && ('all'.startsWith(q) || 'channel'.startsWith(q) || q === '')) {
        list.unshift({ id: '__all', name: 'all', sub: `Thông báo cho cả ${membersList.length} thành viên`, avatar: null, all: true });
      }
      return list;
    }, [mq, channel.members, channel.canMentionAll, me.id]);

    function detectMention(value: string, caret: number) {
      const before = value.slice(0, caret);
      const m = /(^|\s)@([^@\n]{0,30})$/.exec(before);
      if (!m) return setMq(null);
      const query = m[2];
      // Cho phép khoảng trắng (tên có nhiều từ) nhưng đóng khi không còn ai khớp
      const start = before.length - query.length - 1;
      if (query.includes(' ') && !(channel.members || []).some((x) => unaccent(x.name).includes(unaccent(query.trim())))) return setMq(null);
      setMq({ start, query });
      setSel(0);
    }

    function pickMention(o: MentionOption) {
      if (!mq) return;
      const el = taRef.current;
      const caret = el?.selectionStart ?? text.length;
      const insert = `@${o.name} `;
      const value = text.slice(0, mq.start) + insert + text.slice(caret);
      setText(value);
      localStorage.setItem(draftKey, value);
      if (!o.all) setMentions((ms) => (ms.some((x) => x.id === o.id) ? ms : [...ms, { id: o.id, name: o.name }]));
      setMq(null);
      pendingCaret.current = mq.start + insert.length;
    }

    function onChange(v: string, caret: number) {
      setText(v);
      localStorage.setItem(draftKey, v);
      detectMention(v, caret);
      const t = typingRef.current;
      if (!v.trim()) return stopTyping();
      if (Date.now() - t.sentAt > 2500) {
        setTyping(channel.id, true);
        t.sentAt = Date.now();
      }
      if (t.timer) window.clearTimeout(t.timer);
      t.timer = window.setTimeout(stopTyping, 3500);
    }

    const uploading = chips.some((c) => c.status === 'uploading');
    const usable = chips.filter((c) => c.status === 'done' || c.status === 'queued');
    const canSend = (!!text.trim() || usable.length > 0) && !uploading;

    function submit() {
      if (!canSend) return;
      const content = text.trim();
      const mentionIds = mentions.filter((m) => content.includes(`@${m.name}`)).map((m) => m.id);
      if (chips.some((c) => c.status === 'error')) toast.push({ kind: 'error', title: 'Một số tệp lỗi không được gửi kèm' });
      send(channel.id, {
        content,
        mentionIds,
        replyTo,
        attachments: chips.filter((c) => c.status === 'done').map((c) => c.attachment!),
        files: chips.filter((c) => c.status === 'queued').map((c) => c.file),
      });
      chips.forEach((c) => c.preview && URL.revokeObjectURL(c.preview));
      setChips([]);
      setText('');
      setMentions([]);
      setMq(null);
      localStorage.removeItem(draftKey);
      onCancelReply();
      stopTyping();
    }

    const handleSendContact = (contact: ContactCardData) => {
      send(channel.id, {
        content: '__contact__:' + JSON.stringify(contact),
        replyTo,
        mentionIds: [],
        attachments: [],
        files: [],
      });
      onCancelReply();
    };

    function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
      if (mq && options.length) {
        if (e.key === 'ArrowDown') { e.preventDefault(); return setSel((s) => (s + 1) % options.length); }
        if (e.key === 'ArrowUp') { e.preventDefault(); return setSel((s) => (s - 1 + options.length) % options.length); }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); return pickMention(options[sel]); }
        if (e.key === 'Escape') { e.preventDefault(); return setMq(null); }
      }
      if (e.key === 'Escape' && replyTo) return onCancelReply();
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        submit();
      }
    }

    function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
      const files = [...e.clipboardData.files];
      if (files.length) {
        e.preventDefault();
        addFiles(files.map((f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], `anh-dan-${Date.now()}-${i + 1}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type }))));
      }
    }

    if (!channel.canPost) {
      return (
        <div className="mx-6 mb-5 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-850 dark:text-slate-400">
          <LockIcon />
          {channel.isMuted
            ? 'Bạn đã bị cấm chat trong nhóm này bởi người quản lý.'
            : channel.isChannelLocked
            ? 'Nhóm hiện đang bật chế độ cấm chat (chỉ chủ nhóm và quản lý được gửi tin nhắn).'
            : channel.type === 'ANNOUNCEMENT'
            ? 'Chỉ giảng viên và quản trị viên được đăng trong kênh thông báo.'
            : 'Bạn không thể gửi tin nhắn trong kênh này.'}
        </div>
      );
    }

    const placeholder = channel.type === 'DIRECT' ? `Nhắn tin tới ${channelTitle(channel, me)}` : `Nhắn tin vào ${channel.courseCode ?? channel.name}`;

    return (
      <div className="relative bg-white px-3 pb-3 pt-2 sm:px-6 sm:pb-5 dark:bg-[#18191a]">
        {mq && options.length > 0 && (
          <div data-mention-popup className="absolute bottom-full left-6 z-20 mb-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
            <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:text-slate-400">Nhắc đến thành viên</p>
            <ul className="max-h-72 overflow-y-auto p-1">
              {options.map((o, i) => (
                <li key={o.id}>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); pickMention(o); }}
                    onMouseEnter={() => setSel(i)}
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left ${i === sel ? 'bg-indigo-50 dark:bg-sky-950/60' : ''}`}
                  >
                    {o.all ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-300"><UsersIcon className="h-4 w-4" /></div>
                    ) : (
                      <AnhDaiDien id={o.id} name={o.name} src={o.avatar} size={32} online={!!state.online[o.id]} />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{o.all ? '@all' : o.name}</div>
                      <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">{o.sub}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50 dark:border-slate-700 dark:bg-[#242526] dark:focus-within:border-sky-500 dark:focus-within:ring-sky-950/50">
          {replyTo && (
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <ReplyIcon className="h-4 w-4 text-indigo-500 dark:text-sky-400" />
              <div className="min-w-0 flex-1">
                <span>Đang trả lời <b>{replyTo.senderId === me.id ? 'chính bạn' : replyTo.sender.name}</b></span>
                <p className="truncate text-slate-400 dark:text-slate-500">
                  {parseCallLog(replyTo.content)
                    ? `📞 [Cuộc gọi] ${parseCallLog(replyTo.content)?.status === 'ended' ? 'Đã kết thúc' : 'Cuộc gọi nhỡ'}`
                    : parseContactCard(replyTo.content)
                    ? `📇 [Danh thiếp] ${parseContactCard(replyTo.content)?.name}`
                    : replyTo.content || (replyTo.attachments.length ? '📎 Tệp đính kèm' : '')}
                </p>
              </div>
              <button onClick={onCancelReply} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" title="Huỷ trả lời"><XIcon /></button>
            </div>
          )}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b border-slate-100 p-2 dark:border-slate-700" data-upload-chips>
              {chips.map((c) => (
                <div key={c.localId} className={`relative flex w-52 items-center gap-2 rounded-xl border p-1.5 ${c.status === 'error' ? 'border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/40' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'}`}>
                  {c.preview ? (
                    <img src={c.preview} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <FileIconBadge name={c.file.name} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200" title={c.file.name}>{c.file.name}</p>
                    <p className={`truncate text-[11px] ${c.status === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {c.status === 'uploading' && `Đang tải lên ${c.progress}%`}
                      {c.status === 'done' && `${fmtSize(c.file.size)} · Sẵn sàng`}
                      {c.status === 'queued' && `${fmtSize(c.file.size)} · Gửi khi có mạng`}
                      {c.status === 'error' && c.error}
                    </p>
                    {c.status === 'uploading' && (
                      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full bg-indigo-500 dark:bg-sky-500 transition-all" style={{ width: `${c.progress}%` }} /></div>
                    )}
                  </div>
                  <button onClick={() => removeChip(c)} className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-700 p-0.5 text-white hover:bg-slate-900 dark:bg-slate-600 dark:hover:bg-slate-500" title="Bỏ tệp"><XIcon className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-1 p-2">
            <button onClick={() => fileRef.current?.click()} title="Đính kèm tệp / ảnh (tối đa 20MB)" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-sky-400 transition">
              <PaperclipIcon />
            </button>
            <button
              type="button"
              onClick={() => setShowContactModal(true)}
              title="Gửi danh thiếp liên hệ"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-sky-600 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-sky-400 transition"
            >
              <ContactCardIcon className="h-5 w-5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              data-file-input
              onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ''; }}
            />
            <textarea
              ref={taRef}
              rows={1}
              value={text}
              onChange={(e) => onChange(e.target.value, e.target.selectionStart)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              onBlur={() => { stopTyping(); setTimeout(() => setMq(null), 150); }}
              onClick={(e) => detectMention(text, (e.target as HTMLTextAreaElement).selectionStart)}
              maxLength={4000}
              placeholder={placeholder}
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100 chat-bubble break-words"
            />
            <button
              onClick={submit}
              disabled={!canSend}
              title={uploading ? 'Đang tải tệp lên...' : 'Gửi (Enter)'}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 dark:bg-sky-600 dark:hover:bg-sky-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
            >
              <SendIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mt-1.5 hidden px-1 text-[11px] text-slate-400 dark:text-slate-500 sm:block">
          Enter để gửi · Shift + Enter xuống dòng · @ để nhắc tên · Kéo thả hoặc dán ảnh để đính kèm
        </p>

        {showContactModal && (
          <ModalTheDanhBa
            onClose={() => setShowContactModal(false)}
            onSelect={handleSendContact}
          />
        )}
      </div>
    );
  },
);

export default KhungSoanTin;
