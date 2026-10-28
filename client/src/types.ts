export type Role = 'STUDENT' | 'LECTURER' | 'ADMIN';
export type ChannelType = 'CLASS' | 'ANNOUNCEMENT' | 'DIRECT' | 'COMMUNITY';
export type NotifyLevel = 'DEFAULT' | 'ALL' | 'MENTIONS' | 'NONE';
export type MemberRole = 'OWNER' | 'MODERATOR' | 'MEMBER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatar: string | null;
  studentCode?: string | null;
}

export interface Member {
  id: string;
  name: string;
  avatar: string | null;
  role: Role;
  memberRole: MemberRole;
  lastSeenAt: string | null;
}

export interface Attachment {
  id: string;
  filename: string;
  mime: string;
  size: number;
  isImage: boolean;
  url: string;
  messageId: string | null;
  channelId: string;
  uploaderId: string;
  createdAt: string;
  /** Ảnh xem trước cục bộ (blob:) khi tin còn đang chờ gửi */
  localUrl?: string;
}

export interface Message {
  id: string;
  seq: number;
  clientId: string;
  channelId: string;
  senderId: string;
  sender: { id: string; name: string; avatar: string | null; role: Role };
  type: 'TEXT' | 'FILE' | 'IMAGE' | 'SYSTEM';
  content: string;
  replyToId: string | null;
  replyTo: {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    deleted: boolean;
    attachmentCount: number;
  } | null;
  pinned: boolean;
  pinnedAt: string | null;
  pinnedById: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  attachments: Attachment[];
  mentions: { id: string; name: string }[];
  mentionAll: boolean;
  ackUserIds: string[];
}

/** Tin trên giao diện: có thêm trạng thái gửi */
export type SendStatus = 'sent' | 'pending' | 'failed';
export interface UiMessage extends Message {
  status: SendStatus;
  error?: string;
  /** % tải tệp lên của tin đang chờ */
  progress?: number;
}

export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  description: string | null;
  courseCode: string | null;
  // Add avatar field
  avatar: string | null;
  archived: boolean;
  myRole: MemberRole;
  canPost: boolean;
  canPin: boolean;
  canModerate: boolean;
  canMentionAll: boolean;
  canManage: boolean;
  isMuted?: boolean;
  isChannelLocked?: boolean;
  notifyLevel: NotifyLevel;
  lastReadMessageId: string | null;
  lastReadSeq: number;
  lastReadAt: string | null;
  unreadCount: number;
  mentionCount: number;
  pinnedCount: number;
  lastMessage: Message | null;
  members: Member[];
}

export interface ReadState {
  channelId: string;
  userId: string;
  lastReadMessageId: string | null;
  lastReadSeq: number;
  lastReadAt: string | null;
  unreadCount: number;
  mentionCount: number;
}

export interface OutboxFile {
  localId: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
}

export interface OutboxItem {
  clientId: string;
  userId: string;
  channelId: string;
  content: string;
  createdAt: string;
  status: 'pending' | 'failed';
  error?: string;
  replyToId?: string | null;
  replyTo?: Message['replyTo'];
  mentionIds?: string[];
  /** Tệp đã tải lên server (chỉ còn chờ gửi tin) */
  attachments?: Attachment[];
  /** Tệp chọn lúc offline - sẽ tải lên khi có mạng rồi mới gửi tin */
  files?: OutboxFile[];
}

export interface SearchResult extends Message {
  channel: { id: string; name: string; type: ChannelType; courseCode: string | null };
}

export type FriendStatus = 'none' | 'friend' | 'pending_sent' | 'pending_received';

export interface FriendUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: Role;
  studentCode?: string | null;
  friendSince?: string;
  directKey?: string;
}

export interface FriendRequestItem {
  id: string;
  createdAt: string;
  user: FriendUser;
}

export interface SearchUserResult extends User {
  friendStatus: FriendStatus;
  requestId?: string;
}

export interface ContactCardData {
  userId: string;
  name: string;
  email: string;
  role: Role;
  studentCode?: string | null;
  avatar?: string | null;
}

export function parseContactCard(content?: string | null): ContactCardData | null {
  if (!content || !content.startsWith('__contact__:')) return null;
  try {
    const raw = JSON.parse(content.slice('__contact__:'.length));
    if (raw && typeof raw === 'object' && raw.userId && raw.name) {
      return raw as ContactCardData;
    }
  } catch {
    return null;
  }
  return null;
}

export interface CallLogData {
  type: 'voice';
  status: 'ended' | 'missed' | 'declined' | 'cancelled';
  duration?: number;
}

export function parseCallLog(content?: string | null): CallLogData | null {
  if (!content || !content.startsWith('__call__:')) return null;
  try {
    const raw = JSON.parse(content.slice('__call__:'.length));
    if (raw && typeof raw === 'object' && raw.status) {
      return raw as CallLogData;
    }
  } catch {
    return null;
  }
  return null;
}


export interface FileResult extends Attachment {
  uploader: { id: string; name: string };
  channel: { id: string; name: string; type: ChannelType; courseCode: string | null };
}

export interface LinkItem {
  id: string;
  url: string;
  title: string;
  messageId: string;
  sender: { id: string; name: string };
  createdAt: string;
}
