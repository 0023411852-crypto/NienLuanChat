import type { Channel, User } from '../types';

export function channelTitle(c: Channel, me: User | null): string {
  if (c.type === 'DIRECT') return directPeer(c, me)?.name ?? 'Tin nhắn riêng';
  return c.type === 'CLASS' && c.courseCode ? `${c.courseCode} · ${c.name}` : c.name;
}

export function directPeer(c: Channel, me: User | null) {
  return (c.members || []).find((m) => m.id !== me?.id) ?? null;
}

const timeFmt = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

export const fmtTime = (iso: string) => timeFmt.format(new Date(iso));

export function fmtDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hôm nay';
  if (d.toDateString() === y.toDateString()) return 'Hôm qua';
  const s = dateFmt.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtShort(iso: string): string {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return timeFmt.format(d);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const roleLabel: Record<string, string> = {
  STUDENT: 'Sinh viên',
  LECTURER: 'Giảng viên',
  ADMIN: 'Quản trị viên',
};

/**
 * Hàm sao chép văn bản vào bộ nhớ tạm an toàn và đáng tin cậy.
 * Hỗ trợ cả navigator.clipboard (HTTPS / localhost) và fallback qua document.execCommand (mạng LAN / HTTP).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Thử dùng Clipboard API hiện đại nếu trình duyệt hỗ trợ trong secure context
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Tiếp tục thử phương pháp dự phòng
    }
  }

  // 2. Phương pháp dự phòng phổ biến (execCommand) hoạt động trên mọi mạng LAN / IP / HTTP
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

