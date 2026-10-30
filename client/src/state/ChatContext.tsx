import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, ApiError, tokenStore, uploadFile } from '../lib/api';
import { cache, outbox } from '../lib/outbox';
import { uuid } from '../lib/uuid';
import { channelTitle } from '../lib/format';
import { playSound, shouldNotify, showBrowserNotification } from '../lib/notify';
import { parseCallLog, parseContactCard, type Attachment, type Channel, type FriendRequestItem, type FriendUser, type Message, type NotifyLevel, type OutboxFile, type OutboxItem, type ReadState, type User } from '../types';
import { initialState, mentionsMe, reducer, type ChatState } from './reducer';
import { useToast } from './toast';

export interface Draft {
  content: string;
  mentionIds?: string[];
  replyTo?: Message | null;
  /** Tệp đã tải lên trước (khi đang online) */
  attachments?: Attachment[];
  /** Tệp chưa tải lên (chọn lúc offline) */
  files?: File[];
}

interface ChatApi {
  state: ChatState;
  me: User;
  selectChannel: (id: string | null) => void;
  loadHistory: (channelId: string) => Promise<void>;
  loadOlder: (channelId: string) => Promise<void>;
  loadNewer: (channelId: string) => Promise<void>;
  jumpTo: (channelId: string, messageId: string) => Promise<void>;
  send: (channelId: string, draft: Draft) => Promise<void>;
  retry: (clientId: string) => Promise<void>;
  discard: (clientId: string, channelId: string) => Promise<void>;
  markRead: (channelId: string, messageId: string) => void;
  setTyping: (channelId: string, isTyping: boolean) => void;
  openDirect: (userId: string) => Promise<void>;
  loadPins: (channelId: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  togglePin: (messageId: string, pinned: boolean) => Promise<boolean>;
  ackMessage: (messageId: string) => Promise<boolean>;
  setNotifyLevel: (channelId: string, level: NotifyLevel) => Promise<void>;
  upsertChannel: (channel: Channel) => void;
  friends: FriendUser[];
  incomingRequests: FriendRequestItem[];
  outgoingRequests: FriendRequestItem[];
  loadFriends: () => Promise<void>;
  sendFriendRequest: (targetUserId: string) => Promise<boolean>;
  acceptFriendRequest: (requestId?: string, targetUserId?: string) => Promise<Channel | null>;
  declineFriendRequest: (requestId?: string, targetUserId?: string) => Promise<boolean>;
  removeFriend: (targetUserId: string) => Promise<boolean>;
  socket: Socket | null;
}

const Ctx = createContext<ChatApi | null>(null);

export function useChat() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useChat phải nằm trong ChatProvider');
  return c;
}

type AckRes<T = Record<string, unknown>> = ({ ok: true; error?: never; code?: never } & T) | { ok: false; error: string; code?: string };
type SendAck = AckRes<{ message: Message; duplicate: boolean }>;
const PERMANENT_ERRORS = new Set(['FORBIDDEN', 'BAD_REQUEST', 'NOT_FOUND', 'UNSUPPORTED_TYPE', 'FILE_TOO_LARGE']);

export function ChatProvider({ me, onUnauthorized, children }: { me: User; onUnauthorized: () => void; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const toast = useToast();
  const stateRef = useRef(state);
  stateRef.current = state;
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const maxSeqRef = useRef(0); // seq lớn nhất đã thấy -> dùng để tải bù
  const flushingRef = useRef(false);
  const readSentRef = useRef<Record<string, number>>({});
  const freshRef = useRef(false);

  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestItem[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestItem[]>([]);

  const loadFriends = useCallback(async () => {
    try {
      const res = await api<{ friends: FriendUser[]; incomingRequests: FriendRequestItem[]; outgoingRequests: FriendRequestItem[] }>('/api/friends');
      setFriends(res.friends);
      setIncomingRequests(res.incomingRequests);
      setOutgoingRequests(res.outgoingRequests);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  useEffect(() => {
    const update = (event: Event) => {
      const channel = (event as CustomEvent<Channel>).detail;
      if (channel?.id) dispatch({ type: 'CHANNEL_UPSERT', channel });
    };
    window.addEventListener('khoachat:channel-avatar-updated', update);
    return () => window.removeEventListener('khoachat:channel-avatar-updated', update);
  }, []);

  const trackSeq = (msgs: (Message | null | undefined)[]) => {
    for (const m of msgs) if (m && m.seq > maxSeqRef.current && m.seq < Number.MAX_SAFE_INTEGER) maxSeqRef.current = m.seq;
  };

  /** Gửi lần lượt các tin trong outbox: tải tệp còn thiếu lên trước, rồi mới gửi tin. */
  const flushOutbox = useCallback(async () => {
    const s = socketRef.current;
    if (flushingRef.current || !s?.connected) return;
    flushingRef.current = true;
    try {
      const items = await outbox.list(me.id);
      outer: for (let item of items) {
        if (item.status === 'failed') continue;
        if (!s.connected) break;
        // 1) tải tệp chọn lúc offline
        while (item.files?.length) {
          const f = item.files[0];
          try {
            const total = item.files.length;
            const { attachment } = await uploadFile<{ attachment: Attachment }>(
              `/api/channels/${item.channelId}/uploads`, f.blob, f.name,
              (p) => dispatch({ type: 'PENDING_PROGRESS', clientId: item.clientId, channelId: item.channelId, progress: Math.round(p / total) }),
            );
            item = { ...item, files: item.files.slice(1), attachments: [...(item.attachments ?? []), attachment] };
            await outbox.put(item);
            dispatch({ type: 'PENDING', item, me });
          } catch (e) {
            if (e instanceof ApiError && e.status > 0) {
              const error = `${f.name}: ${e.message}`;
              item = { ...item, status: 'failed', error };
              await outbox.put(item);
              dispatch({ type: 'PENDING_FAILED', clientId: item.clientId, channelId: item.channelId, error });
              continue outer;
            }
            break outer; // mất mạng -> thử lại sau
          }
        }
        // 2) gửi tin
        let ack: SendAck;
        try {
          ack = await s.timeout(8000).emitWithAck('message:send', {
            channelId: item.channelId,
            clientId: item.clientId,
            content: item.content,
            replyToId: item.replyToId ?? null,
            mentionIds: item.mentionIds ?? [],
            attachmentIds: (item.attachments ?? []).map((a) => a.id),
          });
        } catch {
          break; // hết thời gian chờ -> giữ trong outbox, thử lại khi kết nối lại
        }
        if (ack.ok) {
          await outbox.remove(item.clientId);
          trackSeq([ack.message]);
          dispatch({ type: 'MESSAGES', messages: [ack.message], me: me.id, countUnread: false });
        } else if (ack.code && PERMANENT_ERRORS.has(ack.code)) {
          await outbox.put({ ...item, status: 'failed', error: ack.error });
          dispatch({ type: 'PENDING_FAILED', clientId: item.clientId, channelId: item.channelId, error: ack.error });
        } else {
          break;
        }
      }
    } finally {
      flushingRef.current = false;
    }
  }, [me]);

  /** Tải bù tin nhắn bị lỡ trong lúc mất kết nối. */
  const syncMissed = useCallback(async () => {
    const res = await api<{ messages: Message[]; hasMore: boolean; channels: Channel[]; online: string[] }>(
      `/api/sync?after=${maxSeqRef.current}`,
    );
    const chs = res.channels || [];
    dispatch({ type: 'CHANNELS', channels: chs, online: res.online || [], resetMessages: res.hasMore });
    trackSeq(res.messages || []);
    trackSeq(chs.map((c) => c?.lastMessage));
    if (!res.hasMore) {
      dispatch({ type: 'MESSAGES', messages: res.messages || [], me: me.id, countUnread: false });
      const otherMsgs = (res.messages || []).filter((m) => m.senderId !== me.id);
      if (otherMsgs.length && socketRef.current?.connected) {
        const byChan = new Map<string, number>();
        for (const m of otherMsgs) {
          byChan.set(m.channelId, Math.max(byChan.get(m.channelId) || 0, m.seq));
        }
        for (const [cid, maxSeq] of byChan.entries()) {
          socketRef.current.emit('message:received', { channelId: cid, maxSeq });
        }
      }
    }
    readSentRef.current = {};
  }, [me.id]);

  const refreshChannel = useCallback(async (channelId: string) => {
    try {
      const { channel } = await api<{ channel: Channel }>(`/api/channels/${channelId}`);
      dispatch({ type: 'CHANNEL_UPSERT', channel });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) dispatch({ type: 'CHANNEL_REMOVE', channelId });
    }
  }, []);

  const jumpTo = useCallback(async (channelId: string, messageId: string) => {
    const cm = stateRef.current.messages[channelId];
    if (!cm?.items.some((m) => m.id === messageId)) {
      try {
        const res = await api<{ messages: Message[]; hasMore: boolean; hasNewer: boolean }>(
          `/api/channels/${channelId}/messages?around=${messageId}&limit=40`,
        );
        dispatch({ type: 'HISTORY', channelId, messages: res.messages, hasMore: res.hasMore, hasNewer: res.hasNewer, mode: 'around' });
      } catch (e) {
        toast.push({ kind: 'error', title: 'Không mở được tin nhắn', body: (e as Error).message });
        return;
      }
    }
    dispatch({ type: 'JUMP', channelId, messageId });
    localStorage.setItem('khoachat.lastChannel', channelId);
  }, [toast]);

  const notifiedIdsRef = useRef<Set<string>>(new Set());

  /** Thông báo khi có tin mới: toast trong app, hoặc thông báo hệ điều hành khi tab đang ẩn. */
  const notifyNew = useCallback(
    (m: Message) => {
      if (m.senderId === me.id || m.deletedAt) return;
      if (notifiedIdsRef.current.has(m.id)) return;
      notifiedIdsRef.current.add(m.id);
      if (notifiedIdsRef.current.size > 200) {
        const arr = Array.from(notifiedIdsRef.current);
        notifiedIdsRef.current = new Set(arr.slice(100));
      }

      const st = stateRef.current;
      const ch = st.channels[m.channelId];
      if (!ch) return;
      const mentioned = mentionsMe(m, me.id);
      if (!shouldNotify(ch.notifyLevel, ch.type, mentioned)) return;
      const visible = document.visibilityState === 'visible';
      if (visible && st.activeId === m.channelId && document.hasFocus()) return;

      const call = parseCallLog(m.content);
      // Nếu là cuộc gọi đã kết thúc hoặc từ chối, không hiện toast tin nhắn trùng lặp
      if (call) {
        if (call.status === 'ended' || call.status === 'declined') return;
      }
      const card = parseContactCard(m.content);

      const title = mentioned
        ? `${m.sender.name} đã nhắc đến bạn`
        : ch.type === 'DIRECT'
          ? m.sender.name
          : `${m.sender.name} · ${channelTitle(ch, me)}`;

      let body = m.content || '';
      let badge = ch.type === 'ANNOUNCEMENT' ? 'Thông báo' : ch.type === 'COMMUNITY' ? 'Cộng đồng' : mentioned ? '@ Nhắc tên' : ch.type === 'CLASS' ? ch.courseCode ?? undefined : undefined;

      if (call) {
        body = '📞 Cuộc gọi nhỡ';
        badge = 'Cuộc gọi nhỡ';
      } else if (card) {
        body = `📇 [Danh thiếp] ${card.name}`;
        badge = 'Danh thiếp';
      } else if (!body && m.attachments?.length) {
        body = m.attachments.every((a) => a.isImage) ? '[Ảnh]' : `[Tệp] ${m.attachments[0].filename}`;
      }

      playSound();
      if (!visible && showBrowserNotification(title, body, `channel-${ch.id}`, () => jumpTo(ch.id, m.id))) return;
      toast.push({
        kind: 'message',
        title,
        body,
        badge,
        avatar: { id: m.sender.id, name: m.sender.name, src: m.sender.avatar },
        onClick: () => jumpTo(ch.id, m.id),
      });
    },
    [me, toast, jumpTo],
  );
  const notifyRef = useRef(notifyNew);
  notifyRef.current = notifyNew;

  // Khởi tạo: tải kênh, nạp outbox, mở socket
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ channels: Channel[]; online: string[] }>('/api/channels');
        if (cancelled) return;
        freshRef.current = true;
        const channelList = res?.channels || [];
        trackSeq(channelList.map((c) => c?.lastMessage));
        dispatch({ type: 'CHANNELS', channels: channelList, online: res?.online || [] });
      } catch {
        // Mất mạng lúc mở app -> dùng dữ liệu đã lưu, sẽ tải bù khi socket kết nối lại
        const cached = await cache.loadChannels(me.id).catch(() => undefined);
        if (cancelled) return;
        if (cached && !stateRef.current.ready) {
          trackSeq(cached.map((c) => c.lastMessage));
          dispatch({ type: 'CHANNELS', channels: cached, online: [] });
        }
      }
      for (const item of await outbox.list(me.id)) dispatch({ type: 'PENDING', item, me });
      // Mở từ thông báo đẩy: /?channel=...&message=...
      const params = new URLSearchParams(location.search);
      const ch = params.get('channel');
      const msg = params.get('message');
      if (ch) {
        history.replaceState(null, '', location.pathname + location.hash);
        if (msg) jumpTo(ch, msg);
        else dispatch({ type: 'ACTIVE', channelId: ch });
      }
    })();

    const socketUrl = import.meta.env.VITE_SOCKET_URL || (location.port === '5173' ? `${location.protocol}//${location.hostname}:4001` : undefined);
    const s = io(socketUrl, { auth: { token: tokenStore.get() }, transports: ['websocket', 'polling'] });
    socketRef.current = s;
    setSocket(s);
    let firstConnect = true;

    s.on('connect', async () => {
      dispatch({ type: 'CONNECTION', value: 'online' });
      try {
        if (!firstConnect || !freshRef.current) await syncMissed();
        freshRef.current = true;
      } catch (e) {
        console.warn('Tải bù thất bại', e);
      }
      firstConnect = false;
      flushOutbox();
    });
    s.on('disconnect', () => dispatch({ type: 'CONNECTION', value: 'offline' }));
    s.on('connect_error', (err: Error & { data?: { code?: string } }) => {
      dispatch({ type: 'CONNECTION', value: 'offline' });
      if (err.data?.code === 'UNAUTHORIZED' || err.data?.code === 'LOCKED') onUnauthorized();
    });
    s.on('session:revoked', () => {
      toast.push({ kind: 'error', title: 'Tài khoản đã bị khoá', body: 'Vui lòng liên hệ quản trị viên.' });
      onUnauthorized();
    });
    s.on('message:new', (m: Message) => {
      trackSeq([m]);
      dispatch({ type: 'MESSAGES', messages: [m], me: me.id, countUnread: true });
      if (m.senderId !== me.id) {
        dispatch({ type: 'TYPING', channelId: m.channelId, userId: m.senderId, name: '', isTyping: false });
        s.emit('message:received', { channelId: m.channelId, maxSeq: m.seq });
      }
      notifyRef.current(m);
    });
    s.on('message:received', ({ channelId, userId, maxSeq }: { channelId: string; userId: string; maxSeq: number }) => {
      dispatch({ type: 'MESSAGE_RECEIVED', channelId, userId, maxSeq });
    });
    s.on('message:updated', (m: Message) => dispatch({ type: 'UPDATED', message: m }));
    s.on('channel:read', (st: ReadState) => dispatch({ type: 'READ', state: st }));
    s.on('channel:new', ({ channelId }: { channelId: string }) => refreshChannel(channelId));
    s.on('channel:changed', ({ channelId }: { channelId: string }) => refreshChannel(channelId));
    s.on('channel:upsert', ({ channel }: { channel: Channel }) => dispatch({ type: 'CHANNEL_UPSERT', channel }));
    s.on('user:updated', (user: User) => {
      localStorage.setItem('khoachat.user', JSON.stringify(user));
      dispatch({ type: 'USER_AVATAR', userId: user.id, avatar: user.avatar });
      window.dispatchEvent(new CustomEvent('khoachat:user-updated', { detail: user }));
    });
    s.on('user:avatar', ({ id, avatar }: { id: string; avatar: string | null }) => {
      dispatch({ type: 'USER_AVATAR', userId: id, avatar });
      if (id === me.id) {
        const updated = { ...me, avatar };
        localStorage.setItem('khoachat.user', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('khoachat:user-updated', { detail: updated }));
      }
    });
    s.on('channel:removed', ({ channelId }: { channelId: string }) => dispatch({ type: 'CHANNEL_REMOVE', channelId }));
    s.on('friends:updated', () => loadFriends());
    s.on('presence:init', ({ online }: { online: string[] }) => dispatch({ type: 'PRESENCE_INIT', online }));
    s.on('presence', (p: { userId: string; online: boolean; lastSeenAt?: string }) => dispatch({ type: 'PRESENCE', ...p }));
    s.on('typing', (t: { channelId: string; userId: string; name: string; isTyping: boolean }) => dispatch({ type: 'TYPING', ...t }));
    s.on('friend:request', (data: { requestId: string; user: FriendUser }) => {
      setIncomingRequests((prev) => {
        if (prev.some((r) => r.id === data.requestId)) return prev;
        return [{ id: data.requestId, createdAt: new Date().toISOString(), user: data.user }, ...prev];
      });
      toast.push({ kind: 'info', title: 'Lời mời kết bạn mới', body: `${data.user.name} đã gửi lời mời kết bạn.` });
    });
    s.on('friend:accepted', (data: { user: FriendUser; channelId?: string }) => {
      setOutgoingRequests((prev) => prev.filter((r) => r.user.id !== data.user.id));
      setFriends((prev) => {
        if (prev.some((f) => f.id === data.user.id)) return prev;
        return [data.user, ...prev];
      });
      if (data.channelId) refreshChannel(data.channelId);
      toast.push({ kind: 'success', title: 'Kết bạn thành công', body: `${data.user.name} và bạn đã là bạn bè.` });
    });
    s.on('friend:removed', ({ userId }: { userId: string }) => {
      setFriends((prev) => prev.filter((f) => f.id !== userId));
    });

    const goOnline = () => {
      if (!s.connected) s.connect();
    };
    // Trình duyệt báo mất mạng -> chuyển ngay sang chế độ offline (không chờ heartbeat ~45s của socket)
    const goOffline = () => {
      s.disconnect();
      dispatch({ type: 'CONNECTION', value: 'offline' });
    };
    // Bấm vào thông báo đẩy khi app đang mở -> service worker gửi message
    const onSw = (e: MessageEvent) => {
      if (e.data?.type === 'open-channel' && e.data.channelId) {
        if (e.data.messageId) jumpTo(e.data.channelId, e.data.messageId);
        else dispatch({ type: 'ACTIVE', channelId: e.data.channelId });
      }
    };
    navigator.serviceWorker?.addEventListener('message', onSw);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const timer = setInterval(() => dispatch({ type: 'TYPING_EXPIRE' }), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      navigator.serviceWorker?.removeEventListener('message', onSw);
      s.removeAllListeners();
      s.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id]);

  // Số tin chưa đọc trên tiêu đề tab
  useEffect(() => {
    const total = Object.values(state.channels).reduce(
      (n, c) => n + (c.notifyLevel === 'NONE' && !c.mentionCount ? 0 : c.unreadCount),
      0,
    );
    document.title = total ? `(${total > 99 ? '99+' : total}) KhoaChat` : 'KhoaChat - Nhắn tin nội bộ Khoa';
  }, [state.channels]);

  const loadHistory = useCallback(
    async (channelId: string) => {
      try {
        const res = await api<{ messages: Message[]; hasMore: boolean }>(`/api/channels/${channelId}/messages?limit=30`);
        trackSeq(res.messages);
        dispatch({ type: 'HISTORY', channelId, messages: res.messages, hasMore: res.hasMore, mode: 'initial' });
        const otherMsgs = res.messages.filter((m) => m.senderId !== me.id);
        if (otherMsgs.length && socketRef.current?.connected) {
          const maxSeq = Math.max(...otherMsgs.map((m) => m.seq));
          socketRef.current.emit('message:received', { channelId, maxSeq });
        }
      } catch (e) {
        const cached = await cache.loadMessages(me.id, channelId).catch(() => undefined);
        if (cached?.length) {
          dispatch({ type: 'HISTORY', channelId, messages: cached, hasMore: false, mode: 'cached' });
          return;
        }
        throw e;
      }
    },
    [me.id],
  );

  // Lưu bản sao offline (kênh + 50 tin gần nhất của các kênh đã mở). Throttle: tối đa 1 lần / 700ms.
  const lastSaveRef = useRef(0);
  useEffect(() => {
    if (!state.ready) return;
    const save = () => {
      lastSaveRef.current = Date.now();
      const st = stateRef.current;
      cache.saveChannels(me.id, Object.values(st.channels)).catch(() => {});
      for (const [cid, cm] of Object.entries(st.messages)) {
        if (!cm.loaded || cm.hasNewer) continue;
        const sent = cm.items.filter((m) => m.status === 'sent').slice(-50);
        cache.saveMessages(me.id, cid, sent).catch(() => {});
      }
    };
    const wait = Math.max(0, 700 - (Date.now() - lastSaveRef.current));
    const t = window.setTimeout(save, wait);
    return () => window.clearTimeout(t);
  }, [state.ready, state.channels, state.messages, me.id]);

  const loadOlder = useCallback(async (channelId: string) => {
    const cm = stateRef.current.messages[channelId];
    if (!cm || !cm.hasMore || cm.loadingOlder) return;
    const first = cm.items.find((m) => m.status === 'sent');
    if (!first) return;
    dispatch({ type: 'LOADING', channelId, key: 'loadingOlder', value: true });
    try {
      const res = await api<{ messages: Message[]; hasMore: boolean }>(`/api/channels/${channelId}/messages?limit=30&before=${first.seq}`);
      dispatch({ type: 'HISTORY', channelId, messages: res.messages, hasMore: res.hasMore, mode: 'older' });
    } catch {
      dispatch({ type: 'LOADING', channelId, key: 'loadingOlder', value: false });
    }
  }, []);

  const loadNewer = useCallback(async (channelId: string) => {
    const cm = stateRef.current.messages[channelId];
    if (!cm || !cm.hasNewer || cm.loadingNewer) return;
    const sent = cm.items.filter((m) => m.status === 'sent');
    const last = sent[sent.length - 1];
    if (!last) return;
    dispatch({ type: 'LOADING', channelId, key: 'loadingNewer', value: true });
    try {
      const res = await api<{ messages: Message[]; hasNewer: boolean }>(`/api/channels/${channelId}/messages?limit=50&after=${last.seq}`);
      trackSeq(res.messages);
      dispatch({ type: 'HISTORY', channelId, messages: res.messages, hasMore: true, hasNewer: res.hasNewer, mode: 'newer' });
    } catch {
      dispatch({ type: 'LOADING', channelId, key: 'loadingNewer', value: false });
    }
  }, []);

  const send = useCallback(
    async (channelId: string, draft: Draft) => {
      const files: OutboxFile[] = (draft.files ?? []).map((f) => ({ localId: uuid(), name: f.name, type: f.type, size: f.size, blob: f }));
      const item: OutboxItem = {
        clientId: uuid(),
        userId: me.id,
        channelId,
        content: draft.content,
        createdAt: new Date().toISOString(),
        status: 'pending',
        replyToId: draft.replyTo?.id ?? null,
        replyTo: draft.replyTo
          ? {
              id: draft.replyTo.id,
              senderId: draft.replyTo.senderId,
              senderName: draft.replyTo.sender.name,
              content: draft.replyTo.content.slice(0, 200),
              deleted: false,
              attachmentCount: draft.replyTo.attachments.length,
            }
          : null,
        mentionIds: draft.mentionIds ?? [],
        attachments: draft.attachments ?? [],
        files,
      };
      dispatch({ type: 'PENDING', item, me });
      await outbox.put(item); // lưu trước khi gửi -> không mất tin nếu rớt mạng / đóng tab
      flushOutbox();
    },
    [me, flushOutbox],
  );

  const retry = useCallback(
    async (clientId: string) => {
      const item = (await outbox.list(me.id)).find((x) => x.clientId === clientId);
      if (!item) return;
      const next = { ...item, status: 'pending' as const, error: undefined };
      await outbox.put(next);
      dispatch({ type: 'PENDING', item: next, me });
      flushOutbox();
    },
    [me, flushOutbox],
  );

  const discard = useCallback(async (clientId: string, channelId: string) => {
    await outbox.remove(clientId);
    dispatch({ type: 'PENDING_REMOVE', clientId, channelId });
  }, []);

  const markRead = useCallback((channelId: string, messageId: string) => {
    const s = socketRef.current;
    const ch = stateRef.current.channels[channelId];
    const msg = stateRef.current.messages[channelId]?.items.find((m) => m.id === messageId);
    if (!s?.connected || !ch || !msg) return;
    if (msg.seq <= ch.lastReadSeq && ch.unreadCount === 0) return;
    if ((readSentRef.current[channelId] ?? 0) >= msg.seq) return;
    readSentRef.current[channelId] = msg.seq;
    s.timeout(5000)
      .emitWithAck('channel:read', { channelId, messageId })
      .then((ack: { ok: boolean } & ReadState) => {
        if (ack.ok) dispatch({ type: 'READ', state: ack });
      })
      .catch(() => {
        readSentRef.current[channelId] = 0;
      });
  }, []);

  const setTyping = useCallback((channelId: string, isTyping: boolean) => {
    socketRef.current?.volatile.emit('typing', { channelId, isTyping });
  }, []);

  const selectChannel = useCallback((id: string | null) => {
    dispatch({ type: 'ACTIVE', channelId: id });
    if (id) localStorage.setItem('khoachat.lastChannel', id);
    else localStorage.removeItem('khoachat.lastChannel');
  }, []);

  const openDirect = useCallback(
    async (userId: string) => {
      const { channel } = await api<{ channel: Channel }>('/api/direct', { method: 'POST', json: { userId } });
      dispatch({ type: 'CHANNEL_UPSERT', channel });
      selectChannel(channel.id);
    },
    [selectChannel],
  );

  const loadPins = useCallback(async (channelId: string) => {
    try {
      const { messages } = await api<{ messages: Message[] }>(`/api/channels/${channelId}/pins`);
      dispatch({ type: 'PINS', channelId, messages });
    } catch {
      /* offline */
    }
  }, []);

  /** Gọi sự kiện socket có ack; báo lỗi bằng toast. */
  const emitAction = useCallback(
    async (event: string, payload: unknown): Promise<boolean> => {
      const s = socketRef.current;
      if (!s?.connected) {
        toast.push({ kind: 'error', title: 'Đang mất kết nối', body: 'Vui lòng thử lại khi có mạng.' });
        return false;
      }
      try {
        const ack: AckRes<{ message: Message }> = await s.timeout(8000).emitWithAck(event, payload);
        if (!ack.ok) {
          toast.push({ kind: 'error', title: 'Không thực hiện được', body: ack.error });
          return false;
        }
        dispatch({ type: 'UPDATED', message: ack.message });
        return true;
      } catch {
        toast.push({ kind: 'error', title: 'Máy chủ không phản hồi' });
        return false;
      }
    },
    [toast],
  );

  const editMessage = useCallback(
    (messageId: string, content: string) => emitAction('message:edit', { messageId, content }),
    [emitAction],
  );
  const deleteMessage = useCallback((messageId: string) => emitAction('message:delete', { messageId }), [emitAction]);
  const togglePin = useCallback(
    (messageId: string, pinned: boolean) => emitAction('message:pin', { messageId, pinned }),
    [emitAction],
  );
  const ackMessage = useCallback((messageId: string) => emitAction('message:ack', { messageId }), [emitAction]);

  const setNotifyLevel = useCallback(
    async (channelId: string, notifyLevel: NotifyLevel) => {
      try {
        const { channel } = await api<{ channel: Channel }>(`/api/channels/${channelId}/settings`, {
          method: 'PATCH',
          json: { notifyLevel },
        });
        dispatch({ type: 'CHANNEL_UPSERT', channel });
      } catch (e) {
        toast.push({ kind: 'error', title: 'Không lưu được cài đặt', body: (e as Error).message });
      }
    },
    [toast],
  );

  const sendFriendRequest = useCallback(
    async (targetUserId: string): Promise<boolean> => {
      try {
        const res = await api<{ ok: boolean; status: string; requestId?: string; channelId?: string }>('/api/friends/request', {
          method: 'POST',
          json: { targetUserId },
        });
        if (res.status === 'friend' && res.channelId) {
          refreshChannel(res.channelId);
          toast.push({ kind: 'success', title: 'Đã trở thành bạn bè!' });
        } else {
          toast.push({ kind: 'success', title: 'Đã gửi lời mời kết bạn' });
        }
        loadFriends();
        return true;
      } catch (e) {
        toast.push({ kind: 'error', title: 'Không gửi được lời mời', body: (e as Error).message });
        return false;
      }
    },
    [loadFriends, refreshChannel, toast],
  );

  const acceptFriendRequest = useCallback(
    async (requestId?: string, targetUserId?: string): Promise<Channel | null> => {
      try {
        const { channel } = await api<{ ok: boolean; channel: Channel }>('/api/friends/accept', {
          method: 'POST',
          json: { requestId, targetUserId },
        });
        dispatch({ type: 'CHANNEL_UPSERT', channel });
        toast.push({ kind: 'success', title: 'Đã chấp nhận kết bạn' });
        loadFriends();
        return channel;
      } catch (e) {
        toast.push({ kind: 'error', title: 'Chấp nhận thất bại', body: (e as Error).message });
        return null;
      }
    },
    [loadFriends, toast],
  );

  const declineFriendRequest = useCallback(
    async (requestId?: string, targetUserId?: string): Promise<boolean> => {
      try {
        await api('/api/friends/decline', {
          method: 'POST',
          json: { requestId, targetUserId },
        });
        loadFriends();
        return true;
      } catch (e) {
        toast.push({ kind: 'error', title: 'Thao tác thất bại', body: (e as Error).message });
        return false;
      }
    },
    [loadFriends, toast],
  );

  const removeFriend = useCallback(
    async (targetUserId: string): Promise<boolean> => {
      try {
        await api(`/api/friends/${targetUserId}`, { method: 'DELETE' });
        toast.push({ kind: 'info', title: 'Đã huỷ kết bạn' });
        setFriends((prev) => prev.filter((f) => f.id !== targetUserId));
        return true;
      } catch (e) {
        toast.push({ kind: 'error', title: 'Huỷ kết bạn thất bại', body: (e as Error).message });
        return false;
      }
    },
    [toast],
  );

  const upsertChannel = useCallback((channel: Channel) => {
    dispatch({ type: 'CHANNEL_UPSERT', channel });
  }, []);

  const value = useMemo<ChatApi>(
    () => ({
      state, me, selectChannel, loadHistory, loadOlder, loadNewer, jumpTo, send, retry, discard, markRead, setTyping,
      openDirect, loadPins, editMessage, deleteMessage, togglePin, ackMessage, setNotifyLevel, upsertChannel,
      friends, incomingRequests, outgoingRequests, loadFriends, sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend,
      socket,
    }),
    [state, me, selectChannel, loadHistory, loadOlder, loadNewer, jumpTo, send, retry, discard, markRead, setTyping,
      openDirect, loadPins, editMessage, deleteMessage, togglePin, ackMessage, setNotifyLevel, upsertChannel,
      friends, incomingRequests, outgoingRequests, loadFriends, sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend,
      socket],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
