import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '../state/ChatContext';
import { api } from '../lib/api';
import { channelTitle, fmtShort } from '../lib/format';
import { fmtSize, KIND_LABELS } from '../lib/files';
import { searchTokens } from '../lib/text';
import { parseContactCard, type FileResult, type SearchResult } from '../types';
import AnhDaiDien from './AnhDaiDien';
import { FileIconBadge } from './TepDinhKem';
import { DownloadIcon, HashIcon, MegaphoneIcon, PaperclipIcon, SearchIcon, UsersIcon, XIcon } from './BieuTuong';
import { Highlight } from './VanBanDinhDang';

type Tab = 'messages' | 'files';
const sel = 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-sky-500';

export default function ModalTimKiem({ initialChannelId, onClose }: { initialChannelId?: string; onClose: () => void }) {
  const { state, me, jumpTo } = useChat();
  const [tab, setTab] = useState<Tab>('messages');
  const [q, setQ] = useState('');
  const [channelId, setChannelId] = useState(initialChannelId ?? '');
  const [senderId, setSenderId] = useState('');
  const [hasFile, setHasFile] = useState(false);
  const [kind, setKind] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<{ results: SearchResult[]; total: number; tokens: string[] } | null>(null);
  const [files, setFiles] = useState<{ files: FileResult[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const channels = useMemo(() => Object.values(state.channels).sort((a, b) => channelTitle(a, me).localeCompare(channelTitle(b, me), 'vi')), [state.channels, me]);
  const senders = useMemo(() => {
    const map = new Map<string, string>();
    const src = channelId ? [state.channels[channelId]].filter(Boolean) : Object.values(state.channels);
    src.forEach((c) => (c.members || []).forEach((m) => map.set(m.id, m.id === me.id ? `${m.name} (bạn)` : m.name)));
    return [...map].sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  }, [state.channels, channelId, me.id]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (channelId) params.set('channelId', channelId);
    if (senderId) params.set('senderId', senderId);
    let off = false;
    const t = window.setTimeout(async () => {
      setError(null);
      try {
        if (tab === 'messages') {
          if (hasFile) params.set('hasFile', '1');
          if (!q.trim() && !senderId && !hasFile) return setMsgs(null);
          setBusy(true);
          params.set('limit', '30');
          const r = await api<{ results: SearchResult[]; total: number; tokens?: string[] }>(`/api/search/messages?${params}`);
          if (!off) setMsgs({ ...r, tokens: r.tokens ?? searchTokens(q) });
        } else {
          if (kind) params.set('kind', kind);
          setBusy(true);
          const r = await api<{ files: FileResult[]; total: number }>(`/api/search/files?${params}`);
          if (!off) setFiles(r);
        }
      } catch (e) {
        if (!off) setError((e as Error).message);
      } finally {
        if (!off) setBusy(false);
      }
    }, 250);
    return () => { off = true; window.clearTimeout(t); };
  }, [tab, q, channelId, senderId, hasFile, kind]);

  const open = (cid: string, mid: string | null) => {
    if (!mid) return;
    jumpTo(cid, mid);
    onClose();
  };

  const chLabel = (c: { id: string; name: string; type: string; courseCode: string | null }) => {
    const full = state.channels[c.id];
    return full ? channelTitle(full, me) : c.courseCode ? `${c.courseCode} ${c.name}` : c.name;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 pt-[8vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div data-search-modal className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:border dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <SearchIcon className="h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === 'messages' ? 'Tìm tin nhắn (gõ không dấu cũng được)...' : 'Tìm tệp theo tên...'}
            className="flex-1 bg-transparent text-base outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100"
          />
          {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 dark:border-sky-800 dark:border-t-sky-400" />}
          <kbd className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400 dark:border-slate-700 dark:text-slate-400">Esc</kbd>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><XIcon /></button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 dark:border-slate-800 dark:bg-slate-850">
          <div className="mr-2 flex gap-1 rounded-xl bg-slate-200/60 p-0.5 text-xs font-semibold dark:bg-slate-800">
            {(['messages', 'files'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 ${tab === t ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-sky-300' : 'text-slate-500 dark:text-slate-400'}`}>
                {t === 'messages' ? 'Tin nhắn' : 'Tệp'}
              </button>
            ))}
          </div>
          <select value={channelId} onChange={(e) => { setChannelId(e.target.value); setSenderId(''); }} className={sel} aria-label="Lọc theo kênh">
            <option value="">Tất cả kênh</option>
            {channels.map((c) => <option key={c.id} value={c.id}>{channelTitle(c, me)}</option>)}
          </select>
          <select value={senderId} onChange={(e) => setSenderId(e.target.value)} className={sel} aria-label="Lọc theo người gửi">
            <option value="">Mọi người gửi</option>
            {senders.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          {tab === 'messages' ? (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={hasFile} onChange={(e) => setHasFile(e.target.checked)} className="accent-indigo-600" />
              <PaperclipIcon className="h-3.5 w-3.5" /> Có tệp đính kèm
            </label>
          ) : (
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={sel} aria-label="Loại tệp">
              {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
        </div>

        <div className="scroll-thin min-h-[240px] flex-1 overflow-y-auto p-2">
          {error && <p className="p-4 text-sm text-rose-600">{error}</p>}
          {tab === 'messages' && !msgs && !error && (
            <div className="p-10 text-center text-sm text-slate-400">
              <p>Nhập từ khoá để tìm trong tất cả kênh của bạn.</p>
              <p className="mt-1 text-xs">Ví dụ: <i>lich thi</i>, <i>bai tap</i>, <i>đồ án</i> · Phím tắt <kbd className="rounded border px-1">Ctrl</kbd> + <kbd className="rounded border px-1">K</kbd></p>
            </div>
          )}
          {tab === 'messages' && msgs && (
            <>
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{msgs.total} kết quả</p>
              {msgs.results.length === 0 && <p className="p-8 text-center text-sm text-slate-400">Không tìm thấy tin nhắn phù hợp</p>}
              <ul data-search-results>
                {msgs.results.map((m) => (
                  <li key={m.id}>
                    <button onClick={() => open(m.channelId, m.id)} className="flex w-full gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-indigo-50/60 dark:hover:bg-slate-800/80">
                      <AnhDaiDien id={m.sender.id} name={m.sender.name} src={m.sender.avatar} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">{m.sender.name}</span>
                          <span className="flex items-center gap-1 truncate text-slate-400 dark:text-slate-400">
                            {m.channel.type === 'ANNOUNCEMENT' ? <MegaphoneIcon className="h-3 w-3" /> : m.channel.type === 'COMMUNITY' ? <UsersIcon className="h-3 w-3" /> : m.channel.type === 'CLASS' ? <HashIcon className="h-3 w-3" /> : null}
                            {chLabel(m.channel)}
                          </span>
                          <span className="ml-auto shrink-0 text-slate-400 dark:text-slate-500">{fmtShort(m.createdAt)}</span>
                        </div>
                        <p className="line-clamp-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                          {parseContactCard(m.content) ? (
                            <span className="font-medium text-sky-700 dark:text-sky-300">
                              📇 [Danh thiếp] {parseContactCard(m.content)?.name} {parseContactCard(m.content)?.studentCode ? `(MSSV: ${parseContactCard(m.content)?.studentCode})` : `(${parseContactCard(m.content)?.email})`}
                            </span>
                          ) : (
                            <Highlight text={m.content} tokens={msgs.tokens} />
                          )}
                        </p>
                        {m.attachments.length > 0 && (
                          <p className="mt-0.5 truncate text-[11px] text-indigo-600 dark:text-sky-400">📎 {m.attachments.map((a) => a.filename).join(', ')}</p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {tab === 'files' && files && (
            <>
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{files.total} tệp</p>
              {files.files.length === 0 && <p className="p-8 text-center text-sm text-slate-400">Không tìm thấy tệp phù hợp</p>}
              <ul data-file-results>
                {files.files.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 rounded-2xl px-3 py-2 hover:bg-indigo-50/60 dark:hover:bg-slate-800/80">
                    {f.isImage ? (
                      <img src={f.url} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" loading="lazy" />
                    ) : (
                      <FileIconBadge name={f.filename} mime={f.mime} />
                    )}
                    <button onClick={() => open(f.channelId, f.messageId)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100"><Highlight text={f.filename} tokens={searchTokens(q)} /></p>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{fmtSize(f.size)} · {f.uploader.name} · {chLabel(f.channel)} · {fmtShort(f.createdAt)}</p>
                    </button>
                    <a href={`${f.url}?download=1`} download={f.filename} title="Tải xuống" className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-indigo-600 dark:hover:bg-slate-700 dark:hover:text-sky-300"><DownloadIcon /></a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
