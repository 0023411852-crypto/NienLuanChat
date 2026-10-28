import type { Attachment, Channel, Message, OutboxItem, ReadState, UiMessage, User } from '../types';

export interface ChannelMessages {
  items: UiMessage[];
  hasMore: boolean; // còn tin cũ hơn
  hasNewer: boolean; // đang xem đoạn giữa (sau khi nhảy tới tin) -> còn tin mới hơn chưa tải
  loaded: boolean;
  loadingOlder: boolean;
  loadingNewer: boolean;
}

export type Connection = 'connecting' | 'online' | 'offline';

export interface ChatState {
  channels: Record<string, Channel>;
  messages: Record<string, ChannelMessages>;
  pins: Record<string, Message[] | undefined>;
  online: Record<string, true>;
  typing: Record<string, Record<string, { name: string; at: number }>>;
  activeId: string | null;
  /** Tin cần cuộn tới & nháy sáng (nonce để nhảy lại cùng 1 tin) */
  jump: { channelId: string; messageId: string; nonce: number } | null;
  connection: Connection;
  ready: boolean;
}

export const initialState: ChatState = {
  channels: {},
  messages: {},
  pins: {},
  online: {},
  typing: {},
  activeId: null,
  jump: null,
  connection: 'connecting',
  ready: false,
};

export type HistoryMode = 'initial' | 'older' | 'newer' | 'cached' | 'around';

export type Action =
  | { type: 'CHANNELS'; channels: Channel[]; online?: string[]; resetMessages?: boolean }
  | { type: 'CHANNEL_UPSERT'; channel: Channel }
  | { type: 'CHANNEL_REMOVE'; channelId: string }
  | { type: 'HISTORY'; channelId: string; messages: Message[]; hasMore: boolean; hasNewer?: boolean; mode: HistoryMode }
  | { type: 'LOADING'; channelId: string; key: 'loadingOlder' | 'loadingNewer'; value: boolean }
  | { type: 'MESSAGES'; messages: Message[]; me: string; countUnread: boolean }
  | { type: 'UPDATED'; message: Message }
  | { type: 'PINS'; channelId: string; messages: Message[] }
  | { type: 'PENDING'; item: OutboxItem; me: User }
  | { type: 'PENDING_PROGRESS'; clientId: string; channelId: string; progress: number }
  | { type: 'PENDING_FAILED'; clientId: string; channelId: string; error: string }
  | { type: 'PENDING_REMOVE'; clientId: string; channelId: string }
  | { type: 'READ'; state: ReadState }
  | { type: 'MESSAGE_RECEIVED'; channelId: string; userId: string; maxSeq: number }
  | { type: 'PRESENCE_INIT'; online: string[] }
  | { type: 'PRESENCE'; userId: string; online: boolean; lastSeenAt?: string }
  | { type: 'TYPING'; channelId: string; userId: string; name: string; isTyping: boolean }
  | { type: 'TYPING_EXPIRE' }
  | { type: 'ACTIVE'; channelId: string | null }
  | { type: 'JUMP'; channelId: string; messageId: string }
  | { type: 'USER_AVATAR'; userId: string; avatar: string | null }
  | { type: 'CONNECTION'; value: Connection };

export const PENDING_SEQ = Number.MAX_SAFE_INTEGER;
const emptyCm = (): ChannelMessages => ({
  items: [], hasMore: true, hasNewer: false, loaded: false, loadingOlder: false, loadingNewer: false,
});

function sortItems(items: UiMessage[]) {
  return items.sort((a, b) => a.seq - b.seq || a.createdAt.localeCompare(b.createdAt));
}

/** Thêm/cập nhật tin vào danh sách, khử trùng theo id và clientId (thay thế tin "đang chờ"). */
function mergeInto(items: UiMessage[], incoming: UiMessage[]): UiMessage[] {
  const out = [...items];
  for (const m of incoming) {
    const i = out.findIndex((x) => x.id === m.id || x.clientId === m.clientId);
    if (i >= 0) out[i] = m;
    else out.push(m);
  }
  return sortItems(out);
}

const asSent = (m: Message): UiMessage => ({ ...m, status: 'sent' });
export const mentionsMe = (m: Message, me: string) => m.senderId !== me && (m.mentionAll || m.mentions.some((x) => x.id === me));

function pendingToUi(item: OutboxItem, me: User, progress?: number): UiMessage {
  const localAtts: Attachment[] = (item.files ?? []).map((f) => ({
    id: f.localId,
    filename: f.name,
    mime: f.type,
    size: f.size,
    isImage: f.type.startsWith('image/'),
    url: '',
    localUrl: f.type.startsWith('image/') ? URL.createObjectURL(f.blob) : undefined,
    messageId: null,
    channelId: item.channelId,
    uploaderId: me.id,
    createdAt: item.createdAt,
  }));
  return {
    id: item.clientId,
    clientId: item.clientId,
    seq: PENDING_SEQ,
    channelId: item.channelId,
    senderId: me.id,
    sender: { id: me.id, name: me.name, avatar: me.avatar, role: me.role },
    type: 'TEXT',
    content: item.content,
    replyToId: item.replyToId ?? null,
    replyTo: item.replyTo ?? null,
    pinned: false,
    pinnedAt: null,
    pinnedById: null,
    createdAt: item.createdAt,
    editedAt: null,
    deletedAt: null,
    attachments: [...(item.attachments ?? []), ...localAtts],
    mentions: [],
    mentionAll: false,
    ackUserIds: [],
    status: item.status,
    error: item.error,
    progress,
  };
}

export function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case 'CHANNELS': {
      const channels: Record<string, Channel> = {};
      const channelList = action.channels || [];
      for (const c of channelList) {
        c.members = c.members || [];
        channels[c.id] = c;
      }
      const online = action.online ? Object.fromEntries(action.online.map((id) => [id, true] as const)) : state.online;
      let messages = state.messages;
      if (action.resetMessages) {
        // Giữ lại tin đang chờ gửi, bỏ lịch sử để tải lại (tránh "lỗ hổng" sau khi offline lâu)
        messages = {};
        for (const [cid, cm] of Object.entries(state.messages)) {
          const pending = cm.items.filter((m) => m.status !== 'sent');
          if (pending.length) messages[cid] = { ...emptyCm(), items: pending };
        }
      }
      const activeId = state.activeId && !channels[state.activeId] && state.ready ? null : state.activeId;
      return { ...state, channels, online, messages, activeId, ready: true };
    }
    case 'CHANNEL_UPSERT': {
      const c = { ...action.channel, members: action.channel.members || [] };
      return { ...state, channels: { ...state.channels, [c.id]: c } };
    }
    case 'CHANNEL_REMOVE': {
      const channels = { ...state.channels };
      delete channels[action.channelId];
      return { ...state, channels, activeId: state.activeId === action.channelId ? null : state.activeId };
    }
    case 'HISTORY': {
      const cur = state.messages[action.channelId];
      if (action.mode === 'cached' && cur?.loaded) return state;
      const incoming = action.messages.map(asSent);
      const keepPending = (cur?.items ?? []).filter((m) => m.status !== 'sent');
      let next: ChannelMessages;
      switch (action.mode) {
        case 'older':
          next = { ...(cur ?? emptyCm()), items: mergeInto(cur?.items ?? [], incoming), hasMore: action.hasMore, loadingOlder: false };
          break;
        case 'newer': {
          const hasNewer = !!action.hasNewer;
          next = { ...(cur ?? emptyCm()), items: mergeInto(cur?.items ?? [], incoming), hasNewer, loadingNewer: false };
          break;
        }
        case 'around':
          next = { ...emptyCm(), items: mergeInto(action.hasNewer ? [] : keepPending, incoming), hasMore: action.hasMore, hasNewer: !!action.hasNewer, loaded: true };
          break;
        case 'cached':
          next = { ...emptyCm(), items: mergeInto(keepPending, incoming), hasMore: false };
          break;
        default:
          next = { ...emptyCm(), items: mergeInto(keepPending, incoming), hasMore: action.hasMore, loaded: true };
      }
      return { ...state, messages: { ...state.messages, [action.channelId]: next } };
    }
    case 'LOADING': {
      const cur = state.messages[action.channelId];
      if (!cur) return state;
      return { ...state, messages: { ...state.messages, [action.channelId]: { ...cur, [action.key]: action.value } } };
    }
    case 'MESSAGES': {
      let channels = state.channels;
      let messages = state.messages;
      for (const m of action.messages) {
        const ch = channels[m.channelId];
        if (!ch) continue;
        const isNewer = m.seq > (ch.lastMessage?.seq ?? 0);
        const fromOther = m.senderId !== action.me;
        const counts = action.countUnread && isNewer && fromOther && m.seq > ch.lastReadSeq && !m.deletedAt;
        channels = {
          ...channels,
          [m.channelId]: {
            ...ch,
            lastMessage: isNewer ? m : ch.lastMessage,
            unreadCount: ch.unreadCount + (counts ? 1 : 0),
            mentionCount: ch.mentionCount + (counts && mentionsMe(m, action.me) ? 1 : 0),
            // tin của chính mình -> server coi như đã đọc
            ...(isNewer && !fromOther ? { lastReadSeq: m.seq, lastReadMessageId: m.id, unreadCount: 0, mentionCount: 0 } : {}),
          },
        };
        const cm = messages[m.channelId];
        const ownPending = cm?.items.some((x) => x.clientId === m.clientId);
        // Chỉ chèn vào danh sách đã tải và đang ở "cuối" hội thoại; kênh chưa mở sẽ tải khi mở
        if ((cm?.loaded && !cm.hasNewer) || ownPending) {
          messages = { ...messages, [m.channelId]: { ...(cm ?? emptyCm()), items: mergeInto(cm?.items ?? [], [asSent(m)]) } };
        }
      }
      return { ...state, channels, messages };
    }
    case 'UPDATED': {
      const m = action.message;
      const cm = state.messages[m.channelId];
      const ch = state.channels[m.channelId];
      let messages = state.messages;
      if (cm) {
        const items = cm.items.map((x) => {
          if (x.id === m.id) return { ...asSent(m) };
          // cập nhật trích dẫn của các tin trả lời
          if (x.replyTo?.id === m.id) {
            return { ...x, replyTo: { ...x.replyTo, content: m.deletedAt ? '' : m.content.slice(0, 200), deleted: !!m.deletedAt } };
          }
          return x;
        });
        messages = { ...messages, [m.channelId]: { ...cm, items } };
      }
      let pins = state.pins;
      const list = state.pins[m.channelId];
      const wasPinned = list?.some((p) => p.id === m.id) ?? cm?.items.find((x) => x.id === m.id)?.pinned ?? false;
      if (list) {
        const rest = list.filter((p) => p.id !== m.id);
        pins = { ...pins, [m.channelId]: m.pinned && !m.deletedAt ? [m, ...rest] : rest };
      }
      let channels = state.channels;
      if (ch) {
        const pinnedCount = list ? pins[m.channelId]!.length : Math.max(0, ch.pinnedCount + (m.pinned && !wasPinned ? 1 : !m.pinned && wasPinned ? -1 : 0));
        channels = {
          ...channels,
          [ch.id]: { ...ch, pinnedCount, lastMessage: ch.lastMessage?.id === m.id ? m : ch.lastMessage },
        };
      }
      return { ...state, messages, pins, channels };
    }
    case 'PINS': {
      const ch = state.channels[action.channelId];
      return {
        ...state,
        pins: { ...state.pins, [action.channelId]: action.messages },
        channels: ch ? { ...state.channels, [ch.id]: { ...ch, pinnedCount: action.messages.length } } : state.channels,
      };
    }
    case 'PENDING': {
      const { item, me } = action;
      const cm = state.messages[item.channelId] ?? emptyCm();
      if (cm.items.some((x) => x.clientId === item.clientId && x.status === 'sent')) return state;
      const prev = cm.items.find((x) => x.clientId === item.clientId);
      prev?.attachments.forEach((a) => a.localUrl && URL.revokeObjectURL(a.localUrl));
      const ui = pendingToUi(item, me, prev?.progress);
      return { ...state, messages: { ...state.messages, [item.channelId]: { ...cm, items: mergeInto(cm.items, [ui]) } } };
    }
    case 'PENDING_PROGRESS':
    case 'PENDING_FAILED':
    case 'PENDING_REMOVE': {
      const cm = state.messages[action.channelId];
      if (!cm) return state;
      const isTarget = (m: UiMessage) => m.clientId === action.clientId && m.status !== 'sent';
      let items: UiMessage[];
      if (action.type === 'PENDING_REMOVE') {
        cm.items.filter(isTarget).forEach((m) => m.attachments.forEach((a) => a.localUrl && URL.revokeObjectURL(a.localUrl)));
        items = cm.items.filter((m) => !isTarget(m));
      } else if (action.type === 'PENDING_FAILED') {
        items = cm.items.map((m) => (isTarget(m) ? { ...m, status: 'failed' as const, error: action.error, progress: undefined } : m));
      } else {
        items = cm.items.map((m) => (isTarget(m) ? { ...m, progress: action.progress } : m));
      }
      return { ...state, messages: { ...state.messages, [action.channelId]: { ...cm, items } } };
    }
    case 'MESSAGE_RECEIVED': {
      const cm = state.messages[action.channelId];
      if (!cm) return state;
      let changed = false;
      const items = cm.items.map((m) => {
        if (m.seq <= action.maxSeq && (!m.ackUserIds || !m.ackUserIds.includes(action.userId))) {
          changed = true;
          return {
            ...m,
            ackUserIds: Array.from(new Set([...(m.ackUserIds || []), action.userId])),
          };
        }
        return m;
      });
      if (!changed) return state;
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.channelId]: { ...cm, items },
        },
      };
    }
    case 'READ': {
      const ch = state.channels[action.state.channelId];
      let messages = state.messages;
      const cm = messages[action.state.channelId];
      if (cm && action.state.userId) {
        let changed = false;
        const items = cm.items.map((m) => {
          if (m.seq <= action.state.lastReadSeq && (!m.ackUserIds || !m.ackUserIds.includes(action.state.userId!))) {
            changed = true;
            return {
              ...m,
              ackUserIds: Array.from(new Set([...(m.ackUserIds || []), action.state.userId!])),
            };
          }
          return m;
        });
        if (changed) {
          messages = { ...messages, [action.state.channelId]: { ...cm, items } };
        }
      }

      if (!ch || action.state.lastReadSeq < ch.lastReadSeq) return { ...state, messages };
      return {
        ...state,
        messages,
        channels: {
          ...state.channels,
          [ch.id]: {
            ...ch,
            lastReadSeq: action.state.lastReadSeq,
            lastReadMessageId: action.state.lastReadMessageId,
            lastReadAt: action.state.lastReadAt,
            unreadCount: action.state.unreadCount,
            mentionCount: action.state.mentionCount ?? 0,
          },
        },
      };
    }
    case 'PRESENCE_INIT':
      return { ...state, online: Object.fromEntries(action.online.map((id) => [id, true] as const)) };
    case 'PRESENCE': {
      const online = { ...state.online };
      if (action.online) online[action.userId] = true;
      else delete online[action.userId];
      let channels = state.channels;
      if (!action.online && action.lastSeenAt) {
        channels = Object.fromEntries(
          Object.entries(channels).map(([id, c]) => [
            id,
            (c.members || []).some((m) => m.id === action.userId)
              ? { ...c, members: (c.members || []).map((m) => (m.id === action.userId ? { ...m, lastSeenAt: action.lastSeenAt! } : m)) }
              : c,
          ]),
        );
      }
      return { ...state, online, channels };
    }
    case 'TYPING': {
      const cur = { ...(state.typing[action.channelId] ?? {}) };
      if (action.isTyping) cur[action.userId] = { name: action.name, at: Date.now() };
      else if (cur[action.userId]) delete cur[action.userId];
      else return state;
      return { ...state, typing: { ...state.typing, [action.channelId]: cur } };
    }
    case 'TYPING_EXPIRE': {
      const now = Date.now();
      let changed = false;
      const typing: ChatState['typing'] = {};
      for (const [cid, users] of Object.entries(state.typing)) {
        typing[cid] = {};
        for (const [uid, t] of Object.entries(users)) {
          if (now - t.at < 6000) typing[cid][uid] = t;
          else changed = true;
        }
      }
      return changed ? { ...state, typing } : state;
    }
    case 'ACTIVE':
      return { ...state, activeId: action.channelId };
    case 'JUMP':
      return { ...state, activeId: action.channelId, jump: { channelId: action.channelId, messageId: action.messageId, nonce: Date.now() } };
    case 'USER_AVATAR': {
      const channels = Object.fromEntries(Object.entries(state.channels).map(([id, channel]) => [id, {
        ...channel,
        members: (channel.members || []).map((member) => member.id === action.userId ? { ...member, avatar: action.avatar } : member),
        lastMessage: channel.lastMessage?.senderId === action.userId
          ? { ...channel.lastMessage, sender: { ...channel.lastMessage.sender, avatar: action.avatar } }
          : channel.lastMessage,
      }]));
      const messages = Object.fromEntries(Object.entries(state.messages).map(([id, cm]) => [id, {
        ...cm,
        items: cm.items.map((message) => message.senderId === action.userId
          ? { ...message, sender: { ...message.sender, avatar: action.avatar } }
          : message),
      }]));
      const pins = Object.fromEntries(Object.entries(state.pins).map(([id, list]) => [id, list?.map((message) => message.senderId === action.userId
        ? { ...message, sender: { ...message.sender, avatar: action.avatar } }
        : message)]));
      return { ...state, channels, messages, pins };
    }
    case 'CONNECTION':
      return state.connection === action.value ? state : { ...state, connection: action.value };
  }
}
