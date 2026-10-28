const TOKEN_KEY = 'khoachat.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  const token = tokenStore.get();
  if (token) headers.authorization = `Bearer ${token}`;
  let body = init.body;
  if (init.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(path, { credentials: 'same-origin', ...init, headers, body });
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ', 'NETWORK');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Vite proxy trả 500/502 khi server tắt -> coi như mất mạng
    if ((res.status === 502 || res.status === 504 || res.status === 500) && !data.code) {
      throw new ApiError(0, 'Không kết nối được máy chủ', 'NETWORK');
    }
    throw new ApiError(res.status, data.error ?? 'Có lỗi xảy ra', data.code);
  }
  return data as T;
}

/** Tải tệp lên kèm tiến độ (XMLHttpRequest vì fetch chưa hỗ trợ upload progress). */
export function uploadFile<T>(
  path: string,
  file: Blob,
  filename: string,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', path);
    const token = tokenStore.get();
    if (token) xhr.setRequestHeader('authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: { error?: string; code?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else if (xhr.status >= 500 && !data.code) reject(new ApiError(0, 'Không kết nối được máy chủ', 'NETWORK'));
      else reject(new ApiError(xhr.status, data.error ?? 'Tải tệp thất bại', data.code));
    };
    xhr.onerror = () => reject(new ApiError(0, 'Không kết nối được máy chủ', 'NETWORK'));
    xhr.onabort = () => reject(new ApiError(0, 'Đã huỷ', 'ABORTED'));
    signal?.addEventListener('abort', () => xhr.abort());
    const fd = new FormData();
    fd.append('file', file, filename);
    xhr.send(fd);
  });
}
