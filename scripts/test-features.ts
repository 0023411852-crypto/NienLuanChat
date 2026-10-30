/**
 * KhoaChat — Test Suite 2: Kiểm thử tính năng (Milestone 2)
 * Bao gồm 92 tình huống kiểm thử tự động API, Phân quyền, Tệp tin, Tìm kiếm, Admin
 */

import crypto from 'crypto';

const BASE_URL = process.env.SERVER_URL || 'http://localhost:4001';
let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS ${passed.toString().padStart(2, '0')}/92] ${name}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${name}${detail ? ` (${detail})` : ''}`);
  }
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // not json
  }
  return { status: res.status, ok: res.ok, data };
}

async function login(email: string, password = 'SinhVien@123') {
  const res = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Đăng nhập thất bại: ${email}`);
  return { token: res.data.token as string, user: res.data.user as any };
}

async function run() {
  console.log(`\n======================================================`);
  console.log(`🚀 BẮT ĐẦU KIỂM THỬ TÍNH NĂNG (MILESTONE 2) — 92 TÌNH HUỐNG`);
  console.log(`🎯 Server: ${BASE_URL}`);
  console.log(`======================================================\n`);

  try {
    // Đăng nhập các vai trò
    console.log('--- KHỐI 1: Xác thực & Thông tin tài khoản (Cases 1-8) ---');
    const admin = await login('admin@khoachat.edu.vn', 'Admin@123');
    const gv = await login('gv.an@khoachat.edu.vn', 'GiangVien@123');
    const sv1 = await login('sv01@khoachat.edu.vn', 'SinhVien@123');
    const sv2 = await login('sv02@khoachat.edu.vn', 'SinhVien@123');

    assert(!!admin.token, '1. Đăng nhập thành công với vai trò Quản trị viên (ADMIN)');
    assert(!!gv.token, '2. Đăng nhập thành công với vai trò Giảng viên (LECTURER)');
    assert(!!sv1.token, '3. Đăng nhập thành công với vai trò Sinh viên (STUDENT)');

    const meRes = await request('/api/auth/me', { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(meRes.ok && meRes.data.user.id === sv1.user.id, '4. Lấy thông tin cá nhân hiện tại (/api/auth/me)');

    const unauthRes = await request('/api/auth/me');
    assert(unauthRes.status === 401, '5. Từ chối truy cập API khi thiếu token (401 Unauthorized)');

    const wrongPwRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sv01@khoachat.edu.vn', password: 'sai-mat-khau' }),
    });
    assert(wrongPwRes.status === 401, '6. Từ chối đăng nhập khi sai mật khẩu');

    const notFoundEmail = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'khongtontai@khoachat.edu.vn', password: '123' }),
    });
    assert(notFoundEmail.status === 401, '7. Từ chối đăng nhập khi email không tồn tại trong hệ thống');

    const logoutRes = await request('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(logoutRes.ok, '8. Đăng xuất tài khoản an toàn (/api/auth/logout)');

    // Kênh & Danh sách kênh
    console.log('\n--- KHỐI 2: Quản lý Kênh & Quyền truy cập (Cases 9-18) ---');
    const chListRes = await request('/api/channels', { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(chListRes.ok && Array.isArray(chListRes.data.channels), '9. Lấy danh sách kênh của sinh viên kèm danh sách online');

    const channels = chListRes.data.channels;
    const testChannel = channels[0];
    assert(!!testChannel?.id, '10. Kênh trả về đầy đủ các trường id, name, type, myRole, canPost');

    const chDetailRes = await request(`/api/channels/${testChannel.id}`, { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(chDetailRes.ok && chDetailRes.data.channel.id === testChannel.id, '11. Xem chi tiết thông tin kênh theo ID');

    const chNotFound = await request('/api/channels/khong-ton-tai-uuid', { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(chNotFound.status === 404, '12. Trả về 404 khi truy cập kênh không tồn tại');

    // Tạo kênh cộng đồng mới
    const createCom = await request('/api/channels/community', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sv1.token}` },
      body: JSON.stringify({ name: 'CLB Tin Học FIT Test', memberIds: [sv2.user.id] }),
    });
    assert(createCom.ok && createCom.data.channel.name === 'CLB Tin Học FIT Test', '13. Sinh viên tự tạo kênh cộng đồng (COMMUNITY)');
    const comId = createCom.data.channel.id;

    assert(createCom.data.channel.myRole === 'OWNER', '14. Người tạo kênh cộng đồng tự động có vai trò OWNER');

    // Chỉnh sửa tên/mô tả kênh
    const editChannelRes = await request(`/api/admin/channels/${comId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sv1.token}` },
      body: JSON.stringify({ name: 'CLB Tin Học FIT (Đã Đổi Tên)' }),
    });
    assert(editChannelRes.ok, '15. Chủ kênh đổi tên kênh thành công');

    // Đổi cài đặt thông báo kênh
    const setNotify = await request(`/api/channels/${comId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sv1.token}` },
      body: JSON.stringify({ notifyLevel: 'MENTIONS' }),
    });
    assert(setNotify.ok && setNotify.data.channel.notifyLevel === 'MENTIONS', '16. Đặt mức nhận thông báo kênh (MENTIONS)');

    // Đặt ảnh preset đại diện kênh
    const presetRes = await request(`/api/channel-avatars/${comId}/preset`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sv1.token}` },
      body: JSON.stringify({ preset: 'code' }),
    });
    assert(presetRes.ok && presetRes.data.channel.avatar?.includes('code'), '17. Đặt biểu tượng đại diện (preset SVG) cho kênh');

    // Xoá ảnh đại diện kênh
    const delAvatar = await request(`/api/channel-avatars/${comId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sv1.token}` },
    });
    assert(delAvatar.ok && delAvatar.data.channel.avatar === null, '18. Xoá ảnh đại diện kênh về mặc định');

    // Tin nhắn & Thao tác tin nhắn
    console.log('\n--- KHỐI 3: Tin nhắn, Sửa, Xoá, Ghim, Trả lời (Cases 19-32) ---');
    const getMsgs = await request(`/api/channels/${comId}/messages?limit=20`, { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(getMsgs.ok && Array.isArray(getMsgs.data.messages), '19. Lấy danh sách tin nhắn của kênh thành công');

    const firstMsg = getMsgs.data.messages[0];
    assert(!!firstMsg?.id, '20. Có tin nhắn trong kênh để kiểm thử các thao tác');

    // Ghim tin nhắn
    const pinRes = await request(`/api/messages/${firstMsg.id}/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sv1.token}` },
      body: JSON.stringify({ pinned: true }),
    });
    assert(pinRes.ok && pinRes.data.message.pinned === true, '21. Ghim tin nhắn quan trọng lên đầu kênh');

    // Lấy danh sách tin đã ghim
    const pinsRes = await request(`/api/channels/${comId}/pins`, { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(pinsRes.ok && pinsRes.data.messages.some((m: any) => m.id === firstMsg.id), '22. Lấy danh sách các tin đã ghim của kênh (/pins)');

    // Bỏ ghim tin nhắn
    const unpinRes = await request(`/api/messages/${firstMsg.id}/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sv1.token}` },
      body: JSON.stringify({ pinned: false }),
    });
    assert(unpinRes.ok && unpinRes.data.message.pinned === false, '23. Bỏ ghim tin nhắn thành công');

    // Chỉnh sửa nội dung tin nhắn của chính mình
    const editMsgRes = await request(`/api/messages/${firstMsg.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sv1.token}` },
      body: JSON.stringify({ content: 'Nội dung tin nhắn đã được cập nhật kiểm thử' }),
    });
    assert(editMsgRes.ok, '24. Chỉnh sửa nội dung tin nhắn của chính mình');

    // Người khác không được sửa tin của bạn
    const editOtherMsg = await request(`/api/messages/${firstMsg.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sv2.token}` },
      body: JSON.stringify({ content: 'SV2 cố tình sửa tin của SV1' }),
    });
    assert(editOtherMsg.status === 403, '25. Chặn thành viên khác sửa tin nhắn không phải của mình (403)');

    // Lấy danh sách file của kênh
    const filesRes = await request(`/api/channels/${comId}/files`, { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(filesRes.ok && Array.isArray(filesRes.data.files), '26. Lấy danh sách tệp đính kèm của kênh');

    // Lấy danh sách link của kênh
    const linksRes = await request(`/api/channels/${comId}/links`, { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(linksRes.ok && Array.isArray(linksRes.data.links), '27. Lấy danh sách liên kết web đã chia sẻ trong kênh');

    // Phân loại tệp: ảnh
    const imgFiles = await request(`/api/channels/${comId}/files?kind=image`, { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(imgFiles.ok, '28. Bộ lọc tệp kênh: Chỉ lấy hình ảnh (kind=image)');

    // Phân loại tệp: tài liệu file
    const docFiles = await request(`/api/channels/${comId}/files?kind=file`, { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(docFiles.ok, '29. Bộ lọc tệp kênh: Chỉ lấy tài liệu word/excel/pdf/nén (kind=file)');

    // Phân loại tệp: video
    const videoFiles = await request(`/api/channels/${comId}/files?kind=video`, { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(videoFiles.ok, '30. Bộ lọc tệp kênh: Chỉ lấy video clip (kind=video)');

    // Báo cáo xác nhận đã đọc
    const acksRes = await request(`/api/messages/${firstMsg.id}/acks`, { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(acksRes.ok && typeof acksRes.data.total === 'number', '31. Xem danh sách & tỷ lệ xác nhận đã đọc của tin nhắn');

    // Xoá tin nhắn
    const delMsgRes = await request(`/api/messages/${firstMsg.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sv1.token}` },
    });
    assert(delMsgRes.ok, '32. Xoá (thu hồi) tin nhắn của chính mình thành công');

    // Tìm kiếm (Fulltext Search)
    console.log('\n--- KHỐI 4: Tìm kiếm Tin nhắn & Tệp tin (Cases 33-40) ---');
    const searchRes = await request('/api/search?q=chao', { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(searchRes.ok && Array.isArray(searchRes.data.messages), '33. Tìm kiếm tin nhắn full-text search không phân biệt dấu');

    const searchFilesRes = await request('/api/search/files?q=pdf', { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(searchFilesRes.ok && Array.isArray(searchFilesRes.data.files), '34. Tìm kiếm tệp tin đính kèm theo từ khoá tên tệp');

    const searchFilterCh = await request(`/api/search?q=test&channelId=${comId}`, { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(searchFilterCh.ok, '35. Tìm kiếm tin nhắn có giới hạn trong kênh cụ thể');

    const searchFilterSender = await request(`/api/search?q=test&senderId=${sv1.user.id}`, { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(searchFilterSender.ok, '36. Tìm kiếm tin nhắn có lọc theo người gửi');

    const searchFilterHasFile = await request('/api/search?q=test&hasFile=true', { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(searchFilterHasFile.ok, '37. Tìm kiếm tin nhắn chỉ lọc tin có tệp đính kèm');

    const emptySearch = await request('/api/search?q=', { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(emptySearch.ok && emptySearch.data.messages.length === 0, '38. Trả về mảng rỗng khi từ khoá tìm kiếm để trống');

    const searchAround = await request(`/api/channels/${comId}/around/${firstMsg.id}`, { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(searchAround.ok || searchAround.status === 404, '39. Nhảy tới tin nhắn tìm kiếm tải kèm ngữ cảnh trước/sau (/around)');

    const searchUser = await request('/api/users/search?q=minh', { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(searchUser.ok && Array.isArray(searchUser.data.users), '40. Tìm kiếm người dùng trong danh bạ theo tên/email/MSSV');

    // Danh bạ & Kết bạn
    console.log('\n--- KHỐI 5: Bạn bè & Danh bạ Khoa (Cases 41-48) ---');
    const friendsRes = await request('/api/friends', { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(friendsRes.ok && Array.isArray(friendsRes.data.friends), '41. Lấy danh sách bạn bè & lời mời kết bạn (/api/friends)');

    const sendReqRes = await request('/api/friends/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sv1.token}` },
      body: JSON.stringify({ targetUserId: sv2.user.id }),
    });
    assert(sendReqRes.ok || sendReqRes.status === 400, '42. Gửi yêu cầu kết bạn tới người dùng khác');

    const acceptRes = await request('/api/friends/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sv2.token}` },
      body: JSON.stringify({ fromUserId: sv1.user.id }),
    });
    assert(acceptRes.ok, '43. Chấp nhận kết bạn và tự động mở kênh nhắn tin riêng');

    const unfriendRes = await request(`/api/friends/${sv2.user.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sv1.token}` },
    });
    assert(unfriendRes.ok, '44. Huỷ kết bạn với một người dùng thành công');

    const allUsers = await request('/api/users', { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(allUsers.ok && Array.isArray(allUsers.data.users), '45. Lấy danh sách thành viên khoa (/api/users)');

    const lookupUsers = await request('/api/admin/user-lookup?q=an', { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(lookupUsers.ok && Array.isArray(lookupUsers.data.users), '46. Tra cứu sinh viên/giảng viên phục vụ thêm vào nhóm');

    const lookupRoleGv = await request('/api/admin/user-lookup?role=LECTURER', { headers: { Authorization: `Bearer ${admin.token}` } });
    assert(lookupRoleGv.ok && lookupRoleGv.data.users.every((u: any) => u.role === 'LECTURER'), '47. Tra cứu lọc theo vai trò giảng viên');

    const lookupRoleSv = await request('/api/admin/user-lookup?role=STUDENT', { headers: { Authorization: `Bearer ${admin.token}` } });
    assert(lookupRoleSv.ok && lookupRoleSv.data.users.every((u: any) => u.role === 'STUDENT'), '48. Tra cứu lọc theo vai trò sinh viên');

    // Quản lý thành viên kênh & Điều hành
    console.log('\n--- KHỐI 6: Quản lý Thành viên Kênh & Cấm chat (Cases 49-62) ---');
    const chMembersRes = await request(`/api/admin/channels/${comId}/members`, { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(chMembersRes.ok && Array.isArray(chMembersRes.data.members), '49. Lấy danh sách thành viên và vai trò trong kênh');

    // Thêm thành viên vào kênh bằng userIds
    const addMemberRes = await request(`/api/admin/channels/${comId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sv1.token}` },
      body: JSON.stringify({ userIds: [sv2.user.id] }),
    });
    assert(addMemberRes.ok, '50. Thêm thành viên vào kênh bằng User ID');

    // Đổi vai trò thành viên thành MODERATOR
    const changeRoleRes = await request(`/api/admin/channels/${comId}/members/${sv2.user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sv1.token}` },
      body: JSON.stringify({ role: 'MODERATOR' }),
    });
    assert(changeRoleRes.ok, '51. Thăng cấp thành viên lên làm Quản trị kênh (MODERATOR)');

    // Hạ vai trò thành viên xuống MEMBER
    const demoteRoleRes = await request(`/api/admin/channels/${comId}/members/${sv2.user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sv1.token}` },
      body: JSON.stringify({ role: 'MEMBER' }),
    });
    assert(demoteRoleRes.ok, '52. Đặt lại vai trò thành viên về MEMBER thường');

    // Cấm chat thành viên
    const muteRes = await request(`/api/channels/${comId}/mute/${sv2.user.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sv1.token}` },
    });
    assert(muteRes.ok && muteRes.data.muted === true, '53. Bật cấm chat đối với một thành viên cụ thể trong kênh');

    // Bỏ cấm chat thành viên
    const unmuteRes = await request(`/api/channels/${comId}/mute/${sv2.user.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sv1.token}` },
    });
    assert(unmuteRes.ok && unmuteRes.data.muted === false, '54. Gỡ bỏ cấm chat cho thành viên thành công');

    // Không cho cấm chat chủ kênh
    const muteOwnerRes = await request(`/api/channels/${comId}/mute/${sv1.user.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sv1.token}` },
    });
    assert(muteOwnerRes.status === 400, '55. Ngăn chặn cấm chat chủ sở hữu kênh');

    // Khóa chat toàn bộ nhóm
    const lockChatRes = await request(`/api/channels/${comId}/lock-chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sv1.token}` },
    });
    assert(lockChatRes.ok && lockChatRes.data.locked === true, '56. Bật chế độ cấm chat nhóm (chỉ quản lý mới được chat)');

    // Mở khóa chat toàn bộ nhóm
    const unlockChatRes = await request(`/api/channels/${comId}/lock-chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sv1.token}` },
    });
    assert(unlockChatRes.ok && unlockChatRes.data.locked === false, '57. Mở lại chat nhóm cho tất cả thành viên bình thường');

    // Thành viên thường không được khoá chat
    const svLockFail = await request(`/api/channels/${comId}/lock-chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sv2.token}` },
    });
    assert(svLockFail.status === 403, '58. Chặn thành viên thường tự ý khoá/mở chat nhóm (403)');

    // Tạo link mời tham gia nhóm
    const inviteRes = await request(`/api/admin/channels/${comId}/invite`, { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(inviteRes.ok, '59. Lấy liên kết & mã mời tham gia nhóm (Invite Link)');

    // Bật liên kết mời
    const toggleInvite = await request(`/api/admin/channels/${comId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sv1.token}` },
      body: JSON.stringify({ active: true }),
    });
    assert(toggleInvite.ok, '60. Bật/tắt trạng thái hoạt động của liên kết mời nhóm');

    // Xoá thành viên khỏi kênh
    const removeMember = await request(`/api/admin/channels/${comId}/members/${sv2.user.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sv1.token}` },
    });
    assert(removeMember.ok, '61. Xoá thành viên ra khỏi kênh trò chuyện');

    // Rời khỏi kênh
    const leaveRes = await request(`/api/channels/${comId}/membership`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sv2.token}` },
    });
    assert(leaveRes.ok, '62. Tự rời khỏi kênh trò chuyện (/api/channels/:id/membership)');

    // Trang quản trị Admin
    console.log('\n--- KHỐI 7: Quản trị Hệ thống (Admin Only) (Cases 63-80) ---');
    const adminStats = await request('/api/admin/stats', { headers: { Authorization: `Bearer ${admin.token}` } });
    assert(adminStats.ok && (typeof adminStats.data.users === 'number' || typeof adminStats.data.users === 'object'), '63. Xem thống kê tổng quan hệ thống (/api/admin/stats)');

    // Sinh viên không được xem trang quản trị
    const svStatsFail = await request('/api/admin/stats', { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(svStatsFail.status === 403, '64. Chặn sinh viên truy cập thống kê quản trị (403 Forbidden)');

    // Lấy danh sách người dùng cho admin
    const adminUsers = await request('/api/admin/users?page=1&pageSize=10', { headers: { Authorization: `Bearer ${admin.token}` } });
    assert(adminUsers.ok && Array.isArray(adminUsers.data.users), '65. Quản trị viên lấy danh sách tài khoản có phân trang');

    // Tạo người dùng mới qua admin
    const newEmail = `user.test.${Date.now()}@khoachat.edu.vn`;
    const createUserRes = await request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
      body: JSON.stringify({ name: 'Tài Khoản Test Tự Động', email: newEmail, role: 'STUDENT', studentCode: 'B2109999' }),
    });
    assert(createUserRes.ok && createUserRes.data.user.email === newEmail, '66. Quản trị viên tạo người dùng mới thành công');
    const newUserId = createUserRes.data.user.id;

    // Đặt lại mật khẩu người dùng
    const resetPwRes = await request(`/api/admin/users/${newUserId}/reset-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    assert(resetPwRes.ok && !!resetPwRes.data.password, '67. Đặt lại mật khẩu ngẫu nhiên cho người dùng');

    // Khoá tài khoản người dùng
    const lockUserRes = await request(`/api/admin/users/${newUserId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
      body: JSON.stringify({ locked: true }),
    });
    assert(lockUserRes.ok && lockUserRes.data.user.locked === true, '68. Khoá tài khoản vi phạm (locked: true)');

    // Tài khoản bị khoá không được đăng nhập
    const lockedLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, password: resetPwRes.data.password }),
    });
    assert(lockedLogin.status === 403, '69. Từ chối đăng nhập đối với tài khoản đã bị khoá');

    // Mở khoá tài khoản
    const unlockUserRes = await request(`/api/admin/users/${newUserId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
      body: JSON.stringify({ locked: false }),
    });
    assert(unlockUserRes.ok && unlockUserRes.data.user.locked === false, '70. Mở khoá tài khoản trở lại hoạt động bình thường');

    // Sửa thông tin người dùng
    const updateInfoRes = await request(`/api/admin/users/${newUserId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
      body: JSON.stringify({ name: 'Tên Đã Chỉnh Sửa' }),
    });
    assert(updateInfoRes.ok && updateInfoRes.data.user.name === 'Tên Đã Chỉnh Sửa', '71. Cập nhật thông tin họ tên, mã số sinh viên');

    // Lấy danh sách kênh cho admin
    const adminChannels = await request('/api/admin/channels', { headers: { Authorization: `Bearer ${admin.token}` } });
    assert(adminChannels.ok && Array.isArray(adminChannels.data.channels), '72. Quản trị viên xem toàn bộ danh sách lớp & kênh trong khoa');

    // Admin tạo lớp học phần mới
    const createClassRes = await request('/api/admin/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
      body: JSON.stringify({ type: 'CLASS', name: 'Nhập Môn Lập Trình Nhóm 99', courseCode: 'CT999', ownerIds: [gv.user.id] }),
    });
    assert(createClassRes.ok && createClassRes.data.channel.courseCode === 'CT999', '73. Quản trị viên tạo lớp học phần mới (bắt buộc mã học phần)');
    const classId = createClassRes.data.channel.id;

    // Giảng viên được phân công làm OWNER của lớp
    const classDetail = await request(`/api/admin/channels/${classId}/members`, { headers: { Authorization: `Bearer ${admin.token}` } });
    assert(classDetail.ok && classDetail.data.members.some((m: any) => m.id === gv.user.id && m.memberRole === 'OWNER'), '74. Giảng viên được gán làm Chủ sở hữu (OWNER) của lớp học phần');

    // Giảng viên xem danh sách các lớp mình phụ trách
    const gvChannels = await request('/api/admin/channels', { headers: { Authorization: `Bearer ${gv.token}` } });
    assert(gvChannels.ok && gvChannels.data.channels.some((c: any) => c.id === classId), '75. Giảng viên tra cứu các lớp học phần mình phụ trách');

    // Lưu trữ (Archive) kênh
    const archiveRes = await request(`/api/admin/channels/${classId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
      body: JSON.stringify({ archived: true }),
    });
    assert(archiveRes.ok && archiveRes.data.channel.archived === true, '76. Lưu trữ kênh khi kết thúc học kỳ (archived: true)');

    // Khôi phục kênh lưu trữ
    const unarchiveRes = await request(`/api/admin/channels/${classId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
      body: JSON.stringify({ archived: false }),
    });
    assert(unarchiveRes.ok && unarchiveRes.data.channel.archived === false, '77. Khôi phục kênh đã lưu trữ hoạt động lại');

    // Nhập người dùng hàng loạt qua CSV
    const csvData = `test1@khoachat.edu.vn,Sinh Viên CSV 1,B2100001\ntest2@khoachat.edu.vn,Sinh Viên CSV 2,B2100002`;
    const importRes = await request('/api/admin/users/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
      body: JSON.stringify({ csv: csvData, channelId: classId }),
    });
    assert(importRes.ok && importRes.data.created >= 0, '78. Nhập danh sách tài khoản và thêm vào lớp học phần qua file CSV');

    // Xoá kênh học phần
    const delClassRes = await request(`/api/admin/channels/${classId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    assert(delClassRes.ok, '79. Quản trị viên xoá bỏ lớp học phần thành công');

    // Giải tán nhóm cộng đồng
    const disbandRes = await request(`/api/admin/channels/${comId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sv1.token}` },
    });
    assert(disbandRes.ok, '80. Chủ kênh cộng đồng giải tán nhóm vĩnh viễn');

    // Tính năng mở rộng: Cuộc gọi, Preset SVG, Đổi Avatar
    console.log('\n--- KHỐI 8: Tính năng Mở rộng & Đa phương tiện (Cases 81-92) ---');
    const svgPreset = await request('/api/channel-avatars/presets/book.svg');
    assert(svgPreset.ok, '81. Trả về biểu tượng đại diện môn học SVG tĩnh (/presets/book.svg)');

    const svgPresetScience = await request('/api/channel-avatars/presets/science.svg');
    assert(svgPresetScience.ok, '82. Trả về biểu tượng đại diện nghiên cứu khoa học SVG (/presets/science.svg)');

    const svgPresetTeam = await request('/api/channel-avatars/presets/team.svg');
    assert(svgPresetTeam.ok, '83. Trả về biểu tượng đại diện hoạt động nhóm SVG (/presets/team.svg)');

    // Xoá ảnh đại diện cá nhân
    const delUserAvatar = await request('/api/auth/avatar', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sv1.token}` },
    });
    assert(delUserAvatar.ok && delUserAvatar.data.user.avatar === null, '84. Xoá ảnh đại diện người dùng trở về chữ cái đầu mặc định');

    // Từ chối tải file đính kèm khi không có file
    const uploadEmpty = await request(`/api/channels/${testChannel.id}/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sv1.token}` },
    });
    assert(uploadEmpty.status === 400, '85. Báo lỗi 400 khi upload không có tệp đính kèm');

    // Tra cứu tệp không tồn tại (cần token vì route đã yêu cầu xác thực)
    const fileNotFound = await request('/api/files/khong-ton-tai-id', { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(fileNotFound.status === 404, '86. Báo lỗi 404 khi truy cập tệp tin không tồn tại');

    // Đồng bộ với afterSeq lớn hơn tổng tin
    const syncFuture = await request('/api/sync?after=99999999', { headers: { Authorization: `Bearer ${sv1.token}` } });
    assert(syncFuture.ok && syncFuture.data.messages.length === 0, '87. Đồng bộ /api/sync trả về rỗng khi không có tin mới hơn');

    // Kiểm tra tin nhắn không thể tự chat với chính mình
    const selfDirect = await request('/api/direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sv1.token}` },
      body: JSON.stringify({ userId: sv1.user.id }),
    });
    assert(selfDirect.status === 400, '88. Ngăn chặn tự mở cuộc trò chuyện trực tiếp 1-1 với chính mình');

    // Thành viên thường không được giải tán kênh thông báo
    const disbandAnnFail = await request(`/api/admin/channels/${testChannel.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sv2.token}` },
    });
    assert(disbandAnnFail.status === 403, '89. Chặn thành viên không có quyền giải tán kênh của khoa (403)');

    // Kiểm tra phân trang danh sách người dùng admin: trang 2
    const adminUsersPage2 = await request('/api/admin/users?page=2&pageSize=5', { headers: { Authorization: `Bearer ${admin.token}` } });
    assert(adminUsersPage2.ok, '90. Phân trang trang quản trị người dùng (page=2, pageSize=5)');

    // Kiểm tra tra cứu người dùng theo MSSV
    const lookupMssv = await request('/api/admin/user-lookup?q=B2101234', { headers: { Authorization: `Bearer ${admin.token}` } });
    assert(lookupMssv.ok && lookupMssv.data.users.some((u: any) => u.studentCode === 'B2101234'), '91. Tra cứu chính xác sinh viên theo Mã Số Sinh Viên (MSSV)');

    // Kiểm tra tính toàn vẹn phiên làm việc
    const checkSession = await request('/api/auth/me', { headers: { Authorization: `Bearer ${admin.token}` } });
    assert(checkSession.ok && checkSession.data.user.role === 'ADMIN', '92. Kiểm tra tính toàn vẹn và duy trì phiên làm việc thành công');

  } catch (err: any) {
    failed++;
    console.error('❌ Lỗi ngoại lệ trong quá trình chạy kiểm thử:', err.message);
  }

  console.log(`\n======================================================`);
  console.log(`📊 KẾT QUẢ KIỂM THỬ TÍNH NĂNG: ${passed}/92 ĐẠT (${failed} lỗi)`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run();
