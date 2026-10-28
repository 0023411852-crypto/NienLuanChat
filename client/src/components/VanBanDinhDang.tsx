import { Fragment, type ReactNode } from 'react';
import { matchRanges } from '../lib/text';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Tô sáng từ khoá tìm kiếm (không dấu) trong một đoạn văn bản */
export function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  const chars = Array.from(text);
  const ranges = matchRanges(text, tokens);
  if (!ranges.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([s, e], i) => {
    if (s > pos) out.push(chars.slice(pos, s).join(''));
    out.push(<mark key={i} className="hl">{chars.slice(s, e).join('')}</mark>);
    pos = e;
  });
  if (pos < chars.length) out.push(chars.slice(pos).join(''));
  return <>{out}</>;
}

/** Hiển thị nội dung tin: tô @nhắc tên, @all, liên kết; tuỳ chọn tô từ khoá tìm kiếm */
export default function VanBanDinhDang({
  content, mentions, mentionAll, meId, tokens = [],
}: { content: string; mentions: { id: string; name: string }[]; mentionAll: boolean; meId: string; tokens?: string[] }) {
  const names = [...mentions].sort((a, b) => b.name.length - a.name.length);
  const parts: string[] = ['https?:\\/\\/[^\\s<]+[^\\s<.,;:!?)\\]"\']'];
  if (names.length) parts.unshift(...names.map((m) => `@${esc(m.name)}`));
  if (mentionAll) parts.unshift('@(?:all|channel|tatca|tất\\s?cả)(?=$|[\\s.,!?:;)])');
  const re = new RegExp(parts.join('|'), 'giu');
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of content.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(<Highlight key={k++} text={content.slice(last, idx)} tokens={tokens} />);
    const t = m[0];
    if (t.startsWith('@')) {
      const who = names.find((n) => `@${n.name}`.toLowerCase() === t.toLowerCase());
      const isMe = !who || who.id === meId; // @all cũng tính là nhắc mình
      out.push(<span key={k++} className={isMe ? 'mention-me' : 'mention'} title={who ? who.name : 'Mọi người trong kênh'}>{t}</span>);
    } else {
      out.push(
        <a key={k++} href={t} target="_blank" rel="noreferrer noopener" className="underline decoration-1 underline-offset-2 hover:opacity-80">
          {t}
        </a>,
      );
    }
    last = idx + t.length;
  }
  if (last < content.length) out.push(<Highlight key={k++} text={content.slice(last)} tokens={tokens} />);
  return <Fragment>{out}</Fragment>;
}
