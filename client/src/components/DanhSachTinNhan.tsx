import { Fragment, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useChat } from '../state/ChatContext';
import { mentionsMe, type ChannelMessages } from '../state/reducer';
import { fmtDay } from '../lib/format';
import type { Channel, UiMessage } from '../types';
import TinNhanItem, { type MessageActions } from './TinNhanItem';
import { ArrowDownIcon } from './BieuTuong';

const GROUP_MS = 5 * 60 * 1000;

export default function DanhSachTinNhan({
  channel, data, unreadFromSeq, actions,
}: { channel: Channel; data?: ChannelMessages; unreadFromSeq: number | null; actions: MessageActions }) {
  const { me, state, loadOlder, loadNewer, loadHistory } = useChat();
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<{ count: number; first?: string; last?: string; height: number }>({ count: 0, height: 0 });
  const items = data?.items ?? [];
  const jump = state.jump?.channelId === channel.id ? state.jump : null;
  const jumpHandled = useRef<number | null>(null);
  const isStaff = me.role !== 'STUDENT';
  // Đang "dính" ở cuối danh sách? -> ảnh tải xong (đổi chiều cao) vẫn giữ ở cuối
  const stick = useRef(true);

  // Quản lý cuộn: lần đầu -> cuối; tải tin cũ -> giữ vị trí; tin mới -> cuộn xuống nếu đang ở gần cuối
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const p = prev.current;
    const first = items[0]?.clientId;
    const last = items[items.length - 1]?.clientId;
    const pendingJump = jump && jumpHandled.current !== jump.nonce;
    if (pendingJump) {
      /* cuộn tới tin ở effect bên dưới */
    } else if (p.count === 0 && items.length) {
      const divider = el.querySelector('[data-unread-divider]') as HTMLElement | null;
      el.scrollTop = divider ? divider.offsetTop - 80 : el.scrollHeight;
    } else if (first !== p.first && last === p.last) {
      el.scrollTop += el.scrollHeight - p.height; // đã chèn tin cũ lên đầu
    } else if (last !== p.last) {
      const nearBottom = p.height - el.scrollTop - el.clientHeight < 160;
      const mine = items[items.length - 1]?.senderId === me.id;
      if (nearBottom || mine) el.scrollTop = el.scrollHeight;
    }
    prev.current = { count: items.length, first, last, height: el.scrollHeight };
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
  }, [items, me.id, jump]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onLoad = (e: Event) => {
      if ((e.target as HTMLElement).tagName !== 'IMG') return;
      if (stick.current) el.scrollTop = el.scrollHeight;
      prev.current.height = el.scrollHeight;
    };
    el.addEventListener('load', onLoad, true);
    return () => el.removeEventListener('load', onLoad, true);
  }, []);

  // Nhảy tới tin (từ tìm kiếm, tin ghim, trích dẫn, thông báo)
  useEffect(() => {
    if (!jump || jumpHandled.current === jump.nonce) return;
    const el = ref.current?.querySelector(`[data-mid="${jump.messageId}"]`) as HTMLElement | null;
    if (!el) return;
    jumpHandled.current = jump.nonce;
    el.scrollIntoView({ block: 'center' });
    el.classList.remove('flash-msg');
    void el.offsetWidth;
    el.classList.add('flash-msg');
    if (ref.current) prev.current.height = ref.current.scrollHeight;
  }, [jump, items]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    prev.current.height = el.scrollHeight;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (el.scrollTop < 120 && data?.hasMore && !data.loadingOlder) loadOlder(channel.id);
    if (data?.hasNewer && !data.loadingNewer && el.scrollHeight - el.scrollTop - el.clientHeight < 120) loadNewer(channel.id);
  };

  const rows = useMemo(() => {
    let dividerShown = false;
    return items.map((m, i) => {
      const prevMsg: UiMessage | undefined = items[i - 1];
      const newDay = !prevMsg || new Date(prevMsg.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
      const showDivider =
        !dividerShown && unreadFromSeq !== null && m.status === 'sent' && m.seq > unreadFromSeq && m.senderId !== me.id;
      if (showDivider) dividerShown = true;
      const grouped =
        !newDay && !showDivider && !!prevMsg && prevMsg.senderId === m.senderId && !m.replyTo &&
        new Date(m.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < GROUP_MS;
      return { m, newDay, showDivider, grouped };
    });
  }, [items, unreadFromSeq, me.id]);

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={ref} onScroll={onScroll} className="scroll-thin h-full overflow-y-auto bg-slate-50 dark:bg-[#18191a] px-3 py-3 sm:px-4 sm:py-4" data-message-list>
        {data?.loaded && !data.hasMore && (
          <div className="mb-6 mt-2 text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-sky-950/40 text-2xl">👋</div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Đây là khởi đầu của cuộc trò chuyện</p>
            {channel.description && <p className="text-xs text-slate-500 dark:text-slate-400">{channel.description}</p>}
          </div>
        )}
        {data?.loadingOlder && <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">Đang tải tin cũ hơn...</p>}
        {!data?.loaded && items.length === 0 && <p className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Đang tải tin nhắn...</p>}

        {rows.map(({ m, newDay, showDivider, grouped }) => (
          <Fragment key={m.clientId}>
            {newDay && (
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{fmtDay(m.createdAt)}</span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>
            )}
            {showDivider && (
              <div data-unread-divider className="my-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-rose-300 dark:bg-rose-900/60" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-500 dark:text-rose-400">Tin nhắn chưa đọc</span>
                <div className="h-px flex-1 bg-rose-300 dark:bg-rose-900/60" />
              </div>
            )}
            <TinNhanItem
              m={m}
              mine={m.senderId === me.id}
              grouped={grouped}
              online={!!state.online[m.senderId]}
              channel={channel}
              meId={me.id}
              isStaff={isStaff}
              mentioned={m.status === 'sent' && !m.deletedAt && mentionsMe(m, me.id)}
              memberCount={(channel.members || []).length}
              actions={actions}
            />
          </Fragment>
        ))}
        {data?.loadingNewer && <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">Đang tải tin mới hơn...</p>}
      </div>
      {data?.hasNewer && (
        <button
          onClick={() => { prev.current.count = 0; loadHistory(channel.id); }}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-indigo-600 dark:bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-indigo-700 dark:hover:bg-sky-500"
        >
          <ArrowDownIcon /> Về tin nhắn mới nhất
        </button>
      )}
    </div>
  );
}
