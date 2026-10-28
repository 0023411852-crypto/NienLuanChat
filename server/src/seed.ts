import { PrismaClient } from './prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu nạp dữ liệu mẫu sinh động (Khoa - Giảng viên - Sinh viên)...');

  // Xoá dữ liệu cũ
  await prisma.pushSubscription.deleteMany({});
  await prisma.mention.deleteMany({});
  await prisma.attachment.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.channelMember.deleteMany({});
  await prisma.channel.deleteMany({});
  await prisma.user.deleteMany({});

  const hashSv = bcrypt.hashSync('SinhVien@123', 10);
  const hashGv = bcrypt.hashSync('GiangVien@123', 10);
  const hashAdmin = bcrypt.hashSync('Admin@123', 10);

  // 1. Tạo người dùng mẫu
  const admin = await prisma.user.create({
    data: {
      email: 'admin@khoachat.edu.vn',
      password: hashAdmin,
      name: 'Văn phòng Khoa CNTT',
      role: 'ADMIN',
    },
  });

  const gvAn = await prisma.user.create({
    data: {
      email: 'gv.an@khoachat.edu.vn',
      password: hashGv,
      name: 'ThS. Nguyễn Văn An',
      role: 'LECTURER',
    },
  });

  const gvMai = await prisma.user.create({
    data: {
      email: 'gv.mai@khoachat.edu.vn',
      password: hashGv,
      name: 'TS. Phạm Thị Mai',
      role: 'LECTURER',
    },
  });

  const sv1 = await prisma.user.create({
    data: {
      email: 'sv01@khoachat.edu.vn',
      password: hashSv,
      name: 'Nguyễn Văn Minh (Lớp trưởng)',
      role: 'STUDENT',
      studentCode: 'B2101234',
    },
  });

  const sv2 = await prisma.user.create({
    data: {
      email: 'sv02@khoachat.edu.vn',
      password: hashSv,
      name: 'Trần Thị Mỹ Linh (Bí thư)',
      role: 'STUDENT',
      studentCode: 'B2101235',
    },
  });

  const sv3 = await prisma.user.create({
    data: {
      email: 'sv03@khoachat.edu.vn',
      password: hashSv,
      name: 'Lê Hoàng Cường',
      role: 'STUDENT',
      studentCode: 'B2101236',
    },
  });

  const sv4 = await prisma.user.create({
    data: {
      email: 'sv04@khoachat.edu.vn',
      password: hashSv,
      name: 'Phạm Thu Dung',
      role: 'STUDENT',
      studentCode: 'B2101237',
    },
  });

  const sv5 = await prisma.user.create({
    data: {
      email: 'sv05@khoachat.edu.vn',
      password: hashSv,
      name: 'Đỗ Minh Đức',
      role: 'STUDENT',
      studentCode: 'B2101238',
    },
  });

  console.log('✅ Đã tạo 8 tài khoản mẫu: 1 Admin Khoa, 2 Giảng viên, 5 Sinh viên');

  // 2. Kênh Thông báo chung của Khoa (ANNOUNCEMENT)
  const chThongBao = await prisma.channel.create({
    data: {
      type: 'ANNOUNCEMENT',
      name: 'Thông báo chung Khoa CNTT',
      description: 'Kênh thông báo chính thức của Ban chủ nhiệm Khoa đến toàn thể sinh viên và giảng viên.',
      members: {
        create: [
          { userId: admin.id, role: 'OWNER', lastReadSeq: 100 },
          { userId: gvAn.id, role: 'MODERATOR', lastReadSeq: 100 },
          { userId: gvMai.id, role: 'MODERATOR', lastReadSeq: 100 },
          { userId: sv1.id, role: 'MEMBER', lastReadSeq: 100, lastReadAt: new Date() },
          { userId: sv2.id, role: 'MEMBER', lastReadSeq: 100, lastReadAt: new Date() },
          { userId: sv3.id, role: 'MEMBER', lastReadSeq: 0 }, // Chưa đọc
          { userId: sv4.id, role: 'MEMBER', lastReadSeq: 0 }, // Chưa đọc
          { userId: sv5.id, role: 'MEMBER', lastReadSeq: 0 }, // Chưa đọc
        ],
      },
    },
  });

  // 3. Kênh Lớp học phần: Phát triển ứng dụng Web (CLASS)
  const chWeb = await prisma.channel.create({
    data: {
      type: 'CLASS',
      name: 'Phát triển ứng dụng Web',
      courseCode: 'CT299-01',
      description: 'Lớp học phần Phát triển ứng dụng Web - Học kỳ 1, Phòng thực hành Lab 02.',
      members: {
        create: [
          { userId: gvAn.id, role: 'OWNER', lastReadSeq: 100 },
          { userId: sv1.id, role: 'MODERATOR', lastReadSeq: 100, lastReadAt: new Date() },
          { userId: sv2.id, role: 'MEMBER', lastReadSeq: 100, lastReadAt: new Date() },
          { userId: sv3.id, role: 'MEMBER', lastReadSeq: 5, lastReadAt: new Date() },
          { userId: sv4.id, role: 'MEMBER', lastReadSeq: 0 },
          { userId: sv5.id, role: 'MEMBER', lastReadSeq: 0 },
        ],
      },
    },
  });

  // 4. Kênh Lớp học phần: Cấu trúc dữ liệu và giải thuật (CLASS)
  const chCTDL = await prisma.channel.create({
    data: {
      type: 'CLASS',
      name: 'Cấu trúc dữ liệu & Giải thuật',
      courseCode: 'CT177-02',
      description: 'Lớp học phần Cấu trúc dữ liệu và giải thuật - Giảng viên phụ trách: TS. Phạm Thị Mai.',
      members: {
        create: [
          { userId: gvMai.id, role: 'OWNER', lastReadSeq: 100 },
          { userId: sv1.id, role: 'MEMBER', lastReadSeq: 100 },
          { userId: sv2.id, role: 'MEMBER', lastReadSeq: 100 },
          { userId: sv3.id, role: 'MEMBER', lastReadSeq: 0 },
        ],
      },
    },
  });

  // 5. Kênh Nhắn tin riêng 1-1 (DIRECT): Giữa Giảng viên An và Lớp trưởng Minh
  const chDirect = await prisma.channel.create({
    data: {
      type: 'DIRECT',
      name: 'ThS. Nguyễn Văn An',
      description: 'Hội thoại riêng giữa Giảng viên và Lớp trưởng',
      members: {
        create: [
          { userId: gvAn.id, role: 'OWNER', lastReadSeq: 100 },
          { userId: sv1.id, role: 'OWNER', lastReadSeq: 100 },
        ],
      },
    },
  });

  console.log('✅ Đã tạo các kênh mẫu: Thông báo khoa, 2 Lớp học phần (CT299, CT177), Chat riêng 1-1');

  // --- TIN NHẮN TRONG KÊNH THÔNG BÁO CHUNG ---
  const msgTB1 = await prisma.message.create({
    data: {
      clientId: 'seed-tb-1',
      channelId: chThongBao.id,
      senderId: admin.id,
      content: '📢 [THÔNG BÁO] Chào mừng toàn thể Giảng viên và Sinh viên đến với Cổng thông tin trao đổi KhoaChat!',
      pinned: true,
      pinnedAt: new Date(),
      pinnedById: admin.id,
    },
  });

  const msgTB2 = await prisma.message.create({
    data: {
      clientId: 'seed-tb-2',
      channelId: chThongBao.id,
      senderId: admin.id,
      content: '📌 Thông báo khẩn: Kế hoạch đăng ký học phần bổ sung cho học kỳ mới sẽ diễn ra từ ngày 01 đến hết ngày 05. Đề nghị các bạn sinh viên kiểm tra danh sách môn học.',
    },
  });

  // --- TIN NHẮN TRONG LỚP PHÁT TRIỂN ỨNG DỤNG WEB (CT299) ---
  const msgWeb1 = await prisma.message.create({
    data: {
      clientId: 'seed-web-1',
      channelId: chWeb.id,
      senderId: gvAn.id,
      content: 'Chào các bạn sinh viên lớp Phát triển ứng dụng Web (CT299-01). Thầy gửi các bạn Đề cương môn học và Slide bài giảng Tuần 1 đính kèm bên dưới.',
      pinned: true,
      pinnedAt: new Date(),
      pinnedById: gvAn.id,
    },
  });

  // Đính kèm 2 tệp vào tin nhắn msgWeb1
  await prisma.attachment.create({
    data: {
      filename: 'De_cuong_chi_tiet_CT299.pdf',
      mime: 'application/pdf',
      size: 1048576,
      isImage: false,
      path: 'uploads/de_cuong_CT299.pdf',
      url: '/uploads/de_cuong_CT299.pdf',
      channelId: chWeb.id,
      uploaderId: gvAn.id,
      messageId: msgWeb1.id,
    },
  });

  await prisma.attachment.create({
    data: {
      filename: 'Slide_BaiGiang_Tuan01.pdf',
      mime: 'application/pdf',
      size: 2097152,
      isImage: false,
      path: 'uploads/slide_tuan_1.pdf',
      url: '/uploads/slide_tuan_1.pdf',
      channelId: chWeb.id,
      uploaderId: gvAn.id,
      messageId: msgWeb1.id,
    },
  });

  const msgWeb2 = await prisma.message.create({
    data: {
      clientId: 'seed-web-2',
      channelId: chWeb.id,
      senderId: sv1.id,
      content: 'Dạ em đại diện lớp cảm ơn Thầy ạ! Em đã tải đề cương về và thông báo cho các bạn.',
      replyToId: msgWeb1.id,
    },
  });

  const msgWeb3 = await prisma.message.create({
    data: {
      clientId: 'seed-web-3',
      channelId: chWeb.id,
      senderId: gvAn.id,
      content: 'Thầy nhắc bạn @Nguyễn Văn Minh kiểm tra danh sách phân nhóm bài tập lớn nhé!',
    },
  });

  // Tạo Mention cho sv1
  await prisma.mention.create({
    data: {
      messageId: msgWeb3.id,
      userId: sv1.id,
    },
  });

  // --- TIN NHẮN TRONG HỘI THOẠI 1-1 ---
  await prisma.message.create({
    data: {
      clientId: 'seed-direct-1',
      channelId: chDirect.id,
      senderId: sv1.id,
      content: 'Thầy ơi, buổi học thực hành tuần tới phòng máy có cần cài đặt môi trường trước không Thầy?',
    },
  });

  await prisma.message.create({
    data: {
      clientId: 'seed-direct-2',
      channelId: chDirect.id,
      senderId: gvAn.id,
      content: 'Các bạn cài sẵn Node.js v20+ và PostgreSQL ở nhà để vào phòng lab thực hành ngay nhé em.',
    },
  });

  console.log('✅ Nạp dữ liệu mẫu hoàn tất 100%!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
