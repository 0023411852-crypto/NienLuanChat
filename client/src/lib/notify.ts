import { api } from './api';
import type { ChannelType, NotifyLevel } from '../types';

/** Cùng quy tắc với server (server/src/services/notify.ts) */
export function shouldNotify(level: NotifyLevel, type: ChannelType, mentioned: boolean) {
  if (level === 'NONE') return false;
  if (mentioned) return true;
  if (level === 'ALL') return true;
  if (level === 'MENTIONS') return false;
  return type === 'DIRECT' || type === 'ANNOUNCEMENT' || type === 'COMMUNITY';
}

export const NOTIFY_LABELS: Record<NotifyLevel, { title: string; desc: string }> = {
  DEFAULT: { title: 'Mặc định', desc: 'Tin nhắn riêng & thông báo: mọi tin. Lớp học phần: khi được nhắc tên' },
  ALL: { title: 'Tất cả tin nhắn', desc: 'Báo mọi tin nhắn mới trong kênh này' },
  MENTIONS: { title: 'Chỉ khi được nhắc tên', desc: 'Khi có @tên bạn hoặc @all' },
  NONE: { title: 'Tắt thông báo', desc: 'Không báo gì, chỉ hiện số tin chưa đọc' },
};

const SOUND_KEY = 'khoachat.sound';
export const soundPref = {
  get: () => localStorage.getItem(SOUND_KEY) !== 'off',
  set: (on: boolean) => localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'),
};

let ctx: AudioContext | null = null;
/** Âm báo ngắn 2 nốt bằng Web Audio (không cần tệp âm thanh) */
export function playSound() {
  if (!soundPref.get()) return;
  try {
    ctx ??= new AudioContext();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.15, now + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.18);
      o.connect(g).connect(ctx!.destination);
      o.start(now + i * 0.12);
      o.stop(now + i * 0.12 + 0.2);
    });
  } catch {
    /* trình duyệt chặn âm thanh khi chưa tương tác */
  }
}

export const notifySupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window;

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

/** Xin quyền thông báo + đăng ký Web Push với server. Trả về trạng thái để hiển thị. */
export async function enableNotifications(): Promise<{ permission: NotificationPermission; push: boolean; error?: string }> {
  if (!notifySupported()) return { permission: 'denied', push: false, error: 'Trình duyệt không hỗ trợ thông báo' };
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') return { permission, push: false };
  if (!pushSupported()) return { permission, push: false, error: 'Trình duyệt không hỗ trợ Web Push' };
  try {
    const reg = (await registerSW()) ?? (await navigator.serviceWorker.ready);
    await navigator.serviceWorker.ready;
    const { publicKey } = await api<{ publicKey: string }>('/api/push/public-key');
    let sub = await reg.pushManager.getSubscription();
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    await api('/api/push/subscribe', { method: 'POST', json: { subscription: sub.toJSON() } });
    return { permission, push: true };
  } catch (e) {
    return { permission, push: false, error: (e as Error).message || 'Không đăng ký được Web Push' };
  }
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api('/api/push/unsubscribe', { method: 'POST', json: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch {
    /* */
  }
}

export async function hasPushSubscription() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    return !!(await reg?.pushManager.getSubscription());
  } catch {
    return false;
  }
}

/** Thông báo của hệ điều hành khi tab đang ẩn */
export function showBrowserNotification(title: string, body: string, tag: string, onClick: () => void) {
  if (!notifySupported() || Notification.permission !== 'granted') return false;
  try {
    const n = new Notification(title, { body, tag, icon: '/logo.svg' });
    n.onclick = () => {
      window.focus();
      onClick();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}
