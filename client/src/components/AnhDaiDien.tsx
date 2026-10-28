import { useState } from 'react';

const COLORS = [
  'bg-indigo-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-violet-500', 'bg-teal-500', 'bg-fuchsia-500',
];

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  const parts = name.replace(/^(TS\.|ThS\.|PGS\.|GS\.)\s*/i, '').trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? '';
  const first = parts.length > 1 ? parts[0] : '';
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?';
}

export default function AnhDaiDien({
  id, name, src, size = 36, online,
}: { id: string; name: string; src?: string | null; size?: number; online?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = !!src && failedSrc !== src;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {showImage ? (
        <img src={src!} alt={name} onError={() => setFailedSrc(src!)} className="h-full w-full rounded-full object-cover" />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center rounded-full font-semibold text-white ${COLORS[hash(id) % COLORS.length]}`}
          style={{ fontSize: size * 0.38 }}
        >
          {initials(name)}
        </div>
      )}
      {online !== undefined && (
        <span
          title={online ? 'Đang hoạt động' : 'Ngoại tuyến'}
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white ${online ? 'bg-emerald-500' : 'bg-slate-300'}`}
          style={{ width: Math.max(10, size * 0.32), height: Math.max(10, size * 0.32) }}
        />
      )}
    </div>
  );
}
