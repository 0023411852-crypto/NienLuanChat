import { openDB, type IDBPDatabase } from 'idb';
import type { Channel, Message, OutboxItem } from '../types';

/**
 * IndexedDB của KhoaChat:
 *  - outbox: hàng đợi tin chưa gửi -> tin soạn lúc mất mạng vẫn còn sau khi tải lại trang và tự gửi khi có mạng.
 *  - cache : bản sao danh sách kênh + tin gần nhất -> mở app khi offline vẫn xem được.
 */
let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  dbp ??= openDB('khoachat', 2, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        const s = d.createObjectStore('outbox', { keyPath: 'clientId' });
        s.createIndex('userId', 'userId');
      }
      if (oldVersion < 2) d.createObjectStore('cache');
    },
  });
  return dbp;
}

export const outbox = {
  async put(item: OutboxItem) {
    await (await db()).put('outbox', item);
  },
  async remove(clientId: string) {
    await (await db()).delete('outbox', clientId);
  },
  async list(userId: string): Promise<OutboxItem[]> {
    const items = (await (await db()).getAllFromIndex('outbox', 'userId', userId)) as OutboxItem[];
    return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
};

export const cache = {
  async saveChannels(userId: string, channels: Channel[]) {
    await (await db()).put('cache', channels, `${userId}:channels`);
  },
  async loadChannels(userId: string): Promise<Channel[] | undefined> {
    return (await db()).get('cache', `${userId}:channels`);
  },
  async saveMessages(userId: string, channelId: string, messages: Message[]) {
    await (await db()).put('cache', messages, `${userId}:msgs:${channelId}`);
  },
  async loadMessages(userId: string, channelId: string): Promise<Message[] | undefined> {
    return (await db()).get('cache', `${userId}:msgs:${channelId}`);
  },
};
