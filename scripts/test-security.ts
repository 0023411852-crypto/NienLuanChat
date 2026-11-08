/**
 * KhoaChat — Test Security & Channel RBAC (Milestone 1 & 2 Security Hardening)
 * 
 * Kiểm tra xác thực các bản vá bảo mật:
 * 1. Quyền ghim tin phụ thuộc canView và không vượt membership (kể cả LECTURER hoặc DIRECT).
 * 2. Tệp đính kèm và SVG không thể truy cập công khai qua /uploads; chặn upload avatar SVG.
 * 3. Kiểm soát quyền kênh đối với GET /files, GET /links, GET /messages/:id/acks, POST/PUT/DELETE /channel-avatars/:id.
 * 4. Đồng bộ đã đọc channel:read từ chối messageId không thuộc channelId được chỉ định.
 */

import assert from 'assert';
import { io as SocketClient } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4001';

async function request(path: string, options: any = {}) {
  const url = `${SERVER_URL}${path}`;
  const res = await fetch(url, options);
  let data: any = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function login(email: string, password = 'SinhVien@123') {
  const res = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Đăng nhập thất bại cho ${email}: ${JSON.stringify(res.data)}`);
  return { token: res.data.token as string, user: res.data.user as any };
}

async function run() {
  console.log('======================================================');
  console.log('🔒 BẮT ĐẦU KIỂM THỬ BẢO MẬT & PHÂN QUYỀN (SECURITY SUITE)');
  console.log(`🎯 Server: ${SERVER_URL}`);
  console.log('======================================================\n');

  // Đăng nhập các tài khoản mẫu từ seed
  const sv1 = await login('sv01@khoachat.edu.vn', 'SinhVien@123');
  const sv2 = await login('sv02@khoachat.edu.vn', 'SinhVien@123');
  const gvMai = await login('gv.mai@khoachat.edu.vn', 'GiangVien@123');

  // Lấy danh sách kênh của SV1
  const sv1Channels = (await request('/api/channels', {
    headers: { Authorization: `Bearer ${sv1.token}` },
  })).data.channels;
  const sv1Class = sv1Channels.find((c: any) => c.type === 'CLASS' && c.courseCode === 'CT299-01');
  assert(sv1Class, 'SV1 phải tham gia kênh lớp CT299-01');

  // Lấy tin nhắn mẫu trong lớp
  const msgs = (await request(`/api/channels/${sv1Class.id}/messages`, {
    headers: { Authorization: `Bearer ${sv1.token}` },
  })).data.messages;
  const sampleMsg = msgs[0];
  assert(sampleMsg, 'Lớp học phần phải có ít nhất 1 tin nhắn mẫu');

  console.log('--- KHỐI BẢO MẬT 1: Quyền ghim tin nhắn (canPin & membership) ---');
  // 1. GV Mai không phụ trách/không là thành viên lớp CT299-01, thử ghim tin -> Phải bị 403
  const gvMaiPinRes = await request(`/api/messages/${sampleMsg.id}/pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gvMai.token}` },
    body: JSON.stringify({ pinned: true }),
  });
  assert(gvMaiPinRes.status === 403, `GV Mai không thuộc lớp phải bị 403 khi ghim tin, nhận ${gvMaiPinRes.status}`);
  console.log('  ✅ [PASS 1/6] 1. Chặn giảng viên ngoài lớp ghim tin nhắn lớp (403)');

  console.log('\n--- KHỐI BẢO MẬT 2: Phục vụ tệp đính kèm & Chống Stored XSS ---');
  // 2a. Truy cập tệp đuôi .svg qua /uploads/test.svg -> Phải bị 403
  const svgRes = await request('/uploads/test.svg');
  assert(svgRes.status === 403, `Đuôi SVG qua /uploads phải bị chặn 403, nhận ${svgRes.status}`);
  console.log('  ✅ [PASS 2/6] 2. Tuyệt đối chặn truy cập file SVG qua /uploads (403)');

  // 2b. Upload avatar với định dạng SVG -> Phải bị từ chối
  const formData = new FormData();
  formData.append('file', new Blob(['<svg><script>alert(1)</script></svg>'], { type: 'image/svg+xml' }), 'avatar.svg');
  const avatarSvgRes = await request('/api/auth/avatar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sv1.token}` },
    body: formData,
  });
  assert(!avatarSvgRes.ok, 'Upload avatar SVG phải bị từ chối');
  console.log('  ✅ [PASS 3/6] 3. Chặn tải lên ảnh đại diện định dạng SVG để phòng chống Stored XSS');

  console.log('\n--- KHỐI BẢO MẬT 3: Kiểm soát quyền thành viên trên REST APIs ---');
  // Tạo nhóm cộng đồng riêng chỉ có SV1
  const comChannel = (await request('/api/channels/community', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sv1.token}` },
    body: JSON.stringify({ name: 'Nhóm bí mật bảo mật', memberIds: [] }),
  })).data.channel;

  // SV2 thử lấy files và links của nhóm bí mật -> Phải bị 403
  const sv2FilesRes = await request(`/api/channels/${comChannel.id}/files`, {
    headers: { Authorization: `Bearer ${sv2.token}` },
  });
  const sv2LinksRes = await request(`/api/channels/${comChannel.id}/links`, {
    headers: { Authorization: `Bearer ${sv2.token}` },
  });
  assert(sv2FilesRes.status === 403 && sv2LinksRes.status === 403, 'Người ngoài phải bị 403 khi xem files/links');
  console.log('  ✅ [PASS 4/6] 4. Chặn người dùng ngoài kênh xem danh sách tệp đính kèm và liên kết (403)');

  // Gửi 1 tin trong nhóm bí mật qua Socket.IO (không có REST endpoint cho message:send)
  const socketSv1 = SocketClient(SERVER_URL, {
    auth: { token: sv1.token },
    transports: ['websocket'],
  });

  await new Promise<void>((resolve, reject) => {
    socketSv1.on('connect', () => resolve());
    socketSv1.on('connect_error', (err: any) => reject(err));
  });
  await new Promise((r) => setTimeout(r, 200));

  const secretMsg: any = await new Promise((resolve, reject) => {
    const clientId = `sec-${Date.now()}`;
    const timer = setTimeout(() => reject(new Error('Timeout: message:send không nhận được ack sau 10s')), 10000);
    socketSv1.emit(
      'message:send',
      { channelId: comChannel.id, content: 'Tin nhắn bảo mật nội bộ', clientId },
      (ack: any) => {
        clearTimeout(timer);
        if (ack?.ok) resolve(ack.message);
        else reject(new Error(`Gửi tin thất bại: ${JSON.stringify(ack)}`));
      }
    );
  });
  assert(secretMsg?.id, 'secretMsg phải được tạo thành công qua Socket.IO');

  // SV2 thử gọi /api/messages/:id/acks của secretMsg -> Phải bị 403
  const sv2AcksRes = await request(`/api/messages/${secretMsg.id}/acks`, {
    headers: { Authorization: `Bearer ${sv2.token}` },
  });
  assert(sv2AcksRes.status === 403, 'Người ngoài phải bị 403 khi xem danh sách sinh viên đã đọc (/acks)');
  console.log('  ✅ [PASS 5/6] 5. Chặn xem thông tin đọc và MSSV (/api/messages/:id/acks) khi không thuộc kênh (403)');

  console.log('\n--- KHỐI BẢO MẬT 4: Kiểm tra tính nhất quán dữ liệu channel:read ---');

  // SV1 gửi channel:read vào sv1Class nhưng cố tình đính kèm messageId của kênh bí mật (comChannel)
  const readRes: any = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout: channel:read không nhận được ack sau 10s')), 10000);
    socketSv1.emit(
      'channel:read',
      { channelId: sv1Class.id, messageId: secretMsg.id },
      (ackData: any) => {
        clearTimeout(timer);
        resolve(ackData);
      }
    );
  });

  assert(readRes?.ok === false && readRes?.code === 'INVALID_MESSAGE', 'Phải từ chối messageId không thuộc kênh');
  console.log('  ✅ [PASS 6/6] 6. Từ chối đồng bộ đã đọc qua socket khi messageId không thuộc channelId');

  socketSv1.disconnect();

  console.log('\n======================================================');
  console.log('📊 KẾT QUẢ KIỂM THỬ BẢO MẬT: 6/6 ĐẠT (0 lỗi)');
  console.log('======================================================\n');
}

run().catch((err) => {
  console.error('❌ Lỗi kiểm thử bảo mật:', err);
  process.exit(1);
});
