# KhoaChat — Ứng dụng nhắn tin nội bộ cho lớp học & khoa

Niên luận: xây dựng ứng dụng nhắn tin riêng cho khoa thay cho các nhóm chat trên mạng xã hội.
Nhắn tin **thời gian thực**, **đồng bộ trạng thái đã đọc** trên nhiều thiết bị, **không mất tin khi mất mạng**.

![Giao diện KhoaChat](screenshot.png)

## Công nghệ

| Phần | Công nghệ |
|---|---|
| Ngôn ngữ | TypeScript (cả server lẫn client) |
| Server | Node.js 20+, Express 4, Socket.IO 4, Prisma ORM 6, JWT + bcrypt, Zod |
| Cơ sở dữ liệu | PostgreSQL 16 (có full-text search bằng `tsvector` + `unaccent`) |
| Client | React 18, Vite 6, Tailwind CSS 3, socket.io-client, IndexedDB (thư viện `idb`) |

## Milestone 1 — đã làm được

- **Đăng ký / đăng nhập** bằng email + mật khẩu (bcrypt), cấp JWT; tài khoản bị khoá không đăng nhập được.
- **3 loại kênh**: Thông báo, Lớp học phần, Tin nhắn riêng (có nút `+` để mở tin nhắn riêng với bất kỳ ai, hoặc bấm vào tên thành viên).
- **Nhắn tin realtime** qua Socket.IO, xác thực JWT ngay lúc bắt tay (handshake). Mỗi tin có `clientId` (UUID do client sinh) → server **chống gửi trùng** và trả `ack`.
- **Đang soạn tin...** và **trạng thái online** (chấm xanh, danh sách thành viên đang hoạt động / ngoại tuyến, "Hoạt động lúc ...").
- **Đồng bộ đã đọc nhiều thiết bị**: đọc ở tab/máy này thì badge chưa đọc ở tab/máy khác của cùng tài khoản tự mất (phòng `user:<id>`). Trạng thái đọc chỉ tiến lên, không bị lùi.
- **Chống mất tin khi mất mạng**:
  - Tin soạn khi mất mạng được lưu vào **hàng đợi outbox trong IndexedDB**, hiện trạng thái ⏳ *Đang gửi*, tự gửi khi có mạng lại (kể cả sau khi tải lại trang).
  - Khi kết nối lại, client gọi REST `/api/sync?after=<seq>` để **tải bù** mọi tin bị lỡ.
  - Danh sách kênh và 50 tin gần nhất mỗi kênh được lưu cục bộ → mở app lúc offline vẫn xem được tin cũ.
  - Tin bị server từ chối (VD: sinh viên đăng vào kênh thông báo) hiện *Gửi thất bại* kèm nút **Thử lại / Xoá**.
- **Kênh thông báo**: chỉ GIẢNG VIÊN / ADMIN được đăng (kiểm tra ở server; giao diện sinh viên hiện ô khoá).
- **Lịch sử có phân trang**: cuộn lên đầu để tải tin cũ hơn; vạch "Tin nhắn mới" đánh dấu chỗ bắt đầu chưa đọc; nhóm tin theo người gửi & theo ngày.

## Milestone 2 — đầy đủ tính năng chat

| Tính năng | Chi tiết |
|---|---|
| **Gửi file & ảnh** | Nút 📎, **kéo thả** vào khung chat, **dán ảnh** (Ctrl+V). Thanh tiến trình khi tải lên. Tối đa **20MB/tệp**, 10 tệp/tin. Chỉ cho phép ảnh (jpg, png, gif, webp), PDF, Word, Excel, PowerPoint, txt/csv/md, zip/rar/7z, mã nguồn (c, cpp, java, py, js, ts, sql...). Server kiểm tra phần mở rộng **và chữ ký tệp** (magic bytes) với ảnh/PDF. |
| Xem ảnh / tệp | Ảnh hiện **thumbnail** ngay trong tin, bấm để mở **lightbox** (← → để chuyển ảnh, Esc để đóng, nút tải xuống). Tệp khác hiện thẻ có biểu tượng loại tệp, tên, dung lượng, nút tải. |
| Bảo mật tệp | Tệp lưu ở `server/uploads/YYYY/MM/<uuid>.<ext>` (không public). Tải qua `/api/files/:id` — chỉ **thành viên kênh** mới xem được (dùng cookie httpOnly để thẻ `<img>` hoạt động), header `nosniff` + `CSP sandbox`. Tệp tải lên nhưng không gửi sẽ tự dọn sau 24 giờ. |
| File + mất mạng | Chọn tệp lúc offline → tệp được lưu (Blob) trong **outbox IndexedDB**; khi có mạng: tải tệp lên trước rồi mới gửi tin (không mất tệp kể cả khi tải lại trang). Đang online thì tệp được tải lên ngay khi chọn. |
| **@nhắc tên** | Gõ `@` → popup gợi ý thành viên kênh (lọc **không dấu**, ↑ ↓ Enter/Tab, Esc). Lưu bảng `Mention`. Tên được tô màu trong tin; tin nhắc đến **bạn** có nền vàng; sidebar có huy hiệu **@** đếm số lần bị nhắc chưa đọc. `@all` / `@channel` chỉ **giảng viên / quản trị viên** dùng được. |
| **Ghim tin** | Quyền: GV/QTV ở mọi kênh; trong tin nhắn riêng ai cũng ghim được; trong lớp học phần chỉ GV/QTV (hoặc người được đặt làm quản lý kênh). Thanh "Tin đã ghim" trên đầu kênh + tab **Đã ghim** ở cột phải, bấm để **nhảy tới tin**. Cập nhật realtime cho mọi người. |
| **Trả lời / sửa / xoá** | Rê chuột vào tin → thanh công cụ: Trả lời (trích dẫn tin gốc, bấm trích dẫn để nhảy tới), Sửa (tin của mình, hiện "(đã sửa)"), Xoá (thu hồi với mọi người; GV/QTV xoá được tin trong kênh mình quản lý). Tất cả realtime. |
| **Tìm kiếm** | `Ctrl + K` (hoặc ô *Tìm kiếm* ở sidebar / biểu tượng 🔍 trên đầu kênh). Tab **Tin nhắn**: full-text search `tsvector` **không phân biệt dấu** (gõ `lich thi` ra "Lịch thi"), chỉ trong các kênh của bạn, lọc theo kênh / người gửi / có tệp đính kèm, từ khoá được tô sáng. Tab **Tệp**: tìm theo tên tệp, lọc loại tệp. Bấm kết quả → mở kênh và **nhảy tới đúng tin** (tải kèm ngữ cảnh trước/sau). |
| **Tài liệu của kênh** | Tab *Tài liệu* ở cột phải: lưới ảnh + danh sách tệp của kênh, lọc Ảnh / PDF / Văn bản / Bảng tính / Trình chiếu / Nén / Khác. |
| **Thông báo** | Toast trong ứng dụng + âm báo (Web Audio, tắt được), số tin chưa đọc trên **tiêu đề tab** `(3) KhoaChat`. Tab đang ẩn → **Notification API** của trình duyệt. Đã đóng tab → **Web Push** (service worker `sw.js` + VAPID, thư viện `web-push`): server chỉ đẩy tới người **không còn kết nối** để tránh báo trùng. Bấm thông báo → mở đúng kênh & tin. |
| Mức thông báo từng kênh | Biểu tượng 🔔 trên đầu kênh: *Mặc định* (tin riêng & thông báo: mọi tin; lớp học phần: khi bị nhắc tên), *Tất cả tin nhắn*, *Chỉ khi được nhắc tên*, *Tắt*. Bật/tắt Web Push và âm thanh ở nút chuông cạnh tên mình (góc dưới sidebar). |
| **Trang quản trị** (ADMIN) | Sidebar → *Trang quản trị*. **Tổng quan**: số người dùng, đang online, tin nhắn, tệp, biểu đồ tin nhắn 7 ngày, kênh sôi nổi nhất. **Người dùng**: tìm / lọc vai trò / trạng thái, phân trang, tạo mới (mật khẩu tự sinh hiển thị 1 lần), sửa, đổi vai trò, **khoá / mở khoá** (bị khoá → đăng xuất ngay trên mọi thiết bị), đặt lại mật khẩu, **nhập CSV** (`email,họ tên,MSSV`, có thể thêm luôn vào một lớp). **Kênh**: tạo lớp học phần (bắt buộc mã HP) / kênh thông báo, chọn GV phụ trách, sửa, **lưu trữ / khôi phục**, xoá; quản lý thành viên (thêm từng người, **thêm hàng loạt bằng email/MSSV**, đổi vai trò trong kênh, xoá). |
| Giảng viên | Sidebar → *Quản lý lớp học phần*: chỉ thấy và quản lý thành viên các lớp mình phụ trách (cũng mở được từ tab *Thành viên* của kênh). |
| **Xác nhận đã đọc thông báo** (điểm cộng) | Tin trong kênh thông báo có nút **"Tôi đã đọc"** cho sinh viên. Người đăng / GV thấy "x/N đã xác nhận" → bấm xem danh sách **đã xác nhận / chưa xác nhận** (phân biệt "đã xem nhưng chưa xác nhận"). |

### Ảnh chụp màn hình (Milestone 2)

| | |
|---|---|
| Gửi ảnh + PDF trong chat ![](docs/screenshots/m2-upload-image.png) | Đang đính kèm (chip + tiến trình) ![](docs/screenshots/m2-upload-chips.png) |
| Lightbox xem ảnh ![](docs/screenshots/m2-lightbox.png) | Gợi ý @nhắc tên ![](docs/screenshots/m2-mention-autocomplete.png) |
| Tin đã ghim (thanh + cột phải) ![](docs/screenshots/m2-pinned-panel.png) | Tab Tài liệu của kênh ![](docs/screenshots/m2-files-tab.png) |
| Tìm kiếm tin nhắn (không dấu) ![](docs/screenshots/m2-search-results.png) | Tìm kiếm tệp ![](docs/screenshots/m2-search-files.png) |
| Nhảy tới tin từ kết quả tìm kiếm ![](docs/screenshots/m2-jump-to-message.png) | Thông báo toast ![](docs/screenshots/m2-notification-toast.png) |
| Quản trị — Tổng quan ![](docs/screenshots/m2-admin-dashboard.png) | Quản trị — Người dùng ![](docs/screenshots/m2-admin-users.png) |
| Quản trị — Thành viên kênh ![](docs/screenshots/m2-admin-channel-members.png) | Xác nhận đã đọc thông báo ![](docs/screenshots/m2-announcement-acks.png) |
| Gửi tệp khi mất mạng ![](docs/screenshots/m2-offline-attachment.png) | |

## Cài đặt & chạy trên máy

### 1. Yêu cầu

- **Node.js 20 trở lên** (kèm npm) — kiểm tra: `node -v`
- **Docker Desktop** (để chạy PostgreSQL bằng docker-compose) — *hoặc* PostgreSQL 14+ cài trực tiếp.

### 2. Chạy PostgreSQL bằng Docker

```bash
cd khoachat
docker compose up -d        # tạo container khoachat-postgres ở cổng 5432
docker compose ps           # trạng thái phải là "healthy"
```

> Nếu máy đã có PostgreSQL chiếm cổng 5432: sửa `"5432:5432"` thành `"5433:5432"` trong `docker-compose.yml`
> và đổi `localhost:5432` thành `localhost:5433` trong `server/.env`.
>
> Không dùng Docker? Tạo user & database bằng psql:
> `CREATE USER khoachat WITH PASSWORD 'khoachat' CREATEDB;` và `CREATE DATABASE khoachat OWNER khoachat;`

### 3. Cài thư viện & cấu hình

```bash
npm install                                  # cài cho cả server và client (npm workspaces), tự chạy prisma generate
cp server/.env.example server/.env           # Windows: copy server\.env.example server\.env
```

`server/.env`:

```env
DATABASE_URL="postgresql://khoachat:khoachat@localhost:5432/khoachat?schema=public"
JWT_SECRET="doi-chuoi-bi-mat-nay-khi-trien-khai"
PORT=4000
CLIENT_ORIGIN="http://localhost:5173"
# ALLOWED_EMAIL_DOMAIN="student.ctu.edu.vn"   # (tuỳ chọn) chỉ cho đăng ký bằng email trường
# VAPID_PUBLIC_KEY="" / VAPID_PRIVATE_KEY=""   # (tuỳ chọn) khoá Web Push
```

**Web Push (VAPID)**: nếu không khai báo `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`, lần chạy đầu server tự sinh cặp khoá và lưu vào
`server/.vapid.json` (đừng xoá file này, nếu không các trình duyệt đã đăng ký sẽ phải đăng ký lại). Muốn tự tạo: `npx web-push generate-vapid-keys`.
Web Push chỉ hoạt động trên `http://localhost` hoặc **HTTPS** (yêu cầu của trình duyệt); mở bằng IP mạng LAN thì vẫn có toast + âm báo nhưng không có push.

### 4. Tạo bảng & dữ liệu mẫu

```bash
npm run db:migrate     # chạy migration Prisma (tạo bảng + chỉ mục full-text search)
npm run db:seed        # tạo dữ liệu mẫu (XOÁ dữ liệu cũ!)
```

### 5. Chạy chế độ phát triển

```bash
npm run dev            # chạy song song server (cổng 4000) và client (cổng 5173)
```

Mở **http://localhost:5173** và đăng nhập bằng một tài khoản bên dưới.
Client (Vite) chuyển tiếp `/api` và `/socket.io` sang server nên không cần cấu hình CORS khi phát triển.
Điện thoại cùng mạng Wi-Fi có thể mở `http://<IP-máy-tính>:5173`.

### 6. Kiểm thử tự động

Khi server đang chạy (`npm run dev`):

```bash
npm test                  # chạy cả hai bộ bên dưới
npm run test:realtime     # 25 tình huống realtime (Milestone 1)
npm run test:features     # 92 tình huống tính năng Milestone 2
```

- `scripts/test-realtime.ts`: từ chối token sai, gửi/nhận realtime, chống trùng `clientId` (socket & REST), đang soạn tin,
  đồng bộ đã đọc giữa 2 tab, không lùi trạng thái đọc, phân quyền kênh thông báo, tải bù sau khi mất kết nối, phân trang, presence.
- `scripts/test-features.ts`: tải tệp (giới hạn 20MB → 413, loại cấm → 415, giả mạo đuôi ảnh, tên tiếng Việt), **quyền xem tệp**
  (người ngoài kênh 403, cookie, tệp của tin đã xoá), @nhắc tên (lọc người ngoài kênh, `@all` chỉ GV, đếm huy hiệu), ghim / bỏ ghim
  theo quyền + realtime, trả lời / sửa / xoá, tìm kiếm không dấu + bộ lọc + phạm vi kênh, tìm tệp, nhảy tới tin (`around`),
  mức thông báo, **Web Push** (server push giả lập chạy cục bộ, giải mã payload), xác nhận đã đọc, trang quản trị
  (người dùng, khoá → ngắt socket, CSV, kênh, thêm hàng loạt, giảng viên chỉ quản lý lớp mình, lưu trữ, xoá).

> Các bài test **ghi vào DB** — chạy `npm run db:seed` để trả lại dữ liệu mẫu sạch trước khi demo.

### Các lệnh khác

| Lệnh | Tác dụng |
|---|---|
| `npm run db:reset` | Xoá sạch DB, chạy lại migration + seed |
| `npx prisma studio` (trong `server/`) | Xem/sửa dữ liệu bằng giao diện web |
| `npm run build` | Build server (`server/dist`) và client (`client/dist`) |

## Tài khoản mẫu

| Vai trò | Email | Mật khẩu | Ghi chú |
|---|---|---|---|
| Quản trị viên | `admin@khoachat.edu.vn` | `Admin@123` | Quản trị viên Khoa |
| Giảng viên | `gv.an@khoachat.edu.vn` | `GiangVien@123` | TS. Nguyễn Văn An — CT101 |
| Giảng viên | `gv.binh@khoachat.edu.vn` | `GiangVien@123` | ThS. Trần Thị Bình — CT275 |
| Sinh viên | `sv01@khoachat.edu.vn` | `SinhVien@123` | Lê Minh Châu — CT101, CT275, có tin chưa đọc để demo |
| Sinh viên | `sv02@khoachat.edu.vn` | `SinhVien@123` | Phạm Quốc Dũng — CT101, CT275 |
| Sinh viên | `sv03@khoachat.edu.vn` | `SinhVien@123` | Hoàng Thu Hà — CT101, CT275 |
| Sinh viên | `sv04@khoachat.edu.vn` | `SinhVien@123` | Võ Thanh Hải — CT101 |
| Sinh viên | `sv05@khoachat.edu.vn` | `SinhVien@123` | Đặng Ngọc Lan — CT101, CT275 |
| Sinh viên | `sv06@khoachat.edu.vn` | `SinhVien@123` | Bùi Gia Khang — CT275 |

Kênh mẫu: **Thông báo Khoa CNTT** (mọi người), **CT101 · Lập trình căn bản - Nhóm 01**, **CT275 · Công nghệ Web - Nhóm 02**,
và tin nhắn riêng giữa `sv01` ↔ `sv02`. Dữ liệu mẫu có sẵn ảnh (lịch thi, slide), PDF đề cương, CSV, tin đã ghim, tin trả lời,
@nhắc tên / `@all` và thông báo đã có người xác nhận đọc (tệp mẫu nằm ở `server/prisma/seed-assets/`, được chép vào `server/uploads/seed/`).

## Gợi ý demo trước hội đồng

1. **Realtime + đang soạn tin**: mở 2 trình duyệt (hoặc 1 cửa sổ ẩn danh), đăng nhập `sv01` và `gv.an`, cùng mở kênh CT101.
2. **Đồng bộ đã đọc**: đăng nhập `sv01` ở 2 trình duyệt. Mở kênh có badge đỏ ở bên này → badge bên kia tự mất.
3. **Mất mạng không mất tin**: DevTools → tab *Network* → chọn *Offline* (hoặc tắt Wi-Fi / tắt server). Gửi vài tin → hiện ⏳ *Đang gửi*.
   Có thể tải lại trang, tin vẫn còn. Bật mạng lại → tin tự gửi, người nhận thấy ngay; tin người khác gửi lúc bạn offline được tải bù.
4. **Phân quyền**: `sv01` vào *Thông báo Khoa CNTT* thấy ô nhập bị khoá; `gv.an` đăng được.
5. **File & ảnh**: kéo một ảnh vào khung chat CT101 → thanh tiến trình → gửi → bên kia thấy thumbnail, bấm mở lightbox. Thử tệp `.exe` → bị từ chối.
6. **@nhắc tên**: `gv.an` gõ `@ch` → chọn *Lê Minh Châu* → bên `sv01` có toast "đã nhắc đến bạn", tin nền vàng, huy hiệu **@** ở sidebar.
7. **Ghim & tìm kiếm**: `gv.an` ghim một tin → thanh ghim hiện ngay bên `sv01`. Bấm `Ctrl+K`, gõ `lich thi` (không dấu) → bấm kết quả để nhảy tới tin.
8. **Thông báo đẩy**: `sv01` bấm chuông cạnh tên mình → *Bật* → cho phép. Đóng tab. `sv02` nhắn riêng cho `sv01` → thông báo hệ điều hành hiện ra.
9. **Quản trị**: đăng nhập `admin` → *Trang quản trị* → khoá `sv04` (đang đăng nhập ở máy khác sẽ bị đăng xuất ngay), nhập CSV, tạo lớp mới và thêm hàng loạt bằng MSSV.
10. **Xác nhận đã đọc**: `sv01` bấm "Tôi đã đọc" ở kênh thông báo → `gv.an` / `admin` thấy số xác nhận tăng realtime, bấm xem ai chưa đọc.

## Cấu trúc thư mục

```
khoachat/
├── docker-compose.yml          # PostgreSQL 16
├── package.json                # npm workspaces + lệnh chung (dev, db:migrate, db:seed...)
├── scripts/
│   ├── test-realtime.ts        # kiểm thử realtime bằng socket.io-client (M1)
│   └── test-features.ts        # kiểm thử file, mention, ghim, tìm kiếm, push, quản trị (M2)
├── docs/screenshots/           # ảnh chụp giao diện
├── server/
│   ├── .env.example
│   ├── uploads/                # tệp đính kèm (không public, không đưa lên git)
│   ├── prisma/
│   │   ├── schema.prisma       # User, Channel, ChannelMember, Message, Attachment, Mention, MessageAck, PushSubscription
│   │   ├── migrations/         # init + add_fulltext_search (tsvector, GIN, unaccent) + milestone2_features
│   │   ├── seed-assets/        # ảnh / PDF / CSV mẫu
│   │   └── seed.ts             # dữ liệu mẫu
│   └── src/
│       ├── index.ts            # Express app + HTTP server
│       ├── env.ts, prisma.ts, errors.ts, presence.ts
│       ├── auth.ts             # JWT (Bearer + cookie httpOnly cho GET), requireAuth / requireRole
│       ├── serialize.ts        # chuyển Message / Attachment sang JSON
│       ├── realtime.ts         # Socket.IO: xác thực handshake, phòng, sự kiện, presence
│       ├── routes/auth.ts      # /api/auth/register, /login, /me, /logout
│       ├── routes/chat.ts      # kênh, tin nhắn, sửa/xoá/ghim/xác nhận, đọc, sync, DM
│       ├── routes/files.ts     # tải lên, tải xuống có kiểm quyền, tìm tệp, tài liệu kênh
│       ├── routes/search.ts    # tìm kiếm full-text
│       ├── routes/push.ts      # đăng ký Web Push
│       ├── routes/admin.ts     # thống kê, người dùng, kênh, thành viên
│       └── services/           # channels.ts (quyền), messages.ts, files.ts (multer, allowlist), notify.ts (web-push)
└── client/
    ├── vite.config.ts          # proxy /api, /socket.io -> server
    ├── public/sw.js            # service worker nhận Web Push
    └── src/
        ├── App.tsx             # đăng nhập / vào ứng dụng, toast, đăng ký service worker
        ├── types.ts
        ├── lib/                # api.ts (+ upload có tiến trình), outbox.ts (IndexedDB), files.ts, text.ts, notify.ts, format.ts
        ├── state/
        │   ├── reducer.ts      # kênh, tin, ghim, online, typing, kết nối, nhảy tới tin
        │   ├── ChatContext.tsx # socket, outbox (kèm tệp), tải bù, đã đọc, thông báo
        │   └── toast.tsx
        └── components/         # Sidebar, ChannelView, MessageList/Item, Composer, RightPanel, SearchModal,
                                # Attachments (lightbox), AckModal, NotifyMenu, admin/ (Dashboard, Users, Channels, Members)
```

## Thiết kế chính

### Cơ sở dữ liệu (Prisma)

- `User` — `role` (STUDENT / LECTURER / ADMIN), `email`, `name`, `passwordHash`, `avatar`, `studentCode`, `locked`, `lastSeenAt`.
- `Channel` — `type` (CLASS / ANNOUNCEMENT / DIRECT), `name`, `courseCode`, `description`, `directKey` (duy nhất cho mỗi cặp người dùng DM), `archived`.
- `ChannelMember` — `role` (OWNER / MODERATOR / MEMBER), `lastReadMessageId`, `lastReadAt`, `notifyLevel` (DEFAULT / ALL / MENTIONS / NONE).
- `Message` — `seq` (số tăng dần, dùng để phân trang & tải bù), `clientId` (unique, chống trùng), `content`, `type`, `replyToId`,
  `pinned`/`pinnedAt`/`pinnedById`, `createdAt`, `editedAt`, `deletedAt`, `searchVector` (tsvector tự sinh).
- `Attachment` — `channelId` (để kiểm quyền), `messageId` (null khi mới tải lên, chưa gửi), `uploaderId`, `filename`, `mime`, `size`, `path`.
- `Mention` — tin nhắn ↔ người được nhắc; `Message.mentionAll` cho `@all`.
- `MessageAck` — ai đã xác nhận đọc thông báo nào. `PushSubscription` — endpoint + khoá Web Push của từng trình duyệt.

Tìm kiếm toàn văn (migration `add_fulltext_search`): cột `searchVector` là cột *generated* từ `content`, có chỉ mục GIN,
dùng `unaccent` để gõ không dấu vẫn tìm được, ví dụ:

```sql
SELECT * FROM "Message"
WHERE "searchVector" @@ to_tsquery('simple', 'lich:* & thi:*');   -- từ khoá đã được bỏ dấu ở server, hỗ trợ gõ dở (tiền tố)
```

### Sự kiện Socket.IO

| Hướng | Sự kiện | Dữ liệu |
|---|---|---|
| client → server | `message:send` (có ack) | `{ channelId, clientId, content, replyToId?, attachmentIds?, mentionIds? }` → `{ ok, message, duplicate }` |
| client → server | `message:edit` · `message:delete` (có ack) | `{ messageId, content }` · `{ messageId }` |
| client → server | `message:pin` · `message:ack` (có ack) | `{ messageId, pinned }` · `{ messageId }` (xác nhận đã đọc thông báo) |
| client → server | `channel:read` (có ack) | `{ channelId, messageId }` → `{ ok, lastReadSeq, unreadCount, ... }` |
| client → server | `typing` | `{ channelId, isTyping }` |
| server → client | `message:new` | tin nhắn mới (phát vào phòng `channel:<id>`) |
| server → client | `message:updated` · `message:pinned` | tin được sửa / xoá / ghim / có người xác nhận |
| server → client | `channel:read` | trạng thái đọc mới, gửi tới **mọi thiết bị** của người đó (phòng `user:<id>`) |
| server → client | `channel:receipt` | người khác đã đọc tới đâu (cho tính năng "Đã xem" sau này) |
| server → client | `typing`, `presence`, `presence:init` | đang soạn tin, online/offline |
| server → client | `channel:new` · `channel:changed` · `channel:removed` | được thêm vào kênh · kênh đổi thông tin/thành viên · bị xoá khỏi kênh / kênh lưu trữ |
| server → client | `session:revoked` | tài khoản bị khoá → client đăng xuất |

### REST API

| Method | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/api/auth/register` · `/api/auth/login` | Đăng ký / đăng nhập → `{ token, user }` |
| GET | `/api/auth/me` | Thông tin người dùng hiện tại |
| GET | `/api/channels` · `/api/channels/:id` | Kênh của tôi (kèm số chưa đọc, tin cuối, thành viên) |
| GET | `/api/channels/:id/messages?before=<seq>&limit=30` | Lịch sử (tin cũ hơn); `?after=<seq>` để lấy tin mới hơn |
| POST | `/api/channels/:id/messages` | Gửi tin qua REST (dự phòng, cũng chống trùng `clientId`) |
| POST | `/api/channels/:id/read` | Đánh dấu đã đọc |
| GET | `/api/sync?after=<seq>` | Tải bù mọi tin bị lỡ + danh sách kênh mới nhất |
| GET | `/api/users` · POST `/api/direct` | Danh sách người dùng · mở/tạo tin nhắn riêng |
| GET | `/api/channels/:id/messages?around=<messageId>` | Ngữ cảnh quanh một tin (nhảy tới tin) |
| PATCH · DELETE | `/api/messages/:id` | Sửa · xoá tin |
| POST | `/api/messages/:id/pin` · GET `/api/channels/:id/pins` | Ghim/bỏ ghim `{ pinned }` · danh sách tin ghim |
| POST · GET | `/api/messages/:id/ack` · `/api/messages/:id/acks` | Xác nhận đã đọc · danh sách đã/chưa xác nhận |
| PATCH | `/api/channels/:id/settings` | Mức thông báo `{ notifyLevel }` |
| POST | `/api/channels/:id/uploads` | Tải tệp lên (multipart, trường `file`) → `{ attachment }` |
| GET | `/api/files/:id` (`?download=1`) | Xem / tải tệp (chỉ thành viên kênh) |
| GET | `/api/channels/:id/files?kind=` · `/api/search/files?q=&kind=&channelId=&senderId=` | Tài liệu của kênh · tìm tệp |
| GET | `/api/search/messages?q=&channelId=&senderId=&hasFile=1` | Tìm tin nhắn |
| GET · POST | `/api/push/public-key` · `/api/push/subscribe` · `/api/push/unsubscribe` | Web Push |
| GET | `/api/admin/stats` | Thống kê (ADMIN) |
| GET · POST · PATCH | `/api/admin/users` · `/api/admin/users/:id` · `/reset-password` · `/import` | Quản lý người dùng (ADMIN) |
| GET · POST · PATCH · DELETE | `/api/admin/channels[/:id]` · `/api/admin/channels/:id/members[/:userId]` | Quản lý kênh & thành viên (ADMIN; GV với lớp mình phụ trách) |

Mọi API (trừ đăng ký/đăng nhập) cần header `Authorization: Bearer <token>`. Riêng các request GET cũng chấp nhận cookie httpOnly `kc_token`
(đặt khi đăng nhập) để ảnh/tệp hiển thị được bằng thẻ `<img>` / link tải.

## Lỗi thường gặp

- **`Can't reach database server at localhost:5432`** → chưa chạy `docker compose up -d` hoặc sai cổng trong `server/.env`.
- **`P1010 / permission denied` khi migrate** → user PostgreSQL cần quyền `CREATEDB` (Prisma tạo shadow database khi `migrate dev`).
- **Cảnh báo `package.json#prisma is deprecated`** → chỉ là cảnh báo của Prisma 6, không ảnh hưởng.
- **npm 11 báo `install-scripts ... not covered by allowScripts`** → đã khai báo sẵn trong `package.json` gốc; nếu vẫn báo, chạy
  `npm install-scripts approve @prisma/client @prisma/engines prisma esbuild` rồi `npm rebuild`.
- **Đăng nhập xong không thấy kênh** → chạy lại `npm run db:seed`.
- **Ảnh mẫu không hiện (404)** → thư mục `server/uploads/` bị xoá; chạy lại `npm run db:seed` để chép lại tệp mẫu.
- **Không bật được thông báo đẩy** → trình duyệt đã chặn quyền thông báo cho trang (bấm biểu tượng ổ khoá trên thanh địa chỉ để cho phép), hoặc đang mở bằng IP LAN qua HTTP (Web Push cần `localhost` hoặc HTTPS).
- **Tải tệp báo "Loại tệp không được hỗ trợ"** → chỉ các đuôi trong danh sách cho phép; ảnh/PDF còn bị kiểm tra nội dung thật (đổi đuôi `.exe` thành `.png` sẽ bị chặn).

## Hướng phát triển thêm

- Bình chọn nhanh trong lớp, "giờ yên tĩnh" cho thông báo, giao diện mobile / PWA cài đặt được.
- Lưu tệp lên dịch vụ lưu trữ đối tượng (S3/MinIO) thay cho thư mục `uploads/` khi triển khai nhiều máy chủ; Socket.IO Redis adapter.
- Quét virus tệp tải lên (ClamAV), xem trước PDF ngay trong ứng dụng.
