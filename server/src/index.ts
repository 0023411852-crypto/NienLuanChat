import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { prisma } from './prisma';
import {
  signToken,
  verifyToken,
  comparePassword,
  hashPassword,
  requireAuth,
  AuthenticatedRequest,
  AuthUser,
} from './auth';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
});

const PORT = process.env.PORT || 4001;
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const AVATAR_DIR = path.resolve(UPLOAD_DIR, 'avatars');
const ATTACHMENT_DIR = path.resolve(UPLOAD_DIR, 'attachments');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });
if (!fs.existsSync(ATTACHMENT_DIR)) fs.mkdirSync(ATTACHMENT_DIR, { recursive: true });

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));


// Health-check endpoint – dùng bởi run-tests.ts để xác nhận đúng server KhoaChat
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'khoachat', pid: process.pid });
});

// Danh sách đuôi tệp cho phép upload ảnh đại diện (chặn .svg để chống stored XSS)
const ALLOWED_AVATAR_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

// Allowlist đuôi tệp cho phép đính kèm trong kênh
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  // Ảnh
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
  // Tài liệu văn phòng
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf', '.md',
  // File nén
  '.zip', '.rar', '.7z', '.tar', '.gz',
  // Âm thanh & Video
  '.mp3', '.wav', '.ogg', '.mp4', '.webm', '.mov', '.mkv',
  // Mã nguồn & dữ liệu
  '.json', '.xml', '.sql', '.py', '.java', '.c', '.cpp', '.cs', '.js', '.ts', '.html', '.css'
]);

// Danh sách các đuôi nguy hại tuyệt đối bị cấm
const BANNED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.vbs', '.msi', '.dll', '.com', '.scr', '.ps1',
  '.pif', '.application', '.gadget', '.hta', '.cpl', '.msc', '.jar', '.reg', '.svg'
]);

// Cấu hình Multer lưu ảnh đại diện vào uploads/avatars
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_AVATAR_EXTENSIONS.has(ext)) {
      return cb(new Error('Chỉ chấp nhận ảnh đại diện định dạng JPG, PNG, WebP hoặc GIF (không cho phép SVG)'));
    }
    cb(null, true);
  },
});

// Cấu hình Multer lưu tệp đính kèm vào uploads/attachments
const attachmentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ATTACHMENT_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage: attachmentStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB theo đúng tài liệu
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BANNED_EXTENSIONS.has(ext) || !ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) {
      return cb(new Error('Loại tệp không được hỗ trợ hoặc bị từ chối vì lý do an toàn'));
    }
    cb(null, true);
  },
});

function checkAvatarMagicBytes(filePath: string, ext: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(12);
    const bytesRead = fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);
    if (bytesRead < 4) return false;

    if (['.jpg', '.jpeg'].includes(ext)) {
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (ext === '.png') {
      return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    if (ext === '.gif') {
      return buffer.subarray(0, 3).toString() === 'GIF';
    }
    if (ext === '.webp') {
      return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
    }
    return false;
  } catch {
    return false;
  }
}

function checkMagicBytes(filePath: string, ext: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(32);
    const bytesRead = fs.readSync(fd, buffer, 0, 32, 0);
    fs.closeSync(fd);
    if (bytesRead < 4) return false;

    // Ảnh
    if (['.jpg', '.jpeg'].includes(ext)) {
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (ext === '.png') {
      return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    if (ext === '.gif') {
      return buffer.subarray(0, 3).toString() === 'GIF';
    }
    if (ext === '.webp') {
      return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
    }
    if (ext === '.bmp') {
      return buffer[0] === 0x42 && buffer[1] === 0x4d;
    }

    // PDF
    if (ext === '.pdf') {
      return buffer.subarray(0, 4).toString() === '%PDF';
    }

    // ZIP, DOCX, XLSX, PPTX (chữ ký PK..)
    if (['.zip', '.docx', '.xlsx', '.pptx'].includes(ext)) {
      return buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);
    }

    // RAR
    if (ext === '.rar') {
      return buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72 && buffer[3] === 0x21;
    }

    // 7z
    if (ext === '.7z') {
      return buffer[0] === 0x37 && buffer[1] === 0x7a && buffer[2] === 0xbc && buffer[3] === 0xaf && buffer[4] === 0x27 && buffer[5] === 0x1c;
    }

    // Video MP4, MOV, WEBM, MKV
    if (['.mp4', '.mov'].includes(ext)) {
      return buffer.subarray(4, 8).toString() === 'ftyp';
    }
    if (['.mkv', '.webm'].includes(ext)) {
      return buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
    }

    // Âm thanh MP3
    if (ext === '.mp3') {
      return buffer.subarray(0, 3).toString() === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
    }

    // Tuyệt đối không cho phép file binary giả danh text (kiểm tra không có byte null trong 32 byte đầu)
    if (['.txt', '.csv', '.md', '.json', '.xml', '.sql', '.py', '.java', '.c', '.cpp', '.cs', '.js', '.ts', '.html', '.css'].includes(ext)) {
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0x00) return false;
      }
      return true;
    }

    return true;
  } catch {
    return false;
  }
}

// ==========================================
// CHANNEL MODERATION STATE (CẤM CHAT & KHÓA CHAT)
// ==========================================
const SETTINGS_FILE = path.join(__dirname, '..', 'channel_moderation.json');
let moderationData: {
  mutedMembers: string[];
  lockedChannels: string[];
} = { mutedMembers: [], lockedChannels: [] };

try {
  if (fs.existsSync(SETTINGS_FILE)) {
    moderationData = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  }
} catch (e) {
  console.error('Error loading moderation data', e);
}

const mutedMembers = new Set<string>(moderationData.mutedMembers || []);
const channelChatLocked = new Set<string>(moderationData.lockedChannels || []);

function saveModerationData() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
      mutedMembers: Array.from(mutedMembers),
      lockedChannels: Array.from(channelChatLocked),
    }, null, 2));
  } catch (e) {
    console.error('Error saving moderation data', e);
  }
}

// ==========================================
// FORMATTERS
// ==========================================
function formatMessage(m: any) {
  return {
    id: m.id,
    seq: m.seq,
    clientId: m.clientId,
    channelId: m.channelId,
    senderId: m.senderId,
    sender: {
      id: m.sender?.id || m.senderId,
      name: m.sender?.name || 'Người dùng',
      avatar: m.sender?.avatar || null,
      role: m.sender?.role || 'STUDENT',
    },
    type: m.type,
    content: m.deletedAt ? 'Tin nhắn đã bị thu hồi' : m.content,
    replyToId: m.replyToId,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          senderId: m.replyTo.senderId,
          senderName: m.replyTo.sender?.name || 'Người dùng',
          content: m.replyTo.deletedAt ? 'Tin nhắn đã bị thu hồi' : m.replyTo.content.slice(0, 200),
          deleted: Boolean(m.replyTo.deletedAt),
          attachmentCount: m.replyTo.attachments?.length || 0,
        }
      : null,
    pinned: m.pinned,
    pinnedAt: m.pinnedAt ? m.pinnedAt.toISOString() : null,
    pinnedById: m.pinnedById,
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt ? m.editedAt.toISOString() : null,
    deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
    attachments: (m.attachments || []).map((a: any) => ({
      id: a.id,
      filename: a.filename,
      mime: a.mime,
      size: a.size,
      isImage: a.isImage,
      url: `/api/files/${a.id}`,
      channelId: a.channelId,
      uploaderId: a.uploaderId,
      createdAt: a.createdAt.toISOString(),
    })),
    mentions: (m.mentions || []).map((mt: any) => ({
      id: mt.user?.id || mt.userId,
      name: mt.user?.name || '',
    })),
    mentionAll: false,
    ackUserIds: m.ackUserIds || [],
  };
}

async function getFormattedChannel(channelId: string, userId: string, role: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      members: { include: { user: true } },
      messages: {
        orderBy: { seq: 'desc' },
        take: 1,
        include: { sender: true, attachments: true, replyTo: { include: { sender: true, attachments: true } }, mentions: { include: { user: true } } },
      },
    },
  });
  if (!channel) return null;

  const m = channel.members.find((mb) => mb.userId === userId);
  let name = channel.name;
  let avatar = channel.avatar;
  if (channel.type === 'DIRECT') {
    const other = channel.members.find((mb) => mb.userId !== userId)?.user;
    if (other) {
      name = other.name;
      avatar = other.avatar;
    }
  }

  const isOwner = m?.role === 'OWNER';
  const isMod = m?.role === 'MODERATOR' || isOwner || role === 'ADMIN';
  const isMuted = mutedMembers.has(`${channel.id}:${userId}`);
  const isChannelLocked = channelChatLocked.has(channel.id);

  let canPost = channel.type !== 'ANNOUNCEMENT' || role !== 'STUDENT';
  if (isMuted) {
    canPost = false;
  } else if (isChannelLocked && !isMod) {
    canPost = false;
  }

  const lastReadSeq = m?.lastReadSeq || 0;
  const [unreadCount, pinnedCount, mentionCount] = await Promise.all([
    prisma.message.count({
      where: {
        channelId: channel.id,
        seq: { gt: lastReadSeq },
        senderId: { not: userId },
        deletedAt: null,
      },
    }),
    prisma.message.count({
      where: {
        channelId: channel.id,
        pinned: true,
        deletedAt: null,
      },
    }),
    prisma.mention.count({
      where: {
        userId,
        message: {
          channelId: channel.id,
          seq: { gt: lastReadSeq },
          deletedAt: null,
        },
      },
    }),
  ]);

  return {
    id: channel.id,
    type: channel.type,
    name,
    description: channel.description,
    courseCode: channel.courseCode,
    avatar,
    archived: channel.archived,
    myRole: m?.role || 'MEMBER',
    canPost,
    isMuted,
    isChannelLocked,
    canPin: Boolean(
      isMod ||
      (channel.type === 'DIRECT' && !!m) ||
      (channel.type === 'CLASS' && role === 'LECTURER' && !!m)
    ),
    canModerate: isMod,
    canMentionAll: isMod,
    canManage: isMod,
    notifyLevel: m?.notifyLevel || 'DEFAULT',
    lastReadMessageId: m?.lastReadMessageId || null,
    lastReadSeq,
    lastReadAt: m?.lastReadAt ? m.lastReadAt.toISOString() : null,
    unreadCount,
    mentionCount,
    pinnedCount,
    lastMessage: channel.messages[0] ? formatMessage(channel.messages[0]) : null,
    members: (channel.members || []).map((mb) => ({
      id: mb.user.id,
      name: mb.user.name,
      avatar: mb.user.avatar,
      role: mb.user.role,
      memberRole: mb.role,
      lastSeenAt: mb.user.lastSeenAt ? mb.user.lastSeenAt.toISOString() : null,
    })),
  };
}

/**
 * Kiểm tra tập trung quyền truy cập kênh (RBAC & Membership):
 * - canView: Có quyền đọc danh sách, tin nhắn, tệp, ghim của kênh
 * - canPost: Có quyền gửi tin nhắn, tải tệp lên kênh
 * - canPin: Có quyền ghim/bỏ ghim tin nhắn
 * - canManage: Có quyền quản lý kênh (chủ sở hữu hoặc moderator/admin)
 */
async function checkChannelAccess(channelId: string, userId: string, userRole: string): Promise<{
  channel: any | null;
  membership: any | null;
  canView: boolean;
  canPost: boolean;
  canPin: boolean;
  canManage: boolean;
}> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { members: true },
  });
  if (!channel) {
    return { channel: null, membership: null, canView: false, canPost: false, canPin: false, canManage: false };
  }

  const membership = channel.members.find((m: any) => m.userId === userId) || null;
  const isAdmin = userRole === 'ADMIN';
  const isOwner = membership?.role === 'OWNER';
  const isMod = membership?.role === 'MODERATOR' || isOwner || isAdmin;
  const isDirect = channel.type === 'DIRECT';
  const isAnnouncement = channel.type === 'ANNOUNCEMENT';

  const canView = isAdmin || isAnnouncement || !!membership;
  let canPost = canView && (isAnnouncement ? userRole !== 'STUDENT' : (isAdmin || !!membership));
  if (mutedMembers.has(`${channelId}:${userId}`)) canPost = false;
  if (channelChatLocked.has(channelId) && !isMod) canPost = false;

  const canPin =
    canView &&
    (
      isAdmin ||
      (isDirect && !!membership) ||
      isMod ||
      (channel.type === 'CLASS' && userRole === 'LECTURER' && !!membership)
    );
  const canManage = isMod;

  return { channel, membership, canView, canPost, canPin, canManage };
}

// Giới hạn số lần thử đăng nhập sai liên tục để chống Brute-Force
const failedLoginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const messageRateLimits = new Map<string, number[]>();

function consumeMessageRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowStart = now - 60 * 1000;
  const recent = (messageRateLimits.get(userId) || []).filter((timestamp) => timestamp > windowStart);
  if (recent.length >= 30) {
    messageRateLimits.set(userId, recent);
    return false;
  }
  recent.push(now);
  messageRateLimits.set(userId, recent);
  return true;
}

function checkLoginRateLimit(key: string): boolean {
  const record = failedLoginAttempts.get(key);
  if (!record) return true;
  if (record.lockedUntil > Date.now()) return false;
  if (record.lockedUntil <= Date.now() && record.count >= 10) {
    failedLoginAttempts.delete(key);
  }
  return true;
}

function recordFailedLogin(key: string) {
  const now = Date.now();
  const record = failedLoginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= 10) {
    record.lockedUntil = now + 60 * 1000; // Khóa 1 phút nếu nhập sai quá 10 lần liên tục
  }
  failedLoginAttempts.set(key, record);
}

function clearFailedLogin(key: string) {
  failedLoginAttempts.delete(key);
}

// ==========================================
// 1. AUTH ROUTES
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });
  }

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const rateLimitKey = `${clientIp}:${email}`;

  if (!checkLoginRateLimit(rateLimitKey)) {
    return res.status(429).json({ error: 'Quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau 1 phút.' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !comparePassword(password, user.password)) {
    recordFailedLogin(rateLimitKey);
    return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
  }
  if (user.locked) {
    return res.status(403).json({ error: 'Tài khoản đã bị khoá', code: 'LOCKED' });
  }

  clearFailedLogin(rateLimitKey);

  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      studentCode: user.studentCode,
    },
  });
});

app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, name: true, role: true, avatar: true, studentCode: true, locked: true },
  });
  if (!user || user.locked) return res.status(401).json({ error: 'Tài khoản không hợp lệ hoặc đã bị khoá' });
  res.json({ user });
});

app.post('/api/auth/logout', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, studentCode } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(400).json({ error: 'Email này đã được sử dụng' });
  }

  const user = await prisma.user.create({
    data: {
      email,
      password: hashPassword(password),
      name,
      studentCode: studentCode || null,
      role: 'STUDENT',
    },
  });

  // Tự động thêm vào các kênh công cộng / thông báo
  const publicChannels = await prisma.channel.findMany({
    where: { type: { in: ['ANNOUNCEMENT', 'COMMUNITY'] } },
  });
  for (const ch of publicChannels) {
    await prisma.channelMember.create({
      data: { channelId: ch.id, userId: user.id, role: 'MEMBER' },
    });
  }

  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      studentCode: user.studentCode,
    },
  });
});

app.post('/api/auth/avatar', requireAuth, avatarUpload.single('file'), async (req: AuthenticatedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không tìm thấy tệp' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!checkAvatarMagicBytes(req.file.path, ext)) {
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(400).json({ error: 'Tệp ảnh đại diện không hợp lệ hoặc lỗi chữ ký nhị phân' });
  }
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: { avatar: avatarUrl },
  });
  io.emit('user:avatar', { id: updated.id, avatar: updated.avatar });
  res.json({
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      avatar: updated.avatar,
      studentCode: updated.studentCode,
    },
  });
});

app.delete('/api/auth/avatar', requireAuth, async (req: AuthenticatedRequest, res) => {
  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: { avatar: null },
  });
  io.emit('user:avatar', { id: updated.id, avatar: null });
  res.json({
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      avatar: null,
      studentCode: updated.studentCode,
    },
  });
});

// ==========================================
// 2. CHANNELS & MESSAGES
// ==========================================
app.get('/api/channels', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const memberships = await prisma.channelMember.findMany({
    where: { userId },
    select: { channelId: true },
  });

  const channels = await Promise.all(
    memberships.map((m) => getFormattedChannel(m.channelId, userId, req.user!.role))
  );

  res.json({ channels: channels.filter(Boolean), online: Array.from(onlineUsers) });
});

app.get('/api/channels/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const access = await checkChannelAccess(req.params.id, req.user!.id, req.user!.role);
  if (!access.channel) return res.status(404).json({ error: 'Kênh không tồn tại' });
  if (!access.canView) {
    return res.status(403).json({ error: 'Bạn không có quyền truy cập kênh này' });
  }
  const ch = await getFormattedChannel(req.params.id, req.user!.id, req.user!.role);
  res.json({ channel: ch });
});

app.patch('/api/channels/:id/settings', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { notifyLevel } = req.body;
  const channelId = req.params.id;
  const userId = req.user!.id;

  await prisma.channelMember.updateMany({
    where: { channelId, userId },
    data: { notifyLevel: notifyLevel || 'DEFAULT' },
  });

  const ch = await getFormattedChannel(channelId, userId, req.user!.role);
  res.json({ channel: ch });
});

app.delete('/api/channels/:id/membership', requireAuth, async (req: AuthenticatedRequest, res) => {
  const channelId = req.params.id;
  const userId = req.user!.id;

  const ch = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!ch) return res.status(404).json({ error: 'Kênh không tồn tại' });

  // Ràng buộc nghiệp vụ: Không cho phép tự rời kênh thông báo khoa hoặc kênh lớp học phần bắt buộc
  if (ch.type === 'ANNOUNCEMENT') {
    return res.status(400).json({ error: 'Không thể rời khỏi kênh thông báo chung của khoa' });
  }
  if (ch.type === 'CLASS' && req.user!.role === 'STUDENT') {
    return res.status(400).json({ error: 'Sinh viên không thể tự ý rời khỏi kênh lớp học phần bắt buộc' });
  }

  await prisma.channelMember.deleteMany({
    where: { channelId, userId },
  });

  io.to(`channel:${channelId}`).emit('channel:changed', { channelId });
  res.json({ ok: true });
});

app.post('/api/channels/community', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { name, description, memberIds } = req.body;
  const myId = req.user!.id;

  const channel = await prisma.channel.create({
    data: {
      type: 'COMMUNITY',
      name: name || 'Cộng đồng mới',
      description: description || null,
      members: {
        create: [
          { userId: myId, role: 'OWNER' },
          ...(memberIds || []).filter((id: string) => id !== myId).map((id: string) => ({ userId: id, role: 'MEMBER' })),
        ],
      },
    },
  });

  // Tạo tin nhắn hệ thống chào mừng
  await prisma.message.create({
    data: {
      clientId: crypto.randomUUID(),
      channelId: channel.id,
      senderId: myId,
      type: 'SYSTEM',
      content: `🎉 [Hệ thống] ${req.user!.name} đã tạo nhóm "${channel.name}"`,
    },
  });

  const allUserIds = [myId, ...(memberIds || []).filter((id: string) => id !== myId)];
  for (const uid of allUserIds) {
    io.in(`user:${uid}`).socketsJoin(`channel:${channel.id}`);
    io.to(`user:${uid}`).emit('channel:new', { channelId: channel.id });
  }

  const ch = await getFormattedChannel(channel.id, myId, req.user!.role);
  res.json({ channel: ch });
});

app.get('/api/channels/:id/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  const channelId = req.params.id;
  const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
  const before = req.query.before ? parseInt(req.query.before as string) : undefined;
  const after = req.query.after ? parseInt(req.query.after as string) : undefined;

  const ch = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!ch) return res.status(404).json({ error: 'Kênh không tồn tại' });

  // Kiểm tra quyền xem tin nhắn trong kênh riêng tư (ngoại trừ ADMIN hoặc kênh thông báo khoa công khai)
  if (req.user!.role !== 'ADMIN' && ch.type !== 'ANNOUNCEMENT') {
    const isMember = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: req.user!.id } },
    });
    if (!isMember) {
      return res.status(403).json({ error: 'Bạn không có quyền xem tin nhắn trong kênh này' });
    }
  }

  let where: any = { channelId };
  if (before) where.seq = { lt: before };
  if (after) where.seq = { gt: after };

  const [messages, members] = await Promise.all([
    prisma.message.findMany({
      where,
      orderBy: { seq: 'asc' },
      take: limit,
      include: {
        sender: true,
        attachments: true,
        replyTo: { include: { sender: true, attachments: true } },
        mentions: { include: { user: true } },
      },
    }),
    prisma.channelMember.findMany({
      where: { channelId },
      select: { userId: true, lastReadSeq: true },
    }),
  ]);

  const formattedMessages = messages.map((m) => {
    const ackUserIds = members
      .filter((mb) => {
        const delSeq = getDeliveredSeq(channelId, mb.userId);
        return mb.lastReadSeq >= m.seq || delSeq >= m.seq;
      })
      .map((mb) => mb.userId);

    return {
      ...formatMessage(m),
      ackUserIds,
    };
  });

  res.json({
    messages: formattedMessages,
    hasMore: messages.length === limit,
    hasNewer: false,
  });
});

// Endpoint đếm tổng số tin nhắn trong kênh - dùng cho kiểm thử idempotency (Test 10)
app.get('/api/channels/:id/message-count', requireAuth, async (req: AuthenticatedRequest, res) => {
  const channelId = req.params.id;
  const ch = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!ch) return res.status(404).json({ error: 'Kênh không tồn tại' });
  if (req.user!.role !== 'ADMIN' && ch.type !== 'ANNOUNCEMENT') {
    const isMember = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: req.user!.id } },
    });
    if (!isMember) return res.status(403).json({ error: 'Không có quyền truy cập kênh này' });
  }
  const total = await prisma.message.count({ where: { channelId } });
  res.json({ channelId, total });
});

app.get('/api/channels/:id/pins', requireAuth, async (req: AuthenticatedRequest, res) => {
  const channelId = req.params.id;
  const access = await checkChannelAccess(channelId, req.user!.id, req.user!.role);
  if (!access.channel) return res.status(404).json({ error: 'Kênh không tồn tại' });
  if (!access.canView) {
    return res.status(403).json({ error: 'Bạn không có quyền xem tin ghim của kênh này' });
  }

  const [pins, members] = await Promise.all([
    prisma.message.findMany({
      where: { channelId, pinned: true },
      orderBy: { pinnedAt: 'desc' },
      include: {
        sender: true,
        attachments: true,
        replyTo: { include: { sender: true, attachments: true } },
        mentions: { include: { user: true } },
      },
    }),
    prisma.channelMember.findMany({
      where: { channelId },
      select: { userId: true, lastReadSeq: true },
    }),
  ]);

  const formattedPins = pins.map((m) => {
    const ackUserIds = members
      .filter((mb) => {
        const delSeq = getDeliveredSeq(channelId, mb.userId);
        return mb.lastReadSeq >= m.seq || delSeq >= m.seq;
      })
      .map((mb) => mb.userId);

    return {
      ...formatMessage(m),
      ackUserIds,
    };
  });

  res.json({ messages: formattedPins });
});

// Ghim / Bỏ ghim tin nhắn
app.post('/api/messages/:id/pin', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { pinned } = req.body;
  const msg = await prisma.message.findUnique({ where: { id } });
  if (!msg) return res.status(404).json({ error: 'Tin nhắn không tồn tại' });

  const access = await checkChannelAccess(msg.channelId, req.user!.id, req.user!.role);
  if (!access.canView || !access.canPin) {
    return res.status(403).json({ error: 'Bạn không có quyền ghim tin nhắn trong kênh này' });
  }

  const isPinned = pinned !== undefined ? !!pinned : !msg.pinned;
  const updated = await prisma.message.update({
    where: { id },
    data: {
      pinned: isPinned,
      pinnedAt: isPinned ? new Date() : null,
      pinnedById: isPinned ? req.user!.id : null,
    },
    include: {
      sender: true,
      attachments: true,
      replyTo: { include: { sender: true, attachments: true } },
      mentions: { include: { user: true } },
    },
  });
  const formatted = formatMessage(updated);
  io.to(`channel:${msg.channelId}`).emit('message:updated', formatted);
  res.json({ ok: true, message: formatted });
});

// Chỉnh sửa tin nhắn
app.patch('/api/messages/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const msg = await prisma.message.findUnique({ where: { id } });
  if (!msg) return res.status(404).json({ error: 'Tin nhắn không tồn tại' });
  if (msg.senderId !== req.user!.id) {
    return res.status(403).json({ error: 'Bạn chỉ có thể sửa tin của mình' });
  }
  const updated = await prisma.message.update({
    where: { id },
    data: { content: content || '', editedAt: new Date() },
    include: {
      sender: true,
      attachments: true,
      replyTo: { include: { sender: true, attachments: true } },
      mentions: { include: { user: true } },
    },
  });
  const formatted = formatMessage(updated);
  io.to(`channel:${msg.channelId}`).emit('message:updated', formatted);
  res.json({ ok: true, message: formatted });
});

// Xoá / Thu hồi tin nhắn
app.delete('/api/messages/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const msg = await prisma.message.findUnique({ where: { id } });
  if (!msg) return res.status(404).json({ error: 'Tin nhắn không tồn tại' });
  if (msg.senderId !== req.user!.id && req.user!.role === 'STUDENT') {
    return res.status(403).json({ error: 'Bạn không có quyền xoá tin này' });
  }
  const updated = await prisma.message.update({
    where: { id },
    data: { deletedAt: new Date() },
    include: {
      sender: true,
      attachments: true,
      replyTo: { include: { sender: true, attachments: true } },
      mentions: { include: { user: true } },
    },
  });
  const formatted = formatMessage(updated);
  io.to(`channel:${msg.channelId}`).emit('message:updated', formatted);
  res.json({ ok: true, message: formatted });
});

// Danh sách file của kênh (FilesTab)
app.get('/api/channels/:id/files', requireAuth, async (req: AuthenticatedRequest, res) => {
  const channelId = req.params.id;
  const access = await checkChannelAccess(channelId, req.user!.id, req.user!.role);
  if (!access.channel) return res.status(404).json({ error: 'Kênh không tồn tại' });
  if (!access.canView) {
    return res.status(403).json({ error: 'Bạn không có quyền truy cập tệp của kênh này' });
  }

  const kind = req.query.kind as string;
  let where: any = { channelId };

  if (kind === 'image') {
    where.OR = [{ isImage: true }, { mime: { startsWith: 'image/' } }];
  } else if (kind === 'video') {
    where.OR = [
      { mime: { startsWith: 'video/' } },
      { filename: { endsWith: '.mp4' } },
      { filename: { endsWith: '.webm' } },
      { filename: { endsWith: '.mov' } },
      { filename: { endsWith: '.mkv' } },
    ];
  } else if (kind === 'file') {
    where.isImage = false;
    where.NOT = [
      { mime: { startsWith: 'video/' } },
      { filename: { endsWith: '.mp4' } },
      { filename: { endsWith: '.webm' } },
      { filename: { endsWith: '.mov' } },
      { filename: { endsWith: '.mkv' } },
    ];
  } else if (kind === 'pdf') {
    where.mime = { contains: 'pdf' };
  } else if (kind === 'doc') {
    where.mime = { contains: 'word' };
  } else if (kind === 'sheet') {
    where.mime = { contains: 'sheet' };
  } else if (kind === 'slide') {
    where.mime = { contains: 'presentation' };
  } else if (kind === 'archive') {
    where.mime = { contains: 'zip' };
  }

  const files = await prisma.attachment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 150,
    include: { uploader: true, channel: true },
  });

  res.json({
    files: files.map((f) => ({
      id: f.id,
      filename: f.filename,
      size: f.size,
      mime: f.mime,
      isImage: f.isImage,
      url: `/api/files/${f.id}`,
      createdAt: f.createdAt.toISOString(),
      channelId: f.channelId,
      messageId: f.messageId,
      uploader: {
        id: f.uploader?.id || f.uploaderId,
        name: f.uploader?.name || 'Người dùng',
      },
      channel: {
        id: f.channel?.id || f.channelId,
        name: f.channel?.name || '',
        type: f.channel?.type || 'CLASS',
        courseCode: f.channel?.courseCode || null,
      },
    })),
  });
});

// Danh sách các link đã chia sẻ trong kênh
app.get('/api/channels/:id/links', requireAuth, async (req: AuthenticatedRequest, res) => {
  const channelId = req.params.id;
  const access = await checkChannelAccess(channelId, req.user!.id, req.user!.role);
  if (!access.channel) return res.status(404).json({ error: 'Kênh không tồn tại' });
  if (!access.canView) {
    return res.status(403).json({ error: 'Bạn không có quyền truy cập liên kết của kênh này' });
  }

  const messages = await prisma.message.findMany({
    where: {
      channelId,
      deletedAt: null,
      content: { contains: 'http' },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { sender: true },
  });

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const links: {
    id: string;
    url: string;
    title: string;
    messageId: string;
    sender: { id: string; name: string };
    createdAt: string;
  }[] = [];

  for (const m of messages) {
    const matches = m.content.match(urlRegex);
    if (matches) {
      for (const u of matches) {
        let title = u;
        try {
          const parsed = new URL(u);
          title = parsed.hostname + (parsed.pathname.length > 1 ? parsed.pathname : '');
        } catch {}
        links.push({
          id: `${m.id}-${links.length}`,
          url: u,
          title,
          messageId: m.id,
          sender: { id: m.sender.id, name: m.sender.name },
          createdAt: m.createdAt.toISOString(),
        });
      }
    }
  }

  res.json({ links });
});

// Upload tệp vào kênh (kiểm tra membership, allowlist và magic bytes)
app.post('/api/channels/:id/uploads', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không có tệp đính kèm' });

  const channelId = req.params.id;
  const access = await checkChannelAccess(channelId, req.user!.id, req.user!.role);
  if (!access.channel) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Kênh không tồn tại' });
  }
  if (!access.canPost) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: 'Bạn không có quyền tải tệp lên kênh này' });
  }

  const clientId = typeof req.body.clientId === 'string' && req.body.clientId.trim()
    ? req.body.clientId.trim()
    : null;
  if (clientId) {
    const existing = await prisma.attachment.findFirst({
      where: { uploaderId: req.user!.id, clientId },
    });
    if (existing) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.json({
        attachment: {
          id: existing.id,
          filename: existing.filename,
          mime: existing.mime,
          size: existing.size,
          isImage: existing.isImage,
          url: `/api/files/${existing.id}`,
          channelId: existing.channelId,
          uploaderId: existing.uploaderId,
          createdAt: existing.createdAt.toISOString(),
        },
      });
    }
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!checkMagicBytes(req.file.path, ext)) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(415).json({ error: 'Nội dung tệp không hợp lệ hoặc giả mạo phần mở rộng' });
  }

  const isImage = req.file.mimetype.startsWith('image/');
  const attachment = await prisma.attachment.create({
    data: {
      clientId,
      filename: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
      mime: req.file.mimetype,
      size: req.file.size,
      isImage,
      path: req.file.filename,
      url: '',
      channelId,
      uploaderId: req.user!.id,
    },
  });

  res.json({
    attachment: {
      id: attachment.id,
      filename: attachment.filename,
      mime: attachment.mime,
      size: attachment.size,
      isImage: attachment.isImage,
      url: `/api/files/${attachment.id}`,
      channelId: attachment.channelId,
      uploaderId: attachment.uploaderId,
      createdAt: attachment.createdAt.toISOString(),
    },
  });
});

// Tải file xuống — yêu cầu xác thực và kiểm tra quyền thành viên kênh
app.get('/api/files/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const att = await prisma.attachment.findUnique({
    where: { id: req.params.id },
    include: { channel: { select: { type: true } }, message: { select: { deletedAt: true } } },
  });
  if (!att) return res.status(404).send('Không tìm thấy tệp');
  if (att.message?.deletedAt) return res.status(404).send('Tệp thuộc tin nhắn đã bị xoá');

  // Kiểm tra quyền: ADMIN hoặc thành viên kênh mới được tải file
  if (req.user!.role !== 'ADMIN') {
    // Kênh ANNOUNCEMENT cho phép mọi thành viên đã xác thực xem thông báo
    if (att.channel?.type !== 'ANNOUNCEMENT') {
      const isMember = await prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId: att.channelId!, userId: req.user!.id } },
      });
      if (!isMember) {
        return res.status(403).send('Bạn không có quyền truy cập tệp này');
      }
    }
  }

  // Tìm trong ATTACHMENT_DIR trước, sau đó fallback sang UPLOAD_DIR
  let filePath = path.join(ATTACHMENT_DIR, att.path);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(UPLOAD_DIR, att.path);
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return res.status(404).send('Tệp đã bị xoá');
  res.setHeader('Content-Type', att.mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  if (req.query.download === '1') {
    res.download(filePath, att.filename);
  } else {
    res.sendFile(filePath);
  }
});

app.post('/api/channels/:id/read', requireAuth, async (req: AuthenticatedRequest, res) => {
  const channelId = req.params.id;
  const messageId = typeof req.body?.messageId === 'string' ? req.body.messageId : null;
  let maxSeq = Number.isInteger(req.body?.maxSeq) ? req.body.maxSeq : 0;
  const access = await checkChannelAccess(channelId, req.user!.id, req.user!.role);
  if (!access.channel) return res.status(404).json({ error: 'Kênh không tồn tại' });
  if (!access.canView) return res.status(403).json({ error: 'Bạn không có quyền truy cập kênh này' });

  if (messageId) {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.channelId !== channelId) {
      return res.status(400).json({ error: 'Tin nhắn không thuộc kênh được chỉ định', code: 'INVALID_MESSAGE' });
    }
    maxSeq = Math.max(maxSeq, message.seq);
  }

  await prisma.channelMember.updateMany({
    where: { channelId, userId: req.user!.id, lastReadSeq: { lt: maxSeq } },
    data: {
      lastReadSeq: maxSeq,
      lastReadMessageId: messageId || undefined,
      lastReadAt: new Date(),
    },
  });
  const member = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: req.user!.id } },
  });
  const state = {
    channelId,
    messageId: member?.lastReadMessageId || null,
    seq: member?.lastReadSeq || 0,
    userId: req.user!.id,
    at: new Date().toISOString(),
  };
  setDeliveredSeq(channelId, req.user!.id, state.seq);
  io.to(`channel:${channelId}`).emit('channel:read', state);
  io.to(`user:${req.user!.id}`).emit('channel:read', state);
  res.json({ ok: true, ...state });
});

// Báo cáo xác nhận đã đọc thông báo (Dùng ChannelMember.lastReadSeq theo đề xuất của Thầy)
app.get('/api/messages/:id/acks', requireAuth, async (req: AuthenticatedRequest, res) => {
  const msg = await prisma.message.findUnique({
    where: { id: req.params.id },
    include: {
      channel: { include: { members: { include: { user: true } } } },
    },
  });
  if (!msg) return res.status(404).json({ error: 'Tin nhắn không tồn tại' });

  // Kiểm tra quyền: người gọi API phải có quyền xem kênh chứa tin nhắn này
  const access = await checkChannelAccess(msg.channelId, req.user!.id, req.user!.role);
  if (!access.canView) {
    return res.status(403).json({ error: 'Bạn không có quyền xem thông tin đọc tin nhắn của kênh này' });
  }

  const students = msg.channel.members.filter((m) => m.user.role === 'STUDENT');

  const acked: any[] = [];
  const pending: any[] = [];

  students.forEach((m) => {
    const isRead = Boolean(m.lastReadSeq >= msg.seq);
    const row = {
      id: m.user.id,
      name: m.user.name,
      studentCode: m.user.studentCode,
      avatar: m.user.avatar,
      ackedAt: isRead ? (m.lastReadAt?.toISOString() || msg.createdAt.toISOString()) : null,
      seen: isRead,
    };
    if (isRead) acked.push(row);
    else pending.push(row);
  });

  res.json({
    total: students.length,
    acked,
    pending,
  });
});

// Channel Avatars & Presets (Yêu cầu quyền quản lý kênh canManage)
app.post('/api/channel-avatars/:id', requireAuth, avatarUpload.single('file'), async (req: AuthenticatedRequest, res) => {
  const channelId = req.params.id;
  const access = await checkChannelAccess(channelId, req.user!.id, req.user!.role);
  if (!access.channel) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(404).json({ error: 'Kênh không tồn tại' });
  }
  if (!access.canManage) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(403).json({ error: 'Bạn không có quyền quản lý ảnh đại diện kênh này' });
  }
  if (!req.file) return res.status(400).json({ error: 'Không có tệp ảnh' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!checkAvatarMagicBytes(req.file.path, ext)) {
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(400).json({ error: 'Tệp ảnh không hợp lệ hoặc lỗi chữ ký nhị phân' });
  }

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  await prisma.channel.update({
    where: { id: channelId },
    data: { avatar: avatarUrl },
  });
  io.to(`channel:${channelId}`).emit('channel:changed', { channelId });
  const ch = await getFormattedChannel(channelId, req.user!.id, req.user!.role);
  res.json({ channel: ch });
});

app.put('/api/channel-avatars/:id/preset', requireAuth, async (req: AuthenticatedRequest, res) => {
  const channelId = req.params.id;
  const access = await checkChannelAccess(channelId, req.user!.id, req.user!.role);
  if (!access.channel) return res.status(404).json({ error: 'Kênh không tồn tại' });
  if (!access.canManage) {
    return res.status(403).json({ error: 'Bạn không có quyền thay đổi biểu tượng kênh này' });
  }
  const { preset } = req.body;
  const avatarUrl = `/api/channel-avatars/presets/${preset}.svg`;
  await prisma.channel.update({
    where: { id: channelId },
    data: { avatar: avatarUrl },
  });
  io.to(`channel:${channelId}`).emit('channel:changed', { channelId });
  const ch = await getFormattedChannel(channelId, req.user!.id, req.user!.role);
  res.json({ channel: ch });
});

app.delete('/api/channel-avatars/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const channelId = req.params.id;
  const access = await checkChannelAccess(channelId, req.user!.id, req.user!.role);
  if (!access.channel) return res.status(404).json({ error: 'Kênh không tồn tại' });
  if (!access.canManage) {
    return res.status(403).json({ error: 'Bạn không có quyền xoá ảnh đại diện kênh này' });
  }
  await prisma.channel.update({
    where: { id: channelId },
    data: { avatar: null },
  });
  io.to(`channel:${channelId}`).emit('channel:changed', { channelId });
  const ch = await getFormattedChannel(channelId, req.user!.id, req.user!.role);
  res.json({ channel: ch });
});

app.get('/api/channel-avatars/presets/:preset.svg', (req, res) => {
  const colors: Record<string, string> = {
    book: '#3b82f6',
    code: '#10b981',
    science: '#8b5cf6',
    bell: '#f59e0b',
    chat: '#06b6d4',
    team: '#ec4899',
  };
  const bg = colors[req.params.preset] || '#6366f1';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="${bg}"/><text x="50%" y="55%" font-size="32" font-family="sans-serif" font-weight="bold" fill="#fff" text-anchor="middle" dominant-baseline="middle">${(req.params.preset || 'KC').slice(0, 2).toUpperCase()}</text></svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

// Tạo tin nhắn riêng
app.post('/api/direct', requireAuth, async (req: AuthenticatedRequest, res) => {
  const targetId = req.body.userId;
  const myId = req.user!.id;
  if (targetId === myId) return res.status(400).json({ error: 'Không thể tự chat với chính mình' });

  let channel = await prisma.channel.findFirst({
    where: {
      type: 'DIRECT',
      AND: [
        { members: { some: { userId: myId } } },
        { members: { some: { userId: targetId } } },
      ],
    },
    include: { members: { include: { user: true } } },
  });

  if (!channel) {
    const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
    channel = await prisma.channel.create({
      data: {
        type: 'DIRECT',
        name: targetUser?.name || 'Tin nhắn riêng',
        members: {
          create: [
            { userId: myId, role: 'OWNER' },
            { userId: targetId, role: 'OWNER' },
          ],
        },
      },
      include: { members: { include: { user: true } } },
    });
    // Thông báo realtime cho đối phương
    const targetChannel = await getFormattedChannel(channel.id, targetId, targetUser?.role || 'STUDENT');
    io.to(`user:${targetId}`).emit('channel:upsert', { channel: targetChannel });
    io.in(`user:${targetId}`).socketsJoin(`channel:${channel.id}`);
    io.in(`user:${myId}`).socketsJoin(`channel:${channel.id}`);
  }

  const ch = await getFormattedChannel(channel.id, myId, req.user!.role);
  res.json({ channel: ch });
});

// Quản lý trạng thái đã nhận tin nhắn (2 dấu tích)
const DELIVERED_FILE = path.join(__dirname, '../delivered.json');
let deliveredMap = new Map<string, number>(); // "channelId:userId" -> maxSeq

function loadDelivered() {
  try {
    if (fs.existsSync(DELIVERED_FILE)) {
      const data = JSON.parse(fs.readFileSync(DELIVERED_FILE, 'utf-8'));
      deliveredMap = new Map(Object.entries(data));
    }
  } catch (e) {
    console.error('Lỗi đọc delivered.json', e);
  }
}
loadDelivered();

function saveDelivered() {
  try {
    const obj = Object.fromEntries(deliveredMap.entries());
    fs.writeFileSync(DELIVERED_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (e) {
    console.error('Lỗi ghi delivered.json', e);
  }
}

function getDeliveredSeq(channelId: string, userId: string): number {
  return deliveredMap.get(`${channelId}:${userId}`) || 0;
}

function setDeliveredSeq(channelId: string, userId: string, seq: number) {
  const key = `${channelId}:${userId}`;
  const cur = deliveredMap.get(key) || 0;
  if (seq > cur) {
    deliveredMap.set(key, seq);
    saveDelivered();
  }
}

// Danh bạ thành viên Khoa & Lớp
app.get('/api/friends', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const users = await prisma.user.findMany({
    where: { id: { not: userId }, locked: false },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, avatar: true, role: true, studentCode: true, lastSeenAt: true },
  });

  const friends = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatar: u.avatar,
    role: u.role,
    studentCode: u.studentCode,
    online: onlineUsers.has(u.id),
    lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
  }));

  res.json({
    friends,
    incomingRequests: [],
    outgoingRequests: [],
  });
});

app.post('/api/friends/request', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { targetUserId } = req.body;
  const myId = req.user!.id;
  if (!targetUserId || targetUserId === myId) {
    return res.status(400).json({ error: 'Yêu cầu không hợp lệ' });
  }

  let channel = await prisma.channel.findFirst({
    where: {
      type: 'DIRECT',
      AND: [
        { members: { some: { userId: myId } } },
        { members: { some: { userId: targetUserId } } },
      ],
    },
  });

  if (!channel) {
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    channel = await prisma.channel.create({
      data: {
        type: 'DIRECT',
        name: targetUser?.name || 'Tin nhắn riêng',
        members: {
          create: [
            { userId: myId, role: 'OWNER' },
            { userId: targetUserId, role: 'OWNER' },
          ],
        },
      },
    });
    const targetChannel = await getFormattedChannel(channel.id, targetUserId, targetUser?.role || 'STUDENT');
    io.to(`user:${targetUserId}`).emit('channel:upsert', { channel: targetChannel });
    io.in(`user:${targetUserId}`).socketsJoin(`channel:${channel.id}`);
    io.in(`user:${myId}`).socketsJoin(`channel:${channel.id}`);
  }

  const ch = await getFormattedChannel(channel.id, myId, req.user!.role);
  io.to(`user:${myId}`).emit('channel:upsert', { channel: ch });

  res.json({ ok: true, status: 'friend', channelId: channel.id });
});

app.post('/api/friends/accept', requireAuth, async (req: AuthenticatedRequest, res) => {
  const fromId = req.body.fromUserId || req.body.targetUserId;
  const myId = req.user!.id;
  if (!fromId) return res.status(400).json({ error: 'Yêu cầu không hợp lệ' });

  let channel = await prisma.channel.findFirst({
    where: {
      type: 'DIRECT',
      AND: [
        { members: { some: { userId: myId } } },
        { members: { some: { userId: fromId } } },
      ],
    },
  });

  if (!channel) {
    const targetUser = await prisma.user.findUnique({ where: { id: fromId } });
    channel = await prisma.channel.create({
      data: {
        type: 'DIRECT',
        name: targetUser?.name || 'Tin nhắn riêng',
        members: {
          create: [
            { userId: myId, role: 'OWNER' },
            { userId: fromId, role: 'OWNER' },
          ],
        },
      },
    });
    const targetChannel = await getFormattedChannel(channel.id, fromId, targetUser?.role || 'STUDENT');
    io.to(`user:${fromId}`).emit('channel:upsert', { channel: targetChannel });
    io.in(`user:${fromId}`).socketsJoin(`channel:${channel.id}`);
    io.in(`user:${myId}`).socketsJoin(`channel:${channel.id}`);
  }

  const ch = await getFormattedChannel(channel.id, myId, req.user!.role);
  res.json({ ok: true, channel: ch });
});

app.post('/api/friends/decline', requireAuth, async (_req, res) => {
  res.json({ ok: true });
});

app.delete('/api/friends/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const myId = req.user!.id;
  const targetId = req.params.id;
  if (!targetId || targetId === myId) return res.status(400).json({ error: 'Yêu cầu không hợp lệ' });

  res.json({ ok: true });
});

app.get('/api/users/search', requireAuth, async (req: AuthenticatedRequest, res) => {
  const myId = req.user!.id;
  const q = (req.query.q as string || '').trim().toLowerCase();
  if (!q) return res.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      id: { not: myId },
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { studentCode: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 20,
  });

  res.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      role: u.role,
      studentCode: u.studentCode,
      online: onlineUsers.has(u.id),
      friendStatus: 'friend',
    })),
  });
});

app.get('/api/users', requireAuth, async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, avatar: true, role: true, studentCode: true },
    take: 100,
  });
  res.json({ users });
});

app.get('/api/sync', requireAuth, async (req: AuthenticatedRequest, res) => {
  const afterSeq = parseInt(req.query.after as string) || 0;
  const userId = req.user!.id;
  const myChannels = await prisma.channelMember.findMany({
    where: { userId },
    select: { channelId: true },
  });
  const chIds = myChannels.map((c) => c.channelId);

  const [missed, channels] = await Promise.all([
    prisma.message.findMany({
      where: { channelId: { in: chIds }, seq: { gt: afterSeq } },
      orderBy: { seq: 'asc' },
      include: {
        sender: true,
        attachments: true,
        replyTo: { include: { sender: true, attachments: true } },
        mentions: { include: { user: true } },
      },
    }),
    Promise.all(chIds.map((cid) => getFormattedChannel(cid, userId, req.user!.role))),
  ]);

  res.json({
    messages: missed.map(formatMessage),
    channels: channels.filter(Boolean),
    online: Array.from(onlineUsers),
    hasMore: false,
  });
});

// Tìm kiếm tổng hợp (Tin nhắn, theo từ khoá, kênh, người gửi, có tệp đính kèm)
app.get('/api/search', requireAuth, async (req: AuthenticatedRequest, res) => {
  const q = ((req.query.q as string) || '').trim();
  const channelId = req.query.channelId as string | undefined;
  const senderId = req.query.senderId as string | undefined;
  const hasFile = req.query.hasFile === 'true';

  if (!q && !channelId && !senderId && !hasFile) {
    return res.json({ ok: true, messages: [], total: 0 });
  }

  const userId = req.user!.id;
  const myMemberships = await prisma.channelMember.findMany({
    where: { userId },
    select: { channelId: true },
  });
  const chIds = myMemberships.map((m) => m.channelId);

  const where: any = {
    deletedAt: null,
  };
  if (q) {
    where.content = { contains: q, mode: 'insensitive' };
  }
  if (channelId) {
    // Ràng buộc bảo mật: chỉ được tìm kiếm trong kênh mà mình là thành viên
    if (req.user!.role !== 'ADMIN' && !chIds.includes(channelId)) {
      return res.status(403).json({ error: 'Bạn không có quyền tìm kiếm trong kênh này' });
    }
    where.channelId = channelId;
  } else if (req.user!.role !== 'ADMIN') {
    where.channelId = { in: chIds };
  }
  if (senderId) {
    where.senderId = senderId;
  }
  if (hasFile) {
    where.attachments = { some: {} };
  }

  const messages = await prisma.message.findMany({
    where,
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: {
      sender: true,
      attachments: true,
      replyTo: { include: { sender: true, attachments: true } },
      mentions: { include: { user: true } },
    },
  });

  const formatted = messages.map(formatMessage);
  res.json({
    ok: true,
    messages: formatted,
    results: formatted.map((m) => ({ message: m, highlights: q ? [q] : [] })),
    total: formatted.length,
  });
});

// Tìm kiếm tin nhắn
app.get('/api/search/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  const q = (req.query.q as string || '').trim();
  if (!q) return res.json({ results: [], total: 0 });

  const userId = req.user!.id;
  const myMemberships = await prisma.channelMember.findMany({
    where: { userId },
    select: { channelId: true },
  });
  const chIds = myMemberships.map((m) => m.channelId);

  const where: any = {
    content: { contains: q, mode: 'insensitive' },
    deletedAt: null,
  };
  if (req.user!.role !== 'ADMIN') {
    where.channelId = { in: chIds };
  }

  const messages = await prisma.message.findMany({
    where,
    take: 30,
    orderBy: { createdAt: 'desc' },
    include: {
      sender: true,
      attachments: true,
      replyTo: { include: { sender: true, attachments: true } },
      mentions: { include: { user: true } },
    },
  });

  res.json({
    results: messages.map((m) => ({
      message: formatMessage(m),
      highlights: [q],
    })),
    total: messages.length,
  });
});

// Tìm kiếm tệp
app.get('/api/search/files', requireAuth, async (req: AuthenticatedRequest, res) => {
  const q = (req.query.q as string || '').trim();
  const userId = req.user!.id;
  const myMemberships = await prisma.channelMember.findMany({
    where: { userId },
    select: { channelId: true },
  });
  const chIds = myMemberships.map((m) => m.channelId);

  const where: any = {};
  if (q) where.filename = { contains: q, mode: 'insensitive' };
  const channelId = req.query.channelId as string | undefined;
  if (channelId) {
    if (req.user!.role !== 'ADMIN' && !chIds.includes(channelId)) {
      return res.status(403).json({ error: 'Bạn không có quyền tìm kiếm tệp trong kênh này' });
    }
    where.channelId = channelId;
  } else if (req.user!.role !== 'ADMIN') {
    where.channelId = { in: chIds };
  }

  const files = await prisma.attachment.findMany({
    where,
    take: 30,
    orderBy: { createdAt: 'desc' },
    include: { uploader: true, channel: true },
  });
  res.json({
    files: files.map((f) => ({
      id: f.id,
      filename: f.filename,
      size: f.size,
      mime: f.mime,
      isImage: f.isImage,
      url: `/api/files/${f.id}`,
      createdAt: f.createdAt.toISOString(),
      channelId: f.channelId,
      messageId: f.messageId,
      uploader: {
        id: f.uploader?.id || f.uploaderId,
        name: f.uploader?.name || 'Người dùng',
      },
      channel: {
        id: f.channel?.id || f.channelId,
        name: f.channel?.name || '',
        type: f.channel?.type || 'CLASS',
        courseCode: f.channel?.courseCode || null,
      },
    })),
    total: files.length,
  });
});

// Push notification mock
app.get('/api/push/public-key', (_req, res) => {
  res.json({ publicKey: 'mock-public-vapid-key' });
});
app.post('/api/push/subscribe', (_req, res) => res.json({ ok: true }));
app.post('/api/push/unsubscribe', (_req, res) => res.json({ ok: true }));

// Admin endpoints - Thống kê hệ thống
app.get('/api/admin/stats', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Chỉ quản trị viên mới có quyền xem thống kê' });
  }

  try {
    const [
      usersByRole,
      lockedUsers,
      channelsByType,
      archivedChannels,
      messagesCount,
      filesCount,
      filesSizeAgg,
      pushSubscriptionsCount,
    ] = await Promise.all([
      prisma.user.groupBy({ by: ['role'], _count: { id: true } }),
      prisma.user.count({ where: { locked: true } }),
      prisma.channel.groupBy({ by: ['type'], _count: { id: true } }),
      prisma.channel.count({ where: { archived: true } }),
      prisma.message.count(),
      prisma.attachment.count(),
      prisma.attachment.aggregate({ _sum: { size: true } }),
      prisma.pushSubscription.count(),
    ]);

    const users: Record<string, number> = {};
    usersByRole.forEach((u) => {
      users[u.role] = u._count.id;
    });

    const channels: Record<string, number> = {};
    channelsByType.forEach((c) => {
      channels[c.type] = c._count.id;
    });

    // Tin nhắn hôm nay
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const messagesToday = await prisma.message.count({
      where: { createdAt: { gte: todayStart } },
    });

    // Tin nhắn 7 ngày gần đây
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentMessages = await prisma.message.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true, channelId: true },
    });

    const dayMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const dayStr = d.toISOString().slice(0, 10);
      dayMap[dayStr] = 0;
    }
    recentMessages.forEach((m) => {
      const dayStr = m.createdAt.toISOString().slice(0, 10);
      if (dayMap[dayStr] !== undefined) dayMap[dayStr]++;
    });
    const messagesPerDay = Object.entries(dayMap).map(([day, count]) => ({ day, count }));

    // Kênh sôi nổi nhất 7 ngày
    const channelCounts: Record<string, number> = {};
    recentMessages.forEach((m) => {
      channelCounts[m.channelId] = (channelCounts[m.channelId] || 0) + 1;
    });
    const sortedChannels = Object.entries(channelCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topChannelDetails = await prisma.channel.findMany({
      where: { id: { in: sortedChannels.map(([cid]) => cid) } },
      select: { id: true, name: true, courseCode: true, type: true },
    });
    const topChannels = sortedChannels.map(([cid, n]) => {
      const ch = topChannelDetails.find((c) => c.id === cid);
      return {
        id: cid,
        name: ch?.name || 'Kênh',
        courseCode: ch?.courseCode || null,
        type: ch?.type || 'CLASS',
        n,
      };
    });

    res.json({
      users,
      lockedUsers,
      channels,
      archivedChannels,
      messages: messagesCount,
      messagesToday,
      files: filesCount,
      filesSize: filesSizeAgg._sum.size || 0,
      online: onlineUsers.size,
      pushSubscriptions: pushSubscriptionsCount,
      messagesPerDay,
      topChannels,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Lỗi lấy dữ liệu thống kê' });
  }
});

app.get('/api/admin/overview', requireAuth, async (_req, res) => {
  const [usersCount, channelsCount, messagesCount] = await Promise.all([
    prisma.user.count(),
    prisma.channel.count(),
    prisma.message.count(),
  ]);
  res.json({
    usersCount,
    channelsCount,
    messagesCount,
    onlineCount: onlineUsers.size,
  });
});

app.get('/api/admin/users', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Chỉ quản trị viên mới có quyền xem danh sách tài khoản' });
  }

  const q = ((req.query.q as string) || '').trim();
  const role = req.query.role as any;
  const locked = req.query.locked === 'true' ? true : req.query.locked === 'false' ? false : undefined;
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize as string, 10) || 15));

  const where: any = {};
  if (role) where.role = role;
  if (locked !== undefined) where.locked = locked;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { studentCode: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [total, userList] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: {
          select: { messages: true, memberships: true },
        },
      },
    }),
  ]);

  const users = userList.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    studentCode: u.studentCode,
    avatar: u.avatar,
    locked: u.locked,
    lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    online: onlineUsers.has(u.id),
    _count: u._count,
  }));

  res.json({ users, total, pageSize });
});

app.post('/api/admin/users', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Chỉ quản trị viên mới có quyền tạo người dùng' });
  }
  const { name, email, role, studentCode, password } = req.body;
  const pw = password || 'KhoaChat@123';
  const user = await prisma.user.create({
    data: {
      name,
      email,
      role: role || 'STUDENT',
      studentCode: studentCode || null,
      password: hashPassword(pw),
    },
  });
  res.json({ user, password: pw });
});

app.post('/api/admin/users/:id/reset-password', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Chỉ quản trị viên mới có quyền đặt lại mật khẩu' });
  }

  const randomChars = Math.random().toString(36).slice(-6);
  const newPassword = `Khoa@${randomChars}`;

  await prisma.user.update({
    where: { id: req.params.id },
    data: { password: hashPassword(newPassword) },
  });

  res.json({ password: newPassword });
});

app.patch('/api/admin/users/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Chỉ quản trị viên mới có quyền chỉnh sửa tài khoản' });
  }
  const { name, email, role, studentCode, locked } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      name: name !== undefined ? name : undefined,
      email: email !== undefined ? email : undefined,
      role: role !== undefined ? role : undefined,
      studentCode: studentCode !== undefined ? studentCode : undefined,
      locked: locked !== undefined ? locked : undefined,
    },
  });
  if (locked) {
    io.to(`user:${user.id}`).emit('session:revoked');
  }
  res.json({ user });
});

app.post('/api/admin/users/import', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Chỉ quản trị viên mới có quyền nhập tài khoản' });
  }
  const { csv, defaultPassword, channelId } = req.body;
  if (!csv) return res.status(400).json({ error: 'Nội dung CSV rỗng' });

  const lines = (csv as string).split('\n').map((l) => l.trim()).filter(Boolean);
  let created = 0;
  let addedToChannel = 0;
  const skipped: any[] = [];
  const pw = defaultPassword || 'SinhVien@123';

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(/[,;]/).map((p) => p.trim());
    if (i === 0 && parts[0].toLowerCase().includes('email')) continue; // header
    const [email, name, studentCode] = parts;
    if (!email || !name) {
      skipped.push({ line: i + 1, email: email || 'unknown', reason: 'Thiếu email hoặc tên' });
      continue;
    }
    try {
      let u = await prisma.user.findUnique({ where: { email } });
      if (!u) {
        u = await prisma.user.create({
          data: {
            email,
            name,
            studentCode: studentCode || null,
            role: 'STUDENT',
            password: hashPassword(pw),
          },
        });
        created++;
      }
      if (channelId) {
        await prisma.channelMember.upsert({
          where: { channelId_userId: { channelId, userId: u.id } },
          create: { channelId, userId: u.id, role: 'MEMBER' },
          update: {},
        });
        addedToChannel++;
      }
    } catch (e: any) {
      skipped.push({ line: i + 1, email, reason: e.message });
    }
  }

  res.json({ created, skipped, addedToChannel });
});

app.get('/api/admin/channels', requireAuth, async (req: AuthenticatedRequest, res) => {
  const type = req.query.type as string | undefined;
  const archived = req.query.archived === 'true' ? true : req.query.archived === 'false' ? false : undefined;
  const q = ((req.query.q as string) || '').trim();

  let where: any = {};
  if (type) where.type = type;
  if (archived !== undefined) where.archived = archived;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { courseCode: { contains: q, mode: 'insensitive' } },
    ];
  }

  // Nếu người gọi là LECTURER, chỉ hiện các kênh họ quản lý hoặc làm thành viên
  if (req.user!.role === 'LECTURER') {
    where.members = { some: { userId: req.user!.id } };
  }

  const rawChannels = await prisma.channel.findMany({
    where,
    include: {
      members: { include: { user: true } },
      _count: { select: { messages: true, members: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const channels = rawChannels.map((c) => ({
    id: c.id,
    type: c.type,
    name: c.name,
    courseCode: c.courseCode,
    description: c.description,
    archived: c.archived,
    createdAt: c.createdAt.toISOString(),
    memberCount: c._count.members,
    messageCount: c._count.messages,
    managers: c.members
      .filter((m) => m.role === 'OWNER' || m.role === 'MODERATOR')
      .map((m) => ({ id: m.user.id, name: m.user.name, role: m.role })),
  }));

  res.json({ channels });
});

app.post('/api/admin/channels', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { type, name, courseCode, description, ownerIds, addAllUsers } = req.body;
  const channel = await prisma.channel.create({
    data: {
      type: type || 'CLASS',
      name,
      courseCode: courseCode || null,
      description: description || null,
      members: {
        create: [
          { userId: req.user!.id, role: 'OWNER' },
          ...(ownerIds || []).filter((id: string) => id !== req.user!.id).map((id: string) => ({ userId: id, role: 'OWNER' })),
        ],
      },
    },
  });

  if (addAllUsers) {
    const allUsers = await prisma.user.findMany({ where: { locked: false }, select: { id: true } });
    for (const u of allUsers) {
      await prisma.channelMember.upsert({
        where: { channelId_userId: { channelId: channel.id, userId: u.id } },
        create: { channelId: channel.id, userId: u.id, role: 'MEMBER' },
        update: {},
      }).catch(() => {});
    }
  }

  const ch = await getFormattedChannel(channel.id, req.user!.id, req.user!.role);
  res.json({ channel: ch });
});

app.patch('/api/admin/channels/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { name, description, courseCode, archived } = req.body;
  const updated = await prisma.channel.update({
    where: { id: req.params.id },
    data: {
      name: name !== undefined ? name : undefined,
      description: description !== undefined ? description : undefined,
      courseCode: courseCode !== undefined ? courseCode : undefined,
      archived: archived !== undefined ? archived : undefined,
    },
  });
  io.to(`channel:${updated.id}`).emit('channel:changed', { channelId: updated.id });
  const ch = await getFormattedChannel(updated.id, req.user!.id, req.user!.role);
  res.json({ channel: ch });
});

app.delete('/api/admin/channels/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const channel = await prisma.channel.findUnique({
    where: { id: req.params.id },
    include: { members: true },
  });
  if (!channel) return res.status(404).json({ error: 'Kênh không tồn tại' });

  const myMembership = channel.members.find((m) => m.userId === req.user!.id);
  const canDelete = req.user!.role === 'ADMIN' || myMembership?.role === 'OWNER';
  if (!canDelete) {
    return res.status(403).json({ error: 'Chỉ chủ nhóm hoặc quản trị viên mới có quyền giải tán nhóm' });
  }

  // Kênh thông báo khoa & kênh lớp học phần chỉ ADMIN mới được xoá
  if ((channel.type === 'ANNOUNCEMENT' || channel.type === 'CLASS') && req.user!.role !== 'ADMIN') {
    return res.status(403).json({
      error: `Kênh ${channel.type === 'ANNOUNCEMENT' ? 'thông báo khoa' : 'lớp học phần'} chỉ có quản trị viên hệ thống mới được phép giải tán`,
    });
  }

  const messageCount = await prisma.message.count({ where: { channelId: channel.id } });
  if (messageCount > 0) {
    return res.status(409).json({ error: 'Kênh còn tin nhắn, hãy dùng lưu trữ (archive) thay vì xóa' });
  }

  // Xoá cấu hình cấm chat của kênh nếu có
  channelChatLocked.delete(channel.id);
  for (const k of Array.from(mutedMembers)) {
    if (k.startsWith(`${channel.id}:`)) mutedMembers.delete(k);
  }
  saveModerationData();

  await prisma.channel.delete({ where: { id: req.params.id } });
  io.to(`channel:${req.params.id}`).emit('channel:removed', { channelId: req.params.id });
  io.emit('channel:removed', { channelId: req.params.id });
  res.json({ ok: true });
});

// Tra cứu người dùng cho việc gán quản lý / tạo kênh
app.get('/api/admin/user-lookup', requireAuth, async (req: AuthenticatedRequest, res) => {
  const q = ((req.query.q as string) || '').trim();
  const role = req.query.role as any;
  let where: any = { locked: false };
  if (role) where.role = role;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { studentCode: { contains: q, mode: 'insensitive' } },
    ];
  }
  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true, studentCode: true, avatar: true },
    take: 30,
    orderBy: { name: 'asc' },
  });
  res.json({ users });
});

// Quản lý thành viên kênh (Dùng cho cả Admin và Chủ/Quản lý kênh trong thanh bên)
app.get('/api/admin/channels/:id/members', requireAuth, async (req: AuthenticatedRequest, res) => {
  const channel = await prisma.channel.findUnique({
    where: { id: req.params.id },
    include: {
      members: {
        include: { user: true },
        orderBy: { user: { name: 'asc' } },
      },
    },
  });
  if (!channel) return res.status(404).json({ error: 'Kênh không tồn tại' });

  const myMembership = channel.members.find((m) => m.userId === req.user!.id);
  const canManage = req.user!.role === 'ADMIN' || myMembership?.role === 'OWNER' || myMembership?.role === 'MODERATOR' || req.user!.role === 'LECTURER';
  if (!canManage) {
    return res.status(403).json({ error: 'Bạn không có quyền xem hoặc quản lý thành viên kênh này' });
  }

  const members = channel.members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.user.role,
    studentCode: m.user.studentCode,
    avatar: m.user.avatar,
    locked: m.user.locked,
    memberRole: m.role,
    isMuted: mutedMembers.has(`${channel.id}:${m.user.id}`),
  }));

  res.json({
    channel: {
      id: channel.id,
      name: channel.name,
      courseCode: channel.courseCode,
      type: channel.type,
      createdById: null,
      isChannelLocked: channelChatLocked.has(channel.id),
      canManage,
    },
    members,
  });
});

// Cấm chat / Mở cấm chat cho 1 thành viên
app.post('/api/channels/:id/mute/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const channel = await prisma.channel.findUnique({
    where: { id: req.params.id },
    include: { members: { include: { user: true } } },
  });
  if (!channel) return res.status(404).json({ error: 'Kênh không tồn tại' });

  const myMembership = channel.members.find((m) => m.userId === req.user!.id);
  const canManage = req.user!.role === 'ADMIN' || myMembership?.role === 'OWNER' || myMembership?.role === 'MODERATOR';
  if (!canManage) {
    return res.status(403).json({ error: 'Bạn không có quyền cấm chat thành viên trong kênh này' });
  }

  const targetMember = channel.members.find((m) => m.userId === req.params.userId);
  if (!targetMember) return res.status(404).json({ error: 'Thành viên không có trong kênh' });

  if (targetMember.role === 'OWNER' || targetMember.user.role === 'ADMIN') {
    return res.status(400).json({ error: 'Không thể cấm chat chủ kênh hoặc quản trị viên' });
  }

  const key = `${channel.id}:${req.params.userId}`;
  const currentlyMuted = mutedMembers.has(key);
  if (currentlyMuted) {
    mutedMembers.delete(key);
  } else {
    mutedMembers.add(key);
  }
  saveModerationData();

  const sysContent = currentlyMuted
    ? `${req.user!.name} đã mở cấm chat cho ${targetMember.user.name}`
    : `${req.user!.name} đã cấm chat thành viên ${targetMember.user.name}`;

  const sysMsg = await prisma.message.create({
    data: {
      clientId: crypto.randomUUID(),
      channelId: channel.id,
      senderId: req.user!.id,
      type: 'SYSTEM',
      content: `📢 [Hệ thống] ${sysContent}`,
    },
    include: { sender: true, attachments: true, replyTo: true, mentions: true },
  });

  io.to(`channel:${channel.id}`).emit('message:new', { ...formatMessage(sysMsg), ackUserIds: [req.user!.id] });
  io.to(`channel:${channel.id}`).emit('channel:changed', { channelId: channel.id });
  io.to(`user:${req.params.userId}`).emit('channel:changed', { channelId: channel.id });

  res.json({ ok: true, muted: !currentlyMuted });
});

// Khoá chat / Mở chat toàn bộ nhóm
app.post('/api/channels/:id/lock-chat', requireAuth, async (req: AuthenticatedRequest, res) => {
  const channel = await prisma.channel.findUnique({
    where: { id: req.params.id },
    include: { members: true },
  });
  if (!channel) return res.status(404).json({ error: 'Kênh không tồn tại' });

  const myMembership = channel.members.find((m) => m.userId === req.user!.id);
  const canManage = req.user!.role === 'ADMIN' || myMembership?.role === 'OWNER' || myMembership?.role === 'MODERATOR';
  if (!canManage) {
    return res.status(403).json({ error: 'Bạn không có quyền khoá/mở chat kênh này' });
  }

  const currentlyLocked = channelChatLocked.has(channel.id);
  if (currentlyLocked) {
    channelChatLocked.delete(channel.id);
  } else {
    channelChatLocked.add(channel.id);
  }
  saveModerationData();

  const sysContent = currentlyLocked
    ? `${req.user!.name} đã mở lại chat nhóm cho tất cả thành viên`
    : `${req.user!.name} đã bật chế độ cấm chat nhóm (chỉ quản lý mới được gửi tin)`;

  const sysMsg = await prisma.message.create({
    data: {
      clientId: crypto.randomUUID(),
      channelId: channel.id,
      senderId: req.user!.id,
      type: 'SYSTEM',
      content: `🔒 [Hệ thống] ${sysContent}`,
    },
    include: { sender: true, attachments: true, replyTo: true, mentions: true },
  });

  io.to(`channel:${channel.id}`).emit('message:new', { ...formatMessage(sysMsg), ackUserIds: [req.user!.id] });
  io.to(`channel:${channel.id}`).emit('channel:changed', { channelId: channel.id });

  res.json({ ok: true, locked: !currentlyLocked });
});

app.post('/api/admin/channels/:id/members', requireAuth, async (req: AuthenticatedRequest, res) => {
  const channel = await prisma.channel.findUnique({
    where: { id: req.params.id },
    include: { members: true },
  });
  if (!channel) return res.status(404).json({ error: 'Kênh không tồn tại' });

  const myMembership = channel.members.find((m) => m.userId === req.user!.id);
  const canManage = req.user!.role === 'ADMIN' || myMembership?.role === 'OWNER' || myMembership?.role === 'MODERATOR' || req.user!.role === 'LECTURER';
  if (!canManage) {
    return res.status(403).json({ error: 'Bạn không có quyền thêm thành viên' });
  }

  const { userIds = [], identifiers = [] } = req.body;
  let added = 0;
  let alreadyMember = 0;
  const notFound: string[] = [];

  const currentMemberSet = new Set(channel.members.map((m) => m.userId));

  if (Array.isArray(userIds)) {
    for (const uid of userIds) {
      if (currentMemberSet.has(uid)) {
        alreadyMember++;
        continue;
      }
      const u = await prisma.user.findUnique({ where: { id: uid } });
      if (!u) {
        notFound.push(uid);
        continue;
      }
      await prisma.channelMember.create({
        data: { channelId: channel.id, userId: uid, role: 'MEMBER' },
      });
      currentMemberSet.add(uid);
      added++;
      io.to(`user:${uid}`).emit('channel:changed', { channelId: channel.id });
    }
  }

  if (Array.isArray(identifiers)) {
    for (const ident of identifiers) {
      const trimmed = String(ident).trim();
      if (!trimmed) continue;
      const u = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: trimmed, mode: 'insensitive' } },
            { studentCode: { equals: trimmed, mode: 'insensitive' } },
          ],
        },
      });
      if (!u) {
        notFound.push(trimmed);
        continue;
      }
      if (currentMemberSet.has(u.id)) {
        alreadyMember++;
        continue;
      }
      await prisma.channelMember.create({
        data: { channelId: channel.id, userId: u.id, role: 'MEMBER' },
      });
      currentMemberSet.add(u.id);
      added++;
      io.to(`user:${u.id}`).emit('channel:changed', { channelId: channel.id });
    }
  }

  io.to(`channel:${channel.id}`).emit('channel:changed', { channelId: channel.id });

  res.json({ added, alreadyMember, notFound });
});

app.patch('/api/admin/channels/:id/members/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const channel = await prisma.channel.findUnique({
    where: { id: req.params.id },
    include: { members: true },
  });
  if (!channel) return res.status(404).json({ error: 'Kênh không tồn tại' });

  const myMembership = channel.members.find((m) => m.userId === req.user!.id);
  const canManage = req.user!.role === 'ADMIN' || myMembership?.role === 'OWNER';
  if (!canManage) {
    return res.status(403).json({ error: 'Bạn không có quyền đổi vai trò thành viên' });
  }

  const { role } = req.body;
  if (!role || !['OWNER', 'MODERATOR', 'MEMBER'].includes(role)) {
    return res.status(400).json({ error: 'Vai trò không hợp lệ' });
  }

  await prisma.channelMember.update({
    where: {
      channelId_userId: {
        channelId: req.params.id,
        userId: req.params.userId,
      },
    },
    data: { role },
  });

  io.to(`channel:${req.params.id}`).emit('channel:changed', { channelId: req.params.id });
  io.to(`user:${req.params.userId}`).emit('channel:changed', { channelId: req.params.id });
  res.json({ ok: true });
});

app.delete('/api/admin/channels/:id/members/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const channel = await prisma.channel.findUnique({
    where: { id: req.params.id },
    include: { members: true },
  });
  if (!channel) return res.status(404).json({ error: 'Kênh không tồn tại' });

  const myMembership = channel.members.find((m) => m.userId === req.user!.id);
  const canManage = req.user!.role === 'ADMIN' || myMembership?.role === 'OWNER' || myMembership?.role === 'MODERATOR';
  if (!canManage) {
    return res.status(403).json({ error: 'Bạn không có quyền xoá thành viên khỏi kênh này' });
  }

  await prisma.channelMember.deleteMany({
    where: {
      channelId: req.params.id,
      userId: req.params.userId,
    },
  });

  io.to(`channel:${req.params.id}`).emit('channel:changed', { channelId: req.params.id });
  io.to(`user:${req.params.userId}`).emit('channel:removed', { channelId: req.params.id });
  res.json({ ok: true });
});

// Liên kết mời & tham gia kênh (Invite / Join)
const channelInviteTokens = new Map<string, string>(); // channelId -> token
const inviteTokenToChannel = new Map<string, string>(); // token -> channelId

app.get('/api/admin/channels/:id/invite', requireAuth, async (req: AuthenticatedRequest, res) => {
  const token = channelInviteTokens.get(req.params.id);
  const host = req.get('host') || 'localhost:5173';
  const origin = req.headers.origin || `${req.protocol}://${host}`;
  res.json({
    active: !!token,
    url: token ? `${origin}/#/join/${token}` : '',
  });
});

app.post('/api/admin/channels/:id/invite', requireAuth, async (req: AuthenticatedRequest, res) => {
  const channel = await prisma.channel.findUnique({ where: { id: req.params.id } });
  if (!channel) return res.status(404).json({ error: 'Kênh không tồn tại' });

  const token = crypto.randomBytes(32).toString('base64url');
  const old = channelInviteTokens.get(channel.id);
  if (old) inviteTokenToChannel.delete(old);

  channelInviteTokens.set(channel.id, token);
  inviteTokenToChannel.set(token, channel.id);

  const host = req.get('host') || 'localhost:5173';
  const origin = req.headers.origin || `${req.protocol}://${host}`;
  const url = `${origin}/#/join/${token}`;
  res.json({ ok: true, url });
});

app.delete('/api/admin/channels/:id/invite', requireAuth, async (req: AuthenticatedRequest, res) => {
  const token = channelInviteTokens.get(req.params.id);
  if (token) {
    inviteTokenToChannel.delete(token);
    channelInviteTokens.delete(req.params.id);
  }
  res.json({ ok: true });
});

app.post('/api/channels/join/:token', requireAuth, async (req: AuthenticatedRequest, res) => {
  const token = req.params.token;
  const channelId = inviteTokenToChannel.get(token);
  if (!channelId) {
    return res.status(404).json({ error: 'Liên kết mời không tồn tại hoặc đã hết hạn' });
  }
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) {
    return res.status(404).json({ error: 'Kênh không tồn tại' });
  }

  await prisma.channelMember.upsert({
    where: { channelId_userId: { channelId: channel.id, userId: req.user!.id } },
    create: { channelId: channel.id, userId: req.user!.id, role: 'MEMBER' },
    update: {},
  });

  io.to(`channel:${channel.id}`).emit('channel:changed', { channelId: channel.id });
  io.to(`user:${req.user!.id}`).emit('channel:changed', { channelId: channel.id });
  res.json({ channel: { id: channel.id } });
});

// Bảo mật thư mục tải lên: Tuyệt đối KHÔNG phục vụ static tự do /uploads.
// Tách biệt hoàn toàn thư mục uploads/avatars công khai và uploads/attachments riêng tư.
// Mọi tệp đính kèm bắt buộc phải tải qua /api/files/:id có xác thực quyền thành viên kênh.
app.get('/uploads/avatars/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_AVATAR_EXTENSIONS.has(ext)) {
    return res.status(403).send('Chỉ hỗ trợ xem ảnh đại diện định dạng an toàn (JPG, PNG, WebP, GIF)');
  }
  const filePath = path.join(AVATAR_DIR, filename);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return res.status(404).send('Không tìm thấy tệp');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.sendFile(filePath);
});

// Chặn truy cập tệp đính kèm qua đường dẫn /uploads/:filename
// Chỉ phục vụ ảnh đại diện hợp lệ nếu có và tuyệt đối từ chối tệp đính kèm
app.get('/uploads/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_AVATAR_EXTENSIONS.has(ext)) {
    return res.status(403).send('Truy cập tệp đính kèm bắt buộc qua /api/files/:id có xác thực quyền thành viên');
  }

  // Nếu file này nằm trong thư mục attachments, từ chối ngay lập tức
  const attachPath = path.join(ATTACHMENT_DIR, filename);
  if (fs.existsSync(attachPath)) {
    return res.status(403).send('Truy cập tệp đính kèm bắt buộc qua /api/files/:id có xác thực quyền thành viên');
  }

  // Chỉ phục vụ nếu tồn tại trong AVATAR_DIR hoặc thư mục uploads gốc (ảnh avatar cũ)
  let filePath = path.join(AVATAR_DIR, filename);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(UPLOAD_DIR, filename);
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return res.status(404).send('Không tìm thấy tệp');
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.sendFile(filePath);
});

// ==========================================
// 3. SOCKET.IO REALTIME
// ==========================================
const onlineUsers = new Set<string>();

io.use((socket: Socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Chưa xác thực'));
  const user = verifyToken(token);
  if (!user) return next(new Error('Token không hợp lệ'));
  (socket as any).user = user;
  next();
});

io.on('connection', (socket: Socket) => {
  const user: AuthUser = (socket as any).user;
  onlineUsers.add(user.id);

  socket.join(`user:${user.id}`);

  // Gia nhập các phòng kênh và xử lý presence trong background để không chặn đăng ký listener
  (async () => {
    try {
      const memberships = await prisma.channelMember.findMany({
        where: { userId: user.id },
        select: { channelId: true },
      });
      memberships.forEach((m) => socket.join(`channel:${m.channelId}`));

      for (const m of memberships) {
        try {
          const latestMsg = await prisma.message.findFirst({
            where: { channelId: m.channelId },
            orderBy: { seq: 'desc' },
            select: { seq: true },
          });
          if (latestMsg && latestMsg.seq > getDeliveredSeq(m.channelId, user.id)) {
            setDeliveredSeq(m.channelId, user.id, latestMsg.seq);
            io.to(`channel:${m.channelId}`).emit('message:received', {
              channelId: m.channelId,
              userId: user.id,
              maxSeq: latestMsg.seq,
            });
          }
        } catch {
          // Bỏ qua lỗi truy vấn phụ
        }
      }

      io.emit('presence', { userId: user.id, online: true });
    } catch {
      // Bỏ qua lỗi kết nối nền
    }
  })();

  // 1. Gửi tin nhắn
  socket.on('message:send', async (data, ack) => {
    try {
      const { channelId, clientId, content, replyToId, attachmentIds, mentionIds } = data;
      if (!channelId) return ack?.({ ok: false, error: 'Thiếu channelId' });

      // Chống gửi trùng lặp theo clientId (Idempotency)
      if (clientId) {
        const existing = await prisma.message.findUnique({
          where: { clientId },
          include: {
            sender: true,
            attachments: true,
            replyTo: { include: { sender: true, attachments: true } },
            mentions: { include: { user: true } },
          },
        });
        if (existing) {
          return ack?.({ ok: true, duplicate: true, message: formatMessage(existing) });
        }
      }

      // Kiểm tra quyền thành viên và vai trò trong kênh tập trung (RBAC)
      const access = await checkChannelAccess(channelId, user.id, user.role);
      if (!access.channel) return ack?.({ ok: false, error: 'Kênh không tồn tại' });

      if (!access.canPost) {
        let errMsg = 'Bạn không có quyền gửi tin trong kênh này';
        if (access.channel.type === 'ANNOUNCEMENT' && user.role === 'STUDENT') {
          errMsg = 'Chỉ giảng viên/quản trị viên mới được đăng thông báo';
        } else if (mutedMembers.has(`${channelId}:${user.id}`)) {
          errMsg = 'Bạn đã bị cấm chat trong nhóm này';
        } else if (channelChatLocked.has(channelId)) {
          errMsg = 'Nhóm đang bật chế độ cấm chat, chỉ quản lý mới được gửi tin';
        }
        return ack?.({ ok: false, error: errMsg, code: 'FORBIDDEN' });
      }
      if (!consumeMessageRateLimit(user.id)) {
        return ack?.({ ok: false, error: 'Bạn đã gửi quá 30 tin trong 1 phút, vui lòng thử lại sau', code: 'RATE_LIMITED' });
      }

      // Kiểm tra tệp đính kèm: tệp phải thuộc đúng kênh này
      if (attachmentIds?.length) {
        const validAttCount = await prisma.attachment.count({
          where: {
            id: { in: attachmentIds },
            channelId,
          },
        });
        if (validAttCount !== attachmentIds.length) {
          return ack?.({ ok: false, error: 'Tệp đính kèm không hợp lệ hoặc không thuộc kênh này', code: 'FORBIDDEN' });
        }
      }

      // Tạo tin nhắn + liên kết file + @mention trong một transaction để đảm bảo toàn vẹn dữ liệu
      const msg = await prisma.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: {
            clientId,
            channelId,
            senderId: user.id,
            content: content || '',
            replyToId: replyToId || null,
          },
          include: {
            sender: true,
            attachments: true,
            replyTo: { include: { sender: true, attachments: true } },
            mentions: { include: { user: true } },
          },
        });

        // Liên kết attachments nếu có
        if (attachmentIds?.length) {
          await tx.attachment.updateMany({
            where: { id: { in: attachmentIds } },
            data: { messageId: created.id },
          });
        }

        // Tạo mentions nếu có
        if (mentionIds?.length) {
          for (const uid of mentionIds) {
            await tx.mention.create({
              data: { messageId: created.id, userId: uid },
            }).catch(() => {});
          }
        }

        return created;
      });

      // Tự động đánh dấu người gửi đã đọc tin nhắn của chính mình
      await prisma.channelMember.updateMany({
        where: { channelId, userId: user.id, lastReadSeq: { lt: msg.seq } },
        data: {
          lastReadSeq: msg.seq,
          lastReadMessageId: msg.id,
          lastReadAt: new Date(),
        },
      });

      const fullMsg = await prisma.message.findUnique({
        where: { id: msg.id },
        include: {
          sender: true,
          attachments: true,
          replyTo: { include: { sender: true, attachments: true } },
          mentions: { include: { user: true } },
        },
      });

      // Kiểm tra xem trong kênh có thành viên nào đang online (có kết nối internet & socket) không
      const chMembers = await prisma.channelMember.findMany({
        where: { channelId },
        select: { userId: true },
      });
      const onlineRecipients = chMembers
        .map((mb) => mb.userId)
        .filter((uid) => uid !== user.id && onlineUsers.has(uid));

      // Những người đang online nhận được tin nhắn ngay lập tức qua socket -> đánh dấu 2 dấu tích
      onlineRecipients.forEach((uid) => setDeliveredSeq(channelId, uid, msg.seq));

      const ackUserIds = [user.id, ...onlineRecipients];

      const formatted = {
        ...formatMessage(fullMsg || msg),
        ackUserIds,
      };
      io.to(`channel:${channelId}`).emit('message:new', formatted);
      ack?.({ ok: true, message: formatted });
    } catch (err: any) {
      ack?.({ ok: false, error: err.message || 'Lỗi gửi tin' });
    }
  });

  // 2. Thu hồi / Xoá tin nhắn
  socket.on('message:delete', async ({ messageId }, ack) => {
    try {
      const msg = await prisma.message.findUnique({ where: { id: messageId } });
      if (!msg) return ack?.({ ok: false, error: 'Tin nhắn không tồn tại' });
      if (msg.senderId !== user.id && user.role === 'STUDENT') {
        return ack?.({ ok: false, error: 'Bạn không có quyền xoá tin này' });
      }

      const updated = await prisma.message.update({
        where: { id: messageId },
        data: { deletedAt: new Date() },
        include: {
          sender: true,
          attachments: true,
          replyTo: { include: { sender: true, attachments: true } },
          mentions: { include: { user: true } },
        },
      });

      const formatted = formatMessage(updated);
      io.to(`channel:${msg.channelId}`).emit('message:updated', formatted);
      ack?.({ ok: true, message: formatted });
    } catch (err: any) {
      ack?.({ ok: false, error: err.message });
    }
  });

  // 3. Sửa tin nhắn
  socket.on('message:edit', async ({ messageId, content }, ack) => {
    try {
      const msg = await prisma.message.findUnique({ where: { id: messageId } });
      if (!msg || msg.senderId !== user.id) {
        return ack?.({ ok: false, error: 'Bạn chỉ có thể sửa tin của mình' });
      }

      const updated = await prisma.message.update({
        where: { id: messageId },
        data: { content, editedAt: new Date() },
        include: {
          sender: true,
          attachments: true,
          replyTo: { include: { sender: true, attachments: true } },
          mentions: { include: { user: true } },
        },
      });

      const formatted = formatMessage(updated);
      io.to(`channel:${msg.channelId}`).emit('message:updated', formatted);
      ack?.({ ok: true, message: formatted });
    } catch (err: any) {
      ack?.({ ok: false, error: err.message });
    }
  });

  // 4. Ghim tin nhắn (Kiểm tra quyền ghim của kênh)
  socket.on('message:pin', async ({ messageId, pinned }, ack) => {
    try {
      const msg = await prisma.message.findUnique({ where: { id: messageId } });
      if (!msg) return ack?.({ ok: false, error: 'Tin nhắn không tồn tại' });

      const access = await checkChannelAccess(msg.channelId, user.id, user.role);
      if (!access.canView || !access.canPin) {
        return ack?.({ ok: false, error: 'Bạn không có quyền ghim tin nhắn trong kênh này', code: 'FORBIDDEN' });
      }

      const updated = await prisma.message.update({
        where: { id: messageId },
        data: {
          pinned,
          pinnedAt: pinned ? new Date() : null,
          pinnedById: pinned ? user.id : null,
        },
        include: {
          sender: true,
          attachments: true,
          replyTo: { include: { sender: true, attachments: true } },
          mentions: { include: { user: true } },
        },
      });

      const formatted = formatMessage(updated);
      io.to(`channel:${updated.channelId}`).emit('message:updated', formatted);
      ack?.({ ok: true, message: formatted });
    } catch (err: any) {
      ack?.({ ok: false, error: err.message });
    }
  });

  // 5. Xác nhận đã đọc thông báo ("Tôi đã đọc" - Dùng ChannelMember.lastReadSeq)
  socket.on('message:ack', async ({ messageId }, ack) => {
    try {
      const msg = await prisma.message.findUnique({ where: { id: messageId } });
      if (!msg) return ack?.({ ok: false, error: 'Tin nhắn không tồn tại' });

      const access = await checkChannelAccess(msg.channelId, user.id, user.role);
      if (!access.canView) {
        return ack?.({ ok: false, error: 'Bạn không có quyền trong kênh này', code: 'FORBIDDEN' });
      }

      await prisma.channelMember.updateMany({
        where: { channelId: msg.channelId, userId: user.id },
        data: {
          lastReadSeq: msg.seq,
          lastReadMessageId: msg.id,
          lastReadAt: new Date(),
        },
      });

      const readMembers = await prisma.channelMember.findMany({
        where: { channelId: msg.channelId, lastReadSeq: { gte: msg.seq } },
        select: { userId: true },
      });

      const updated = await prisma.message.findUnique({
        where: { id: messageId },
        include: {
          sender: true,
          attachments: true,
          replyTo: { include: { sender: true, attachments: true } },
          mentions: { include: { user: true } },
        },
      });

      const formatted = {
        ...formatMessage(updated),
        ackUserIds: readMembers.map((r) => r.userId),
      };
      io.to(`channel:${msg.channelId}`).emit('message:updated', formatted);
      ack?.({ ok: true, message: formatted });
    } catch (err: any) {
      ack?.({ ok: false, error: err.message });
    }
  });

  // 5b. Xác nhận đã nhận tin nhắn qua socket (cập nhật 2 dấu tích realtime)
  socket.on('message:received', ({ channelId, maxSeq }: { channelId: string; maxSeq: number }) => {
    if (!channelId || !maxSeq) return;
    setDeliveredSeq(channelId, user.id, maxSeq);

    io.to(`channel:${channelId}`).emit('message:received', {
      channelId,
      userId: user.id,
      maxSeq,
    });
  });

  // 6. Đánh dấu đã đọc kênh (kiểm tra quyền thành viên)
  socket.on('channel:read', async (data: any, ack) => {
    try {
      const channelId = data?.channelId;
      const messageId = data?.messageId;
      if (!channelId) return ack?.({ ok: false, error: 'Thiếu channelId' });

      const access = await checkChannelAccess(channelId, user.id, user.role);
      if (!access.channel) return ack?.({ ok: false, error: 'Kênh không tồn tại' });
      if (!access.canView) {
        return ack?.({ ok: false, error: 'Bạn không có quyền truy cập kênh này', code: 'FORBIDDEN' });
      }

      let lastSeq = data?.maxSeq || data?.seq || 0;
      if (messageId) {
        const msg = await prisma.message.findUnique({ where: { id: messageId } });
        if (!msg || msg.channelId !== channelId) {
          return ack?.({ ok: false, error: 'Tin nhắn không thuộc kênh được chỉ định', code: 'INVALID_MESSAGE' });
        }
        if (msg.seq) lastSeq = Math.max(lastSeq, msg.seq);
      }

      await prisma.channelMember.updateMany({
        where: { channelId, userId: user.id, lastReadSeq: { lt: lastSeq } },
        data: {
          lastReadMessageId: messageId || null,
          lastReadSeq: lastSeq,
          lastReadAt: new Date(),
        },
      });

      const currentMember = await prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId, userId: user.id } },
      });
      lastSeq = currentMember?.lastReadSeq || 0;
      const effectiveMessageId = currentMember?.lastReadSeq === lastSeq
        ? currentMember.lastReadMessageId
        : null;
      setDeliveredSeq(channelId, user.id, lastSeq);

      const st = { channelId, messageId: effectiveMessageId || null, seq: lastSeq, userId: user.id, at: new Date().toISOString() };
      io.to(`channel:${channelId}`).emit('channel:read', st);
      io.to(`user:${user.id}`).emit('channel:read', st);
      ack?.({ ok: true, ...st });
    } catch {
      ack?.({ ok: false });
    }
  });

  // 7. Đang soạn tin (Typing)
  socket.on('typing', ({ channelId, isTyping }) => {
    socket.to(`channel:${channelId}`).emit('typing', {
      channelId,
      userId: user.id,
      name: user.name,
      isTyping,
    });
  });

  socket.on('disconnect', async () => {
    onlineUsers.delete(user.id);
    io.emit('presence', { userId: user.id, online: false });

    // Cập nhật thời điểm trực tuyến lần cuối (last seen)
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    }).catch(() => {});

  });
});

server.listen(PORT, () => {
  console.log(`🚀 KhoaChat Server đang chạy tại cổng http://localhost:${PORT}`);
});
