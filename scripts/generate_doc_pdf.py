import os
import sys
import base64
import subprocess

def get_base64_image(rel_path):
    abs_path = os.path.abspath(rel_path)
    if not os.path.exists(abs_path):
        print(f"Warning: {abs_path} not found")
        return ""
    with open(abs_path, "rb") as f:
        data = f.read()
    return f"data:image/png;base64,{base64.b64encode(data).decode('utf-8')}"

def build_html():
    img_login = get_base64_image("docs/screenshots/screenshot-login.png")
    img_chat = get_base64_image("docs/screenshots/chat.png")

    html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>KhoaChat - Báo Cáo Mốc 1: Phân Tích Và Thiết Kế</title>
<style>
  @page {{
    size: A4;
    margin: 12mm 16mm 14mm 16mm;
  }}
  
  *, *::before, *::after {{
    box-sizing: border-box;
  }}

  body {{
    font-family: 'Segoe UI', Arial, -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 9pt;
    line-height: 1.42;
    color: #1e293b;
    background: #ffffff;
    margin: 0;
    padding: 0;
  }}

  .page {{
    page-break-after: always;
    page-break-inside: avoid;
    height: 269mm;
    min-height: 269mm;
    max-height: 269mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-sizing: border-box;
    position: relative;
  }}
  .page:last-child {{
    page-break-after: avoid;
  }}

  .content-wrap {{
    flex: 1 0 auto;
  }}

  /* Header & Footer */
  .doc-header {{
    border-bottom: 2px solid #2563eb;
    padding-bottom: 5px;
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8pt;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }}

  .doc-header .subject {{
    color: #1e40af;
  }}

  .page-footer {{
    flex-shrink: 0;
    margin-top: auto;
    padding-top: 6px;
    border-top: 1px solid #cbd5e1;
    font-size: 8pt;
    color: #64748b;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }}

  /* Typography */
  h1, h2, h3, h4 {{
    color: #0f172a;
    margin-top: 0;
    font-weight: 700;
  }}

  .brand-badge {{
    display: inline-block;
    font-size: 11pt;
    font-weight: 800;
    color: #2563eb;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 2px;
  }}

  h1.main-title {{
    font-size: 16pt;
    color: #1e3a8a;
    margin-bottom: 3px;
    text-align: center;
    letter-spacing: -0.3px;
    line-height: 1.25;
  }}

  .subtitle {{
    font-size: 9.5pt;
    color: #475569;
    text-align: center;
    margin-bottom: 10px;
    font-weight: 500;
  }}

  .meta-card {{
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 4px solid #2563eb;
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 10px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 12px;
    font-size: 8.5pt;
  }}

  .meta-item strong {{
    color: #1e293b;
  }}

  h2.section-title {{
    font-size: 11.5pt;
    color: #1e40af;
    border-bottom: 1.5px solid #dbeafe;
    padding-bottom: 4px;
    margin-top: 6px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
  }}

  h2.section-title .badge {{
    background: #2563eb;
    color: #ffffff;
    font-size: 8pt;
    padding: 2px 7px;
    border-radius: 4px;
    margin-right: 7px;
  }}

  h3.subsection-title {{
    font-size: 9.5pt;
    color: #1e293b;
    margin-top: 8px;
    margin-bottom: 5px;
    font-weight: 700;
  }}

  p {{
    margin: 0 0 6px 0;
    text-align: justify;
    font-size: 8.8pt;
  }}

  /* Lists */
  .cn-list {{
    list-style: none;
    padding-left: 0;
    margin: 0;
  }}

  .cn-list li {{
    padding: 3.2px 7px;
    margin-bottom: 2.2px;
    background: #f8fafc;
    border-left: 3px solid #3b82f6;
    border-radius: 0 3px 3px 0;
    font-size: 8.2pt;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }}

  .cn-list li:nth-child(even) {{
    background: #f1f5f9;
  }}

  .cn-left {{
    display: flex;
    align-items: baseline;
    gap: 6px;
    overflow: hidden;
  }}

  .cn-code {{
    font-weight: 700;
    color: #1d4ed8;
    min-width: 44px;
    font-family: 'Consolas', monospace;
    font-size: 8.5pt;
  }}

  .cn-sep {{
    color: #94a3b8;
    font-weight: 600;
  }}

  .cn-name {{
    font-weight: 600;
    color: #1e293b;
  }}

  .cn-actor {{
    font-size: 7.5pt;
    padding: 1px 6px;
    border-radius: 10px;
    font-weight: 600;
    white-space: nowrap;
    margin-left: 8px;
  }}

  .actor-student {{ background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }}
  .actor-lecturer {{ background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }}
  .actor-admin {{ background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }}
  .actor-all {{ background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }}

  /* Tables */
  table.data-table {{
    width: 100%;
    border-collapse: collapse;
    margin: 6px 0 8px 0;
    font-size: 8pt;
    line-height: 1.35;
  }}

  table.data-table th {{
    background: #1e40af;
    color: #ffffff;
    font-weight: 600;
    padding: 5px 8px;
    text-align: left;
    border: 1px solid #1e3a8a;
  }}

  table.data-table td {{
    padding: 5px 8px;
    border: 1px solid #cbd5e1;
    vertical-align: top;
  }}

  table.data-table tr:nth-child(even) td {{
    background: #f8fafc;
  }}

  .tag {{
    display: inline-block;
    padding: 1px 5px;
    font-size: 7pt;
    font-weight: 700;
    border-radius: 3px;
    margin-right: 3px;
    line-height: 1.2;
  }}

  .tag-pk {{ background: #fef08a; color: #854d0e; border: 1px solid #facc15; }}
  .tag-fk {{ background: #bfdbfe; color: #1e40af; border: 1px solid #93c5fd; }}
  .tag-uk {{ background: #e9d5ff; color: #6b21a8; border: 1px solid #d8b4fe; }}

  /* Diagrams */
  .diagram-container {{
    text-align: center;
    margin: 6px 0 6px 0;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #ffffff;
    padding: 6px;
  }}

  .diagram-caption {{
    font-size: 8pt;
    font-weight: 600;
    color: #475569;
    margin-top: 4px;
    font-style: italic;
  }}

  /* Screenshot Containers */
  .screenshot-box {{
    margin: 6px 0;
    text-align: center;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 4px;
    background: #f8fafc;
  }}

  .screenshot-img {{
    max-width: 96%;
    height: auto;
    max-height: 220px;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
    display: block;
    margin: 0 auto;
    object-fit: contain;
  }}

  .screenshot-caption {{
    font-size: 8pt;
    font-weight: 600;
    color: #334155;
    margin-top: 4px;
  }}

  .info-callout {{
    background: #eff6ff;
    border-left: 3px solid #3b82f6;
    padding: 6px 10px;
    font-size: 8pt;
    color: #1e3a8a;
    border-radius: 0 4px 4px 0;
    margin: 6px 0;
    line-height: 1.35;
  }}
</style>
</head>
<body>

  <!-- ==================== TRANG 1: DANH SÁCH CHỨC NĂNG ==================== -->
  <div class="page">
    <div class="content-wrap">
      <div class="doc-header">
        <span class="subject">Báo Cáo Niên Luận Ngành CNTT</span>
        <span>Học kỳ I — Năm học 2026 - 2027</span>
      </div>

      <div style="text-align: center; margin-top: 4px; margin-bottom: 8px;">
        <span class="brand-badge">KHOACHAT</span>
        <h1 class="main-title">ỨNG DỤNG NHẮN TIN NỘI BỘ CHO LỚP HỌC & KHOA</h1>
        <div class="subtitle">Báo cáo Mốc 1: Phân tích yêu cầu và Thiết kế hệ thống</div>
      </div>

      <div class="meta-card">
        <div class="meta-item"><strong>Hạn nộp mốc 1:</strong> Thứ Hai, 09/11/2026</div>
        <div class="meta-item"><strong>Mục tiêu:</strong> Phân tích & Thiết kế, Chạy trang đầu tiên</div>
        <div class="meta-item"><strong>Sinh viên 1:</strong> Nguyễn Huyền Linh (Frontend & Client)</div>
        <div class="meta-item"><strong>Sinh viên 2:</strong> Nguyễn Tấn Phát (Backend & Database)</div>
      </div>

      <h2 class="section-title"><span class="badge">1</span> Danh Sách Chức Năng Hệ Thống</h2>
      <p style="margin-bottom: 6px;">
        Hệ thống KhoaChat được thiết kế gồm 20 chức năng trọng tâm, phân quyền chặt chẽ cho 3 đối tượng tác nhân: <strong>Sinh viên</strong>, <strong>Giảng viên</strong> và <strong>Quản trị viên</strong>. Định dạng theo đúng yêu cầu: <em>[Mã CN] – [Tên chức năng] – [Đối tượng sử dụng]</em>:
      </p>

      <ul class="cn-list">
        <li>
          <div class="cn-left"><span class="cn-code">CN01</span><span class="cn-sep">–</span><span class="cn-name">Đăng ký tài khoản người dùng mới</span></div>
          <span class="cn-actor actor-student">Sinh viên, Giảng viên</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN02</span><span class="cn-sep">–</span><span class="cn-name">Đăng nhập, đăng xuất và quản lý phiên làm việc</span></div>
          <span class="cn-actor actor-all">Sinh viên, Giảng viên, Quản trị viên</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN03</span><span class="cn-sep">–</span><span class="cn-name">Khóa tài khoản và thu hồi phiên truy cập tức thời</span></div>
          <span class="cn-actor actor-admin">Quản trị viên</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN04</span><span class="cn-sep">–</span><span class="cn-name">Xem danh sách kênh thảo luận và lớp học phần</span></div>
          <span class="cn-actor actor-all">Tất cả người dùng đã đăng nhập</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN05</span><span class="cn-sep">–</span><span class="cn-name">Tạo và mở cuộc trò chuyện trực tiếp riêng (1-1)</span></div>
          <span class="cn-actor actor-student">Sinh viên, Giảng viên</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN06</span><span class="cn-sep">–</span><span class="cn-name">Gửi và nhận tin nhắn thời gian thực (Realtime chat)</span></div>
          <span class="cn-actor actor-all">Sinh viên, Giảng viên, Quản trị viên</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN07</span><span class="cn-sep">–</span><span class="cn-name">Hiển thị trạng thái đang soạn tin và người dùng trực tuyến</span></div>
          <span class="cn-actor actor-all">Tất cả người dùng đã đăng nhập</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN08</span><span class="cn-sep">–</span><span class="cn-name">Lưu hàng đợi outbox khi mất mạng và tự động đồng bộ bù</span></div>
          <span class="cn-actor actor-student">Sinh viên, Giảng viên</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN09</span><span class="cn-sep">–</span><span class="cn-name">Gửi, đính kèm và xem trước hình ảnh, tệp tin học tập</span></div>
          <span class="cn-actor actor-student">Sinh viên, Giảng viên</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN10</span><span class="cn-sep">–</span><span class="cn-name">Nhắc tên thành viên (@mention) và thông báo toàn kênh (@all)</span></div>
          <span class="cn-actor actor-all">Sinh viên, Giảng viên, Quản trị viên</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN11</span><span class="cn-sep">–</span><span class="cn-name">Ghim tin nhắn, trả lời trích dẫn, sửa và thu hồi tin</span></div>
          <span class="cn-actor actor-all">Người gửi, Giảng viên, Quản trị viên</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN12</span><span class="cn-sep">–</span><span class="cn-name">Tìm kiếm tin nhắn không dấu và tìm kiếm tệp tài liệu</span></div>
          <span class="cn-actor actor-all">Tất cả người dùng đã đăng nhập</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN13</span><span class="cn-sep">–</span><span class="cn-name">Cấu hình mức độ thông báo theo từng kênh</span></div>
          <span class="cn-actor actor-all">Tất cả người dùng đã đăng nhập</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN14</span><span class="cn-sep">–</span><span class="cn-name">Thông báo đẩy đa kênh (In-app Toast, Browser Notification, Web Push)</span></div>
          <span class="cn-actor actor-all">Tất cả người dùng đã đăng nhập</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN15</span><span class="cn-sep">–</span><span class="cn-name">Tự động ghi nhận đã đọc khi xem tin và thống kê lượt xem thông báo</span></div>
          <span class="cn-actor actor-student">Sinh viên, Giảng viên</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN16</span><span class="cn-sep">–</span><span class="cn-name">Quản lý danh sách thành viên trong lớp học phần và kênh chat</span></div>
          <span class="cn-actor actor-lecturer">Giảng viên, Quản trị viên</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN17</span><span class="cn-sep">–</span><span class="cn-name">Quản trị người dùng, phân vai trò và nhập danh sách qua CSV</span></div>
          <span class="cn-actor actor-admin">Quản trị viên</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN18</span><span class="cn-sep">–</span><span class="cn-name">Quản lý kênh học tập (Tạo, chỉnh sửa, lưu trữ, khôi phục, xóa)</span></div>
          <span class="cn-actor actor-lecturer">Giảng viên, Quản trị viên</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN19</span><span class="cn-sep">–</span><span class="cn-name">Xem thống kê đo lường hoạt động và biểu đồ tương tác</span></div>
          <span class="cn-actor actor-admin">Quản trị viên</span>
        </li>
        <li>
          <div class="cn-left"><span class="cn-code">CN20</span><span class="cn-sep">–</span><span class="cn-name">Bảo mật hệ thống bằng JWT, phân quyền RBAC và kiểm tra chữ ký tệp</span></div>
          <span class="cn-actor actor-admin">Hệ thống / Quản trị viên</span>
        </li>
      </ul>
    </div>

    <div class="page-footer">
      <span>KhoaChat – Mốc 1: Phân tích & Thiết kế</span>
      <span>Trang 1 / 6</span>
    </div>
  </div>

  <!-- ==================== TRANG 2: SƠ ĐỒ USE CASE ==================== -->
  <div class="page">
    <div class="content-wrap">
      <div class="doc-header">
        <span class="subject">Báo Cáo Niên Luận Ngành CNTT</span>
        <span>Mốc 1: Phân Tích và Thiết Kế</span>
      </div>

      <h2 class="section-title"><span class="badge">2</span> Sơ Đồ Use Case Tổng Quát</h2>
      <p>
        Hệ thống phân định 3 nhóm tác nhân chính: <strong>Sinh viên</strong> (giao tiếp, nộp file, hệ thống tự động ghi nhận trạng thái đã đọc khi mở xem kênh), <strong>Giảng viên</strong> (điều hành lớp học phần, đăng thông báo, ghim tin, theo dõi danh sách ai đã xem / chưa xem thông báo) và <strong>Quản trị viên</strong> (quản lý người dùng qua CSV, phân quyền, thống kê). Tất cả tương tác đều được xác thực tập trung bằng token JWT an toàn.
      </p>

      <div class="diagram-container">
        <svg viewBox="0 0 850 510" width="100%" height="445" xmlns="http://www.w3.org/2000/svg" style="font-family: 'Segoe UI', Arial, sans-serif;">
          <!-- Definitions -->
          <defs>
            <filter id="shadow-uc" x="-5%" y="-5%" width="110%" height="110%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.08"/>
            </filter>
          </defs>

          <!-- System Boundary -->
          <rect x="180" y="20" width="480" height="475" rx="12" fill="#f8fafc" stroke="#2563eb" stroke-width="2" filter="url(#shadow-uc)"/>
          <rect x="180" y="20" width="480" height="34" rx="12" fill="#1e40af"/>
          <rect x="180" y="42" width="480" height="12" fill="#1e40af"/>
          <text x="420" y="43" fill="#ffffff" font-size="12" font-weight="700" text-anchor="middle" letter-spacing="0.5">HỆ THỐNG TIN NHẮN NỘI BỘ KHOACHAT</text>

          <!-- Actor Left: Sinh vien -->
          <g transform="translate(60, 115)">
            <circle cx="25" cy="18" r="14" fill="#dbeafe" stroke="#1d4ed8" stroke-width="2"/>
            <line x1="25" y1="32" x2="25" y2="72" stroke="#1d4ed8" stroke-width="2"/>
            <line x1="5" y1="48" x2="45" y2="48" stroke="#1d4ed8" stroke-width="2"/>
            <line x1="25" y1="72" x2="8" y2="104" stroke="#1d4ed8" stroke-width="2"/>
            <line x1="25" y1="72" x2="42" y2="104" stroke="#1d4ed8" stroke-width="2"/>
            <rect x="-15" y="112" width="80" height="22" rx="4" fill="#1e40af"/>
            <text x="25" y="127" fill="#ffffff" font-size="10.5" font-weight="700" text-anchor="middle">Sinh viên</text>
          </g>

          <!-- Actor Left: Giang vien -->
          <g transform="translate(60, 310)">
            <circle cx="25" cy="18" r="14" fill="#fef3c7" stroke="#b45309" stroke-width="2"/>
            <line x1="25" y1="32" x2="25" y2="72" stroke="#b45309" stroke-width="2"/>
            <line x1="5" y1="48" x2="45" y2="48" stroke="#b45309" stroke-width="2"/>
            <line x1="25" y1="72" x2="8" y2="104" stroke="#b45309" stroke-width="2"/>
            <line x1="25" y1="72" x2="42" y2="104" stroke="#b45309" stroke-width="2"/>
            <rect x="-18" y="112" width="86" height="22" rx="4" fill="#b45309"/>
            <text x="25" y="127" fill="#ffffff" font-size="10.5" font-weight="700" text-anchor="middle">Giảng viên</text>
          </g>

          <!-- Actor Right: Quan tri vien -->
          <g transform="translate(730, 210)">
            <circle cx="25" cy="18" r="14" fill="#fee2e2" stroke="#b91c1c" stroke-width="2"/>
            <line x1="25" y1="32" x2="25" y2="72" stroke="#b91c1c" stroke-width="2"/>
            <line x1="5" y1="48" x2="45" y2="48" stroke="#b91c1c" stroke-width="2"/>
            <line x1="25" y1="72" x2="8" y2="104" stroke="#b91c1c" stroke-width="2"/>
            <line x1="25" y1="72" x2="42" y2="104" stroke="#b91c1c" stroke-width="2"/>
            <rect x="-22" y="112" width="94" height="22" rx="4" fill="#b91c1c"/>
            <text x="25" y="127" fill="#ffffff" font-size="10.5" font-weight="700" text-anchor="middle">Quản trị viên</text>
          </g>

          <!-- Use Cases Column 1 (Left within Boundary) -->
          <g transform="translate(295, 90)">
            <ellipse cx="0" cy="0" rx="92" ry="19" fill="#ffffff" stroke="#2563eb" stroke-width="1.6"/>
            <text x="0" y="4" font-size="9" font-weight="600" fill="#1e293b" text-anchor="middle">Đăng ký / Đăng nhập</text>
          </g>
          <g transform="translate(295, 146)">
            <ellipse cx="0" cy="0" rx="92" ry="19" fill="#ffffff" stroke="#2563eb" stroke-width="1.6"/>
            <text x="0" y="4" font-size="9" font-weight="600" fill="#1e293b" text-anchor="middle">Nhắn tin thời gian thực</text>
          </g>
          <g transform="translate(295, 202)">
            <ellipse cx="0" cy="0" rx="92" ry="19" fill="#ffffff" stroke="#2563eb" stroke-width="1.6"/>
            <text x="0" y="4" font-size="9" font-weight="600" fill="#1e293b" text-anchor="middle">Trò chuyện trực tiếp 1-1</text>
          </g>
          <g transform="translate(295, 258)">
            <ellipse cx="0" cy="0" rx="92" ry="19" fill="#ffffff" stroke="#2563eb" stroke-width="1.6"/>
            <text x="0" y="4" font-size="9" font-weight="600" fill="#1e293b" text-anchor="middle">Gửi hình ảnh & tệp tin</text>
          </g>
          <g transform="translate(295, 314)">
            <ellipse cx="0" cy="0" rx="92" ry="19" fill="#ffffff" stroke="#2563eb" stroke-width="1.6"/>
            <text x="0" y="4" font-size="9" font-weight="600" fill="#1e293b" text-anchor="middle">Ghim, sửa, xóa, trả lời tin</text>
          </g>
          <g transform="translate(295, 370)">
            <ellipse cx="0" cy="0" rx="92" ry="19" fill="#ffffff" stroke="#2563eb" stroke-width="1.6"/>
            <text x="0" y="4" font-size="9" font-weight="600" fill="#1e293b" text-anchor="middle">Đồng bộ Outbox khi offline</text>
          </g>
          <g transform="translate(295, 426)">
            <ellipse cx="0" cy="0" rx="92" ry="19" fill="#ffffff" stroke="#2563eb" stroke-width="1.6"/>
            <text x="0" y="4" font-size="8.5" font-weight="600" fill="#1e293b" text-anchor="middle">Tự động ghi nhận đã đọc</text>
          </g>

          <!-- Use Cases Column 2 (Right within Boundary) -->
          <g transform="translate(545, 90)">
            <ellipse cx="0" cy="0" rx="92" ry="19" fill="#ffffff" stroke="#2563eb" stroke-width="1.6"/>
            <text x="0" y="4" font-size="9" font-weight="600" fill="#1e293b" text-anchor="middle">Tìm kiếm tin & tài liệu</text>
          </g>
          <g transform="translate(545, 146)">
            <ellipse cx="0" cy="0" rx="92" ry="19" fill="#ffffff" stroke="#2563eb" stroke-width="1.6"/>
            <text x="0" y="4" font-size="9" font-weight="600" fill="#1e293b" text-anchor="middle">Thông báo đa kênh & Push</text>
          </g>
          <g transform="translate(545, 202)">
            <ellipse cx="0" cy="0" rx="92" ry="19" fill="#ffffff" stroke="#059669" stroke-width="1.6"/>
            <text x="0" y="4" font-size="9" font-weight="600" fill="#065f46" text-anchor="middle">Đăng tin thông báo lớp/khoa</text>
          </g>
          <g transform="translate(545, 258)">
            <ellipse cx="0" cy="0" rx="92" ry="19" fill="#ffffff" stroke="#059669" stroke-width="1.6"/>
            <text x="0" y="4" font-size="9" font-weight="600" fill="#065f46" text-anchor="middle">Quản lý thành viên lớp/kênh</text>
          </g>
          <g transform="translate(545, 314)">
            <ellipse cx="0" cy="0" rx="92" ry="19" fill="#ffffff" stroke="#059669" stroke-width="1.6"/>
            <text x="0" y="4" font-size="9" font-weight="600" fill="#065f46" text-anchor="middle">Quản lý kênh học tập</text>
          </g>
          <g transform="translate(545, 370)">
            <ellipse cx="0" cy="0" rx="92" ry="19" fill="#ffffff" stroke="#dc2626" stroke-width="1.6"/>
            <text x="0" y="4" font-size="9" font-weight="600" fill="#991b1b" text-anchor="middle">Quản trị người dùng & CSV</text>
          </g>
          <g transform="translate(545, 426)">
            <ellipse cx="0" cy="0" rx="92" ry="19" fill="#ffffff" stroke="#dc2626" stroke-width="1.6"/>
            <text x="0" y="4" font-size="9" font-weight="600" fill="#991b1b" text-anchor="middle">Thống kê hoạt động hệ thống</text>
          </g>

          <!-- Association Lines: Sinh vien -->
          <line x1="110" y1="155" x2="203" y2="90" stroke="#94a3b8" stroke-width="1.2"/>
          <line x1="110" y1="155" x2="203" y2="146" stroke="#94a3b8" stroke-width="1.2"/>
          <line x1="110" y1="155" x2="203" y2="202" stroke="#94a3b8" stroke-width="1.2"/>
          <line x1="110" y1="155" x2="203" y2="258" stroke="#94a3b8" stroke-width="1.2"/>
          <line x1="110" y1="155" x2="203" y2="314" stroke="#94a3b8" stroke-width="1.2"/>
          <line x1="110" y1="155" x2="203" y2="370" stroke="#94a3b8" stroke-width="1.2"/>
          <line x1="110" y1="155" x2="203" y2="426" stroke="#94a3b8" stroke-width="1.2"/>

          <!-- Association Lines: Giang vien -->
          <line x1="110" y1="350" x2="203" y2="90" stroke="#d97706" stroke-width="1.2"/>
          <line x1="110" y1="350" x2="203" y2="146" stroke="#d97706" stroke-width="1.2"/>
          <line x1="110" y1="350" x2="203" y2="258" stroke="#d97706" stroke-width="1.2"/>
          <line x1="110" y1="350" x2="203" y2="314" stroke="#d97706" stroke-width="1.2"/>
          <line x1="110" y1="350" x2="203" y2="426" stroke="#d97706" stroke-width="1.2"/>
          <line x1="110" y1="350" x2="453" y2="202" stroke="#d97706" stroke-width="1.2"/>
          <line x1="110" y1="350" x2="453" y2="258" stroke="#d97706" stroke-width="1.2"/>
          <line x1="110" y1="350" x2="453" y2="314" stroke="#d97706" stroke-width="1.2"/>

          <!-- Association Lines: Quan tri vien -->
          <line x1="730" y1="250" x2="637" y2="90" stroke="#dc2626" stroke-width="1.2"/>
          <line x1="730" y1="250" x2="637" y2="202" stroke="#dc2626" stroke-width="1.2"/>
          <line x1="730" y1="250" x2="637" y2="258" stroke="#dc2626" stroke-width="1.2"/>
          <line x1="730" y1="250" x2="637" y2="314" stroke="#dc2626" stroke-width="1.2"/>
          <line x1="730" y1="250" x2="637" y2="370" stroke="#dc2626" stroke-width="1.2"/>
          <line x1="730" y1="250" x2="637" y2="426" stroke="#dc2626" stroke-width="1.2"/>
        </svg>
        <div class="diagram-caption">Hình 1. Sơ đồ Use Case tổng quát hệ thống KhoaChat (Tự động ghi nhận đã đọc khi xem tin)</div>
      </div>
    </div>

    <div class="page-footer">
      <span>KhoaChat – Mốc 1: Phân tích & Thiết kế</span>
      <span>Trang 2 / 6</span>
    </div>
  </div>

  <!-- ==================== TRANG 3: SƠ ĐỒ ERD ==================== -->
  <div class="page">
    <div class="content-wrap">
      <div class="doc-header">
        <span class="subject">Báo Cáo Niên Luận Ngành CNTT</span>
        <span>Mốc 1: Phân Tích và Thiết Kế</span>
      </div>

      <h2 class="section-title"><span class="badge">3</span> Thiết Kế Cơ Sở Dữ Liệu: Sơ Đồ Thực Thể Liên Kết (ERD)</h2>
      <p>
        Cơ sở dữ liệu được xây dựng trên hệ quản trị <strong>PostgreSQL 16</strong> và mô hình hóa thông qua <strong>Prisma ORM</strong>. Lược đồ gồm 7 thực thể liên kết chặt chẽ qua các khóa ngoại, ràng buộc toàn vẹn và cơ chế cascade deletion:
      </p>

      <div class="diagram-container">
        <svg viewBox="0 0 850 490" width="100%" height="430" xmlns="http://www.w3.org/2000/svg" style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 8pt;">
          <defs>
            <filter id="erd-card-shadow" x="-5%" y="-5%" width="110%" height="110%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#0f172a" flood-opacity="0.08"/>
            </filter>
          </defs>

          <!-- User Table -->
          <g transform="translate(30, 20)" filter="url(#erd-card-shadow)">
            <rect x="0" y="0" width="170" height="175" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>
            <path d="M 0 6 Q 0 0 6 0 L 164 0 Q 170 0 170 6 L 170 24 L 0 24 Z" fill="#1e40af"/>
            <text x="85" y="16" fill="#ffffff" font-weight="700" text-anchor="middle">User (Người dùng)</text>
            <text x="8" y="42" fill="#b45309" font-weight="700">PK  id : UUID</text>
            <text x="8" y="58" fill="#6b21a8" font-weight="700">UK  email : String</text>
            <text x="8" y="74" fill="#334155">password : String (hash)</text>
            <text x="8" y="90" fill="#334155">name : String</text>
            <text x="8" y="106" fill="#334155">role : Role (SV/GV/Admin)</text>
            <text x="8" y="122" fill="#334155">studentCode : String?</text>
            <text x="8" y="138" fill="#334155">locked : Boolean = false</text>
            <text x="8" y="154" fill="#334155">lastSeenAt : DateTime?</text>
            <text x="8" y="168" fill="#64748b" font-size="7pt">createdAt, updatedAt</text>
          </g>

          <!-- Channel Table -->
          <g transform="translate(260, 20)" filter="url(#erd-card-shadow)">
            <rect x="0" y="0" width="165" height="150" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>
            <path d="M 0 6 Q 0 0 6 0 L 159 0 Q 165 0 165 6 L 165 24 L 0 24 Z" fill="#1e40af"/>
            <text x="82" y="16" fill="#ffffff" font-weight="700" text-anchor="middle">Channel (Kênh chat)</text>
            <text x="8" y="42" fill="#b45309" font-weight="700">PK  id : UUID</text>
            <text x="8" y="58" fill="#334155">type : ChannelType</text>
            <text x="8" y="74" fill="#334155">name : String</text>
            <text x="8" y="90" fill="#334155">description : String?</text>
            <text x="8" y="106" fill="#334155">courseCode : String?</text>
            <text x="8" y="122" fill="#334155">archived : Boolean = false</text>
            <text x="8" y="138" fill="#64748b" font-size="7pt">createdAt, updatedAt</text>
          </g>

          <!-- ChannelMember Table -->
          <g transform="translate(485, 20)" filter="url(#erd-card-shadow)">
            <rect x="0" y="0" width="165" height="155" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>
            <path d="M 0 6 Q 0 0 6 0 L 159 0 Q 165 0 165 6 L 165 24 L 0 24 Z" fill="#4338ca"/>
            <text x="82" y="16" fill="#ffffff" font-weight="700" text-anchor="middle">ChannelMember</text>
            <text x="8" y="42" fill="#b45309" font-weight="700">PK  id : UUID</text>
            <text x="8" y="58" fill="#1d4ed8" font-weight="700">FK  channelId : UUID</text>
            <text x="8" y="74" fill="#1d4ed8" font-weight="700">FK  userId : UUID</text>
            <text x="8" y="90" fill="#334155">role : MemberRole</text>
            <text x="8" y="106" fill="#334155">notifyLevel : NotifyLevel</text>
            <text x="8" y="122" fill="#059669" font-weight="700">lastReadSeq : Int = 0</text>
            <text x="8" y="138" fill="#6b21a8" font-weight="600">UK (channelId, userId)</text>
            <text x="8" y="150" fill="#64748b" font-size="7pt">lastReadAt, joinedAt</text>
          </g>

          <!-- PushSubscription Table -->
          <g transform="translate(685, 20)" filter="url(#erd-card-shadow)">
            <rect x="0" y="0" width="140" height="130" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>
            <path d="M 0 6 Q 0 0 6 0 L 134 0 Q 140 0 140 6 L 140 24 L 0 24 Z" fill="#475569"/>
            <text x="70" y="16" fill="#ffffff" font-weight="700" text-anchor="middle">PushSubscription</text>
            <text x="8" y="42" fill="#b45309" font-weight="700">PK  id : UUID</text>
            <text x="8" y="58" fill="#1d4ed8" font-weight="700">FK  userId : UUID</text>
            <text x="8" y="74" fill="#6b21a8" font-weight="700">UK  endpoint : String</text>
            <text x="8" y="90" fill="#334155">p256dh : String</text>
            <text x="8" y="106" fill="#334155">auth : String</text>
            <text x="8" y="122" fill="#64748b" font-size="7pt">createdAt : DateTime</text>
          </g>

          <!-- Message Table -->
          <g transform="translate(260, 240)" filter="url(#erd-card-shadow)">
            <rect x="0" y="0" width="175" height="210" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>
            <path d="M 0 6 Q 0 0 6 0 L 169 0 Q 175 0 175 6 L 175 24 L 0 24 Z" fill="#0f172a"/>
            <text x="87" y="16" fill="#ffffff" font-weight="700" text-anchor="middle">Message (Tin nhắn)</text>
            <text x="8" y="42" fill="#b45309" font-weight="700">PK  id : UUID</text>
            <text x="8" y="58" fill="#059669" font-weight="700">seq : Int (auto-incr)</text>
            <text x="8" y="74" fill="#6b21a8" font-weight="700">UK  clientId : String</text>
            <text x="8" y="90" fill="#1d4ed8" font-weight="700">FK  channelId : UUID</text>
            <text x="8" y="106" fill="#1d4ed8" font-weight="700">FK  senderId : UUID</text>
            <text x="8" y="122" fill="#1d4ed8">FK  replyToId : UUID?</text>
            <text x="8" y="138" fill="#1d4ed8">FK  pinnedById : UUID?</text>
            <text x="8" y="154" fill="#334155">type : MessageType</text>
            <text x="8" y="170" fill="#334155">content : String</text>
            <text x="8" y="186" fill="#334155">pinned : Boolean = false</text>
            <text x="8" y="202" fill="#64748b" font-size="7pt">createdAt, editedAt, deletedAt</text>
          </g>

          <!-- Attachment Table -->
          <g transform="translate(485, 240)" filter="url(#erd-card-shadow)">
            <rect x="0" y="0" width="165" height="195" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>
            <path d="M 0 6 Q 0 0 6 0 L 159 0 Q 165 0 165 6 L 165 24 L 0 24 Z" fill="#1e40af"/>
            <text x="82" y="16" fill="#ffffff" font-weight="700" text-anchor="middle">Attachment (Tệp/Ảnh)</text>
            <text x="8" y="42" fill="#b45309" font-weight="700">PK  id : UUID</text>
            <text x="8" y="58" fill="#1d4ed8" font-weight="700">FK  channelId : UUID</text>
            <text x="8" y="74" fill="#1d4ed8" font-weight="700">FK  uploaderId : UUID</text>
            <text x="8" y="90" fill="#1d4ed8" font-weight="700">FK  messageId : UUID?</text>
            <text x="8" y="106" fill="#334155">filename, mime : String</text>
            <text x="8" y="122" fill="#334155">size : Int (Bytes, &le;20MB)</text>
            <text x="8" y="138" fill="#334155">isImage : Boolean</text>
            <text x="8" y="154" fill="#334155">path, url : String</text>
            <text x="8" y="172" fill="#64748b" font-size="7pt">createdAt : DateTime</text>
          </g>

          <!-- Mention Table -->
          <g transform="translate(685, 240)" filter="url(#erd-card-shadow)">
            <rect x="0" y="0" width="140" height="120" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>
            <path d="M 0 6 Q 0 0 6 0 L 134 0 Q 140 0 140 6 L 140 24 L 0 24 Z" fill="#7e22ce"/>
            <text x="70" y="16" fill="#ffffff" font-weight="700" text-anchor="middle">Mention (@nhắc tên)</text>
            <text x="8" y="42" fill="#b45309" font-weight="700">PK  id : UUID</text>
            <text x="8" y="58" fill="#1d4ed8" font-weight="700">FK  messageId : UUID</text>
            <text x="8" y="74" fill="#1d4ed8" font-weight="700">FK  userId : UUID</text>
            <text x="8" y="95" fill="#6b21a8" font-weight="600">UK (messageId, userId)</text>
          </g>

          <!-- ERD Relationship Connectors -->
          <!-- Channel to Message (1:N) -->
          <line x1="342" y1="170" x2="342" y2="240" stroke="#3b82f6" stroke-width="1.8"/>
          <text x="348" y="205" fill="#1d4ed8" font-size="8pt" font-weight="700">1 : N</text>

          <!-- User to Message (1:N) -->
          <path d="M 115 195 L 115 320 L 260 320" fill="none" stroke="#3b82f6" stroke-width="1.6"/>
          <text x="120" y="315" fill="#1d4ed8" font-size="8pt" font-weight="700">1 : N</text>

          <!-- Channel to ChannelMember (1:N) -->
          <line x1="425" y1="65" x2="485" y2="65" stroke="#3b82f6" stroke-width="1.5"/>
          <text x="445" y="60" fill="#1d4ed8" font-size="7.5pt" font-weight="600">1 : N</text>

          <!-- User to ChannelMember (1:N) -->
          <path d="M 200 85 L 230 85 L 230 15 L 565 15 L 565 20" fill="none" stroke="#3b82f6" stroke-width="1.3" stroke-dasharray="3,2"/>

          <!-- Message to Attachment (1:N) -->
          <line x1="435" y1="310" x2="485" y2="310" stroke="#3b82f6" stroke-width="1.8"/>
          <text x="445" y="305" fill="#1d4ed8" font-size="7.5pt" font-weight="700">1 : N</text>

          <!-- Message to Mention (1:N) -->
          <line x1="435" y1="350" x2="685" y2="270" stroke="#7e22ce" stroke-width="1.4"/>

          <!-- User to PushSubscription (1:N) -->
          <path d="M 115 20 L 115 8 L 755 8 L 755 20" fill="none" stroke="#64748b" stroke-width="1.3"/>
        </svg>
        <div class="diagram-caption">Hình 2. Sơ đồ thực thể liên kết (ERD) chi tiết cơ sở dữ liệu KhoaChat</div>
      </div>
    </div>

    <div class="page-footer">
      <span>KhoaChat – Mốc 1: Phân tích & Thiết kế</span>
      <span>Trang 3 / 6</span>
    </div>
  </div>

  <!-- ==================== TRANG 4: BẢNG ĐẶC TẢ CƠ SỞ DỮ LIỆU ==================== -->
  <div class="page">
    <div class="content-wrap">
      <div class="doc-header">
        <span class="subject">Báo Cáo Niên Luận Ngành CNTT</span>
        <span>Mốc 1: Phân Tích và Thiết Kế</span>
      </div>

      <h2 class="section-title"><span class="badge">3.1</span> Đặc Tả Chi Tiết Các Bảng Trong Cơ Sở Dữ Liệu</h2>
      <p>
        Mỗi thực thể trong mô hình được thiết kế chuẩn hóa cấp 3 (3NF), định danh khóa chính bằng UUID hoặc chuỗi ngẫu nhiên có kiểm tra tính duy nhất. Các quan hệ tham chiếu đều có ràng buộc khóa ngoại chặt chẽ:
      </p>

      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 15%;">Tên bảng</th>
            <th style="width: 28%;">Khóa chính & Khóa ngoại</th>
            <th style="width: 32%;">Các cột dữ liệu chính</th>
            <th style="width: 25%;">Ràng buộc toàn vẹn</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>User</strong><br><span style="font-size:7.5pt; color:#64748b;">(Người dùng)</span></td>
            <td>
              <span class="tag tag-pk">PK</span> id (UUID)<br>
              <span class="tag tag-uk">UK</span> email (String)
            </td>
            <td>password (hash bcrypt), name, role (STUDENT, LECTURER, ADMIN), avatar, studentCode, locked, lastSeenAt</td>
            <td>Email duy nhất toàn trường; Role mặc định STUDENT; cascade liên kết khi xóa người dùng.</td>
          </tr>
          <tr>
            <td><strong>Channel</strong><br><span style="font-size:7.5pt; color:#64748b;">(Kênh chat)</span></td>
            <td>
              <span class="tag tag-pk">PK</span> id (UUID)
            </td>
            <td>type (CLASS, ANNOUNCEMENT, DIRECT, COMMUNITY), name, description, courseCode, avatar, archived</td>
            <td>Type phân loại mục đích kênh; cờ <code>archived</code> phục vụ lưu trữ lớp học khi kết thúc học kỳ.</td>
          </tr>
          <tr>
            <td><strong>ChannelMember</strong><br><span style="font-size:7.5pt; color:#64748b;">(Thành viên kênh)</span></td>
            <td>
              <span class="tag tag-pk">PK</span> id (UUID)<br>
              <span class="tag tag-fk">FK</span> channelId &rarr; Channel(id)<br>
              <span class="tag tag-fk">FK</span> userId &rarr; User(id)
            </td>
            <td>role (OWNER, MODERATOR, MEMBER), notifyLevel (DEFAULT, ALL, MENTIONS, NONE), lastReadSeq, lastReadAt</td>
            <td><span class="tag tag-uk">UNIQUE(channelId, userId)</span>; <code>lastReadSeq</code> tự động tăng khi xem tin; ON DELETE CASCADE.</td>
          </tr>
          <tr>
            <td><strong>Message</strong><br><span style="font-size:7.5pt; color:#64748b;">(Tin nhắn)</span></td>
            <td>
              <span class="tag tag-pk">PK</span> id (UUID)<br>
              <span class="tag tag-uk">UK</span> clientId (UUID)<br>
              <span class="tag tag-fk">FK</span> channelId, senderId<br>
              <span class="tag tag-fk">FK</span> replyToId, pinnedById
            </td>
            <td>seq (số thứ tự tự tăng trong kênh), type (TEXT, FILE, IMAGE, SYSTEM), content, pinned, deletedAt</td>
            <td>Chống trùng lặp tin bằng <code>clientId</code>; index (channelId, seq) hỗ trợ tải bù tin tức thời; tính đã đọc khi lastReadSeq &ge; seq.</td>
          </tr>
          <tr>
            <td><strong>Attachment</strong><br><span style="font-size:7.5pt; color:#64748b;">(Tệp đính kèm)</span></td>
            <td>
              <span class="tag tag-pk">PK</span> id (UUID)<br>
              <span class="tag tag-fk">FK</span> channelId &rarr; Channel(id)<br>
              <span class="tag tag-fk">FK</span> uploaderId &rarr; User(id)<br>
              <span class="tag tag-fk">FK</span> messageId &rarr; Message(id)
            </td>
            <td>filename, mime, size (Bytes), isImage, path (đường dẫn lưu đĩa bảo mật), url, createdAt</td>
            <td>Giới hạn tối đa 20MB/tệp; kiểm tra magic bytes; chỉ thành viên trong kênh mới được tải qua API bảo mật.</td>
          </tr>
          <tr>
            <td><strong>Mention</strong><br><span style="font-size:7.5pt; color:#64748b;">(Lượt nhắc tên @)</span></td>
            <td>
              <span class="tag tag-pk">PK</span> id (UUID)<br>
              <span class="tag tag-fk">FK</span> messageId &rarr; Message(id)<br>
              <span class="tag tag-fk">FK</span> userId &rarr; User(id)
            </td>
            <td>messageId, userId</td>
            <td><span class="tag tag-uk">UNIQUE(messageId, userId)</span>; kích hoạt huy hiệu @ nhắc nhở và thông báo nổi bật.</td>
          </tr>
          <tr>
            <td><strong>PushSubscription</strong><br><span style="font-size:7.5pt; color:#64748b;">(Đăng ký Push)</span></td>
            <td>
              <span class="tag tag-pk">PK</span> id (UUID)<br>
              <span class="tag tag-fk">FK</span> userId &rarr; User(id)<br>
              <span class="tag tag-uk">UK</span> endpoint (String)
            </td>
            <td>endpoint, p256dh, auth, createdAt</td>
            <td>Hỗ trợ Web Push chuẩn RFC 8291 (VAPID); tự động gửi thông báo khi người dùng tắt trình duyệt.</td>
          </tr>
        </tbody>
      </table>

      <div class="info-callout">
        <strong>Cơ chế tự động đồng bộ đã đọc & Tìm kiếm tối ưu:</strong> Hệ thống tự động ghi nhận trạng thái đã đọc khi thành viên mở xem kênh (cập nhật <code>ChannelMember.lastReadSeq</code> tiến lên mức mới nhất, không cần thao tác bấm thủ công). Giảng viên có thể xem thống kê danh sách thành viên đã đọc hoặc chưa đọc thông báo lớp (xác định qua điều kiện <code>lastReadSeq &ge; msg.seq</code>). Cột <code>content</code> được lập chỉ mục <code>tsvector</code> + <code>unaccent</code> cho phép tìm kiếm tiếng Việt không dấu dưới 5ms.
      </div>
    </div>

    <div class="page-footer">
      <span>KhoaChat – Mốc 1: Phân tích & Thiết kế</span>
      <span>Trang 4 / 6</span>
    </div>
  </div>

  <!-- ==================== TRANG 5: CÔNG NGHỆ & PHÂN CÔNG ==================== -->
  <div class="page">
    <div class="content-wrap">
      <div class="doc-header">
        <span class="subject">Báo Cáo Niên Luận Ngành CNTT</span>
        <span>Mốc 1: Phân Tích và Thiết Kế</span>
      </div>

      <h2 class="section-title"><span class="badge">4</span> Công Nghệ Chọn Dùng</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 22%;">Hạng mục</th>
            <th style="width: 32%;">Công nghệ lựa chọn</th>
            <th style="width: 46%;">Lý do lựa chọn & Tính phù hợp với đề tài</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Ngôn ngữ lập trình</strong></td>
            <td><strong>TypeScript</strong> (Full-stack)</td>
            <td>Đồng bộ kiểu dữ liệu chặt chẽ từ Database Schema đến React UI; triệt tiêu lỗi runtime.</td>
          </tr>
          <tr>
            <td><strong>Frontend Framework</strong></td>
            <td><strong>React 18</strong> + <strong>Vite 6</strong> + <strong>Tailwind CSS 3</strong></td>
            <td>Kiến trúc Component hiện đại; tốc độ biên dịch cực nhanh; giao diện responsive trực quan.</td>
          </tr>
          <tr>
            <td><strong>Backend Framework</strong></td>
            <td><strong>Node.js 20+</strong> + <strong>Express 4</strong></td>
            <td>Xử lý I/O bất đồng bộ Non-blocking hiệu năng cao; tối ưu cho luồng Socket.IO nhiều kết nối.</td>
          </tr>
          <tr>
            <td><strong>Truyền thông Realtime</strong></td>
            <td><strong>Socket.IO 4</strong> (Room & Namespace)</td>
            <td>Độ trễ thấp (&lt;10ms), tự kết nối lại, xác thực lúc bắt tay, phân phòng theo kênh và người dùng.</td>
          </tr>
          <tr>
            <td><strong>Cơ sở dữ liệu & ORM</strong></td>
            <td><strong>PostgreSQL 16</strong> + <strong>Prisma ORM 6</strong></td>
            <td>Đảm bảo toàn vẹn dữ liệu quan hệ ACID; hỗ trợ Full-text search không dấu qua <code>tsvector</code>.</td>
          </tr>
          <tr>
            <td><strong>Bộ nhớ ngoại tuyến</strong></td>
            <td><strong>IndexedDB</strong> (Thư viện <code>idb</code>)</td>
            <td>Lưu hàng đợi outbox khi rớt mạng và cache tin nhắn cục bộ; không mất tin khi tải lại trang.</td>
          </tr>
          <tr>
            <td><strong>Bảo mật & Xác thực</strong></td>
            <td><strong>JWT</strong> + <strong>bcrypt</strong> + <strong>Zod</strong></td>
            <td>Xác thực Stateless an toàn; mã hóa mật khẩu; kiểm tra thẩm định dữ liệu và magic bytes tệp.</td>
          </tr>
        </tbody>
      </table>

      <h2 class="section-title" style="margin-top: 12px;"><span class="badge">5</span> Bảng Phân Công Công Việc Giữa 2 Bạn (Gắn Mã Chức Năng)</h2>
      <p>
        Đề tài do nhóm 2 sinh viên cùng hợp tác thực hiện. Phân công công việc được định rõ ràng, gắn trực tiếp từng mã chức năng cụ thể (CN01 – CN20) tương ứng với chuyên môn của từng bạn:
      </p>

      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 25%;">Thành viên thực hiện</th>
            <th style="width: 35%;">Mã chức năng phụ trách chính</th>
            <th style="width: 40%;">Nội dung công việc chi tiết</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Nguyễn Huyền Linh</strong><br><span style="color:#64748b; font-size:7.5pt;">Frontend & Client Architecture</span></td>
            <td>
              <strong>CN01, CN02, CN04, CN05, CN06, CN07, CN08, CN10, CN13, CN14, CN15</strong>
            </td>
            <td>
              - Thiết kế toàn bộ giao diện người dùng React (UI/UX).<br>
              - Xây dựng luồng đăng ký, đăng nhập và lưu trữ phiên.<br>
              - Tích hợp Socket.IO client, sự kiện soạn tin, online presence.<br>
              - Phát triển kho lưu trữ IndexedDB outbox gửi tin khi offline.<br>
              - Gợi ý @mention, toast thông báo và xử lý tự động xóa badge đã đọc khi người dùng cuộn xem kênh.
            </td>
          </tr>
          <tr>
            <td><strong>Nguyễn Tấn Phát</strong><br><span style="color:#64748b; font-size:7.5pt;">Backend & Database Architecture</span></td>
            <td>
              <strong>CN03, CN09, CN11, CN12, CN16, CN17, CN18, CN19, CN20</strong>
            </td>
            <td>
              - Thiết kế CSDL PostgreSQL, viết Prisma schema & migration.<br>
              - Xây dựng hệ thống REST API Express và phân quyền bảo mật.<br>
              - Module tải tệp đa luồng, kiểm tra magic bytes, bảo mật tệp.<br>
              - Bộ máy tìm kiếm full-text search không phân biệt dấu.<br>
              - Trang quản trị, import CSV và API thống kê danh sách thành viên đã xem / chưa xem thông báo.
            </td>
          </tr>
          <tr>
            <td><strong>Cả hai thành viên</strong><br><span style="color:#64748b; font-size:7.5pt;">Phối hợp chung (50% - 50%)</span></td>
            <td>
              <strong>Toàn bộ hệ thống (CN01 – CN20)</strong>
            </td>
            <td>
              - Khảo sát thực tế, phân tích yêu cầu nghiệp vụ và lập tài liệu Mốc 1.<br>
              - Tích hợp liên thông Client - Server và hoàn thiện khung cấu trúc toàn hệ thống.<br>
              - Triển khai chạy thử nghiệm trang đầu tiên và chuẩn bị cho các mốc tiếp theo.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="page-footer">
      <span>KhoaChat – Mốc 1: Phân tích & Thiết kế</span>
      <span>Trang 5 / 6</span>
    </div>
  </div>

  <!-- ==================== TRANG 6: ẢNH CHỤP MÀN HÌNH & KẾT QUẢ ==================== -->
  <div class="page">
    <div class="content-wrap">
      <div class="doc-header">
        <span class="subject">Báo Cáo Niên Luận Ngành CNTT</span>
        <span>Mốc 1: Phân Tích và Thiết Kế</span>
      </div>

      <h2 class="section-title"><span class="badge">6</span> Ảnh Chụp Màn Hình Dự Án Đã Tạo & Chạy Trang Đầu Tiên</h2>
      <p>
        Dự án KhoaChat đã được khởi tạo cấu trúc hoàn chỉnh, cài đặt thư viện, đồng bộ cơ sở dữ liệu PostgreSQL và khởi chạy thành công trang đầu tiên trên trình duyệt tại địa chỉ <code>http://localhost:5173</code>:
      </p>

      <div class="screenshot-box">
        <img src="{img_login}" class="screenshot-img" alt="Màn hình đăng nhập trang đầu tiên">
        <div class="screenshot-caption">Hình 3. Màn hình khởi động / Đăng nhập của ứng dụng KhoaChat (Chạy thành công tại http://localhost:5173)</div>
      </div>

      <div class="screenshot-box">
        <img src="{img_chat}" class="screenshot-img" alt="Giao diện chat chính sau đăng nhập">
        <div class="screenshot-caption">Hình 4. Giao diện làm việc trung tâm sau khi đăng nhập: Kênh học phần, nhắn tin realtime và danh bạ trực tuyến</div>
      </div>

      <h3 class="subsection-title">Minh Chứng Kỹ Thuật Đã Khởi Tạo & Chạy Được Hệ Thống</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 25%;">Lệnh thực thi</th>
            <th style="width: 35%;">Mục đích & Phạm vi tác động</th>
            <th style="width: 40%;">Kết quả ghi nhận tại thời điểm nộp Mốc 1</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>npm run db:migrate</code></td>
            <td>Ánh xạ Prisma Schema vào PostgreSQL</td>
            <td><strong style="color:#166534;">✓ Thành công:</strong> Khởi tạo toàn bộ 7 bảng và chỉ mục full-text search.</td>
          </tr>
          <tr>
            <td><code>npm run build</code></td>
            <td>Biên dịch TypeScript server và client</td>
            <td><strong style="color:#166534;">✓ Thành công:</strong> Không phát sinh lỗi cú pháp hay kiểu dữ liệu nào.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="page-footer">
      <span>KhoaChat – Mốc 1: Phân tích & Thiết kế</span>
      <span>Trang 6 / 6</span>
    </div>
  </div>

</body>
</html>
"""
    return html

def main():
    html_content = build_html()
    html_file = os.path.abspath("docs/Moc-1-Phan-tich-va-thiet-ke.html")
    pdf_file = os.path.abspath("docs/Moc-1-Phan-tich-va-thiet-ke.pdf")
    
    with open(html_file, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Written HTML to {html_file}")

    edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    if not os.path.exists(edge_path):
        edge_path = r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"

    url = f"file:///{html_file.replace(os.sep, '/')}"
    cmd = [
        edge_path,
        "--headless",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_file}",
        url
    ]
    print(f"Executing: {' '.join(cmd)}")
    proc = subprocess.run(cmd, capture_output=True, text=True)
    print(f"Return code: {proc.returncode}")
    if os.path.exists(pdf_file):
        print(f"SUCCESS: Generated PDF at {pdf_file} (Size: {os.path.getsize(pdf_file)} bytes)")
    else:
        print("ERROR: PDF was not generated")

if __name__ == "__main__":
    main()
