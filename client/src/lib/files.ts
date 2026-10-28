export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const ALLOWED_EXT = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv',
  'zip', 'rar', '7z', 'c', 'cpp', 'h', 'java', 'py', 'js', 'ts', 'sql', 'json', 'mp3', 'mp4',
];
export const ACCEPT = ALLOWED_EXT.map((e) => `.${e}`).join(',');

export const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

export function checkFile(f: { name: string; size: number }): string | null {
  if (!ALLOWED_EXT.includes(extOf(f.name))) return `Không hỗ trợ loại tệp .${extOf(f.name) || '?'}`;
  if (f.size > MAX_FILE_SIZE) return 'Tệp vượt quá 20MB';
  return null;
}

export function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const isImageName = (name: string, mime = '') =>
  mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extOf(name));

export const isVideoName = (name: string, mime = '') =>
  mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(extOf(name));

/** Màu + nhãn biểu tượng theo loại tệp */
export function fileBadge(name: string, mime = ''): { label: string; color: string } {
  const e = extOf(name);
  if (mime === 'application/pdf' || e === 'pdf') return { label: 'PDF', color: 'bg-rose-500' };
  if (['doc', 'docx'].includes(e)) return { label: 'DOC', color: 'bg-blue-600' };
  if (['xls', 'xlsx', 'csv'].includes(e)) return { label: e === 'csv' ? 'CSV' : 'XLS', color: 'bg-emerald-600' };
  if (['ppt', 'pptx'].includes(e)) return { label: 'PPT', color: 'bg-orange-500' };
  if (['zip', 'rar', '7z'].includes(e)) return { label: 'ZIP', color: 'bg-amber-600' };
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(e) || mime.startsWith('image/')) return { label: 'IMG', color: 'bg-violet-500' };
  if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(e) || mime.startsWith('video/')) return { label: 'VIDEO', color: 'bg-purple-600' };
  if (['mp3', 'wav', 'ogg'].includes(e) || mime.startsWith('audio/')) return { label: 'AUDIO', color: 'bg-pink-500' };
  if (['txt', 'md'].includes(e)) return { label: 'TXT', color: 'bg-slate-500' };
  return { label: (e || 'FILE').toUpperCase().slice(0, 4), color: 'bg-slate-600' };
}

export const KIND_LABELS: Record<string, string> = {
  '': 'Tất cả',
  image: 'Ảnh',
  pdf: 'PDF',
  doc: 'Văn bản',
  sheet: 'Bảng tính',
  slide: 'Trình chiếu',
  archive: 'Nén',
  other: 'Khác',
};
