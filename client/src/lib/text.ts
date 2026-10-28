/** Bỏ dấu tiếng Việt, chữ thường - dùng cho tìm kiếm/lọc không dấu */
export function unaccent(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

/**
 * Tìm các đoạn [start, end) trong text khớp (không dấu) với các từ khoá.
 * Giữ nguyên chỉ số vì bỏ dấu NFC -> mỗi ký tự gốc ứng với 1 ký tự không dấu.
 */
export function matchRanges(text: string, tokens: string[]): [number, number][] {
  if (!tokens.length) return [];
  const plain = [...text].map((ch) => unaccent(ch).charAt(0) || ch).join('');
  const ranges: [number, number][] = [];
  for (const t of tokens) {
    if (!t) continue;
    let i = 0;
    while ((i = plain.indexOf(t, i)) !== -1) {
      // chỉ tô đầu từ (tìm theo tiền tố)
      if (i === 0 || /[^a-z0-9]/.test(plain[i - 1])) ranges.push([i, i + t.length]);
      i += t.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}

export const searchTokens = (q: string) => unaccent(q).split(/[^a-z0-9]+/).filter(Boolean);
