import { useState, useEffect } from 'react';
import type { Channel } from '../types';
import { api, uploadFile } from '../lib/api';
import { useToast } from '../state/toast';
import AnhDaiDien from './AnhDaiDien';
import Modal, { btn } from './ui/HopThoai';

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

export default function ChinhSuaAnhKenh({
  channel,
  onClose,
  onUpdated
}: {
  channel: Channel;
  onClose: () => void;
  onUpdated: (channel: Channel) => void;
}) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const choose = (next: File | undefined) => {
    if (!next) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) {
      toast.push({ kind: 'error', title: 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP' });
      return;
    }
    if (next.size > MAX_SIZE) {
      toast.push({ kind: 'error', title: 'Ảnh đại diện tối đa 5MB' });
      return;
    }
    setFile(next);
    setPreset(null);
  };

  const save = async () => {
    if (!file && !preset) return;
    setBusy(true);
    try {
      const result = preset
        ? await api<{ channel: Channel }>(`/api/channel-avatars/${channel.id}/preset`, {
            method: 'PUT',
            json: { preset },
          })
        : await uploadFile<{ channel: Channel }>(
            `/api/channel-avatars/${channel.id}`,
            file!,
            file!.name
          );
      onUpdated({ ...channel, avatar: result.channel.avatar });
      toast.push({ kind: 'success', title: 'Đã cập nhật ảnh đại diện kênh' });
      onClose();
    } catch (e) {
      toast.push({
        kind: 'error',
        title: 'Không cập nhật được ảnh đại diện kênh',
        body: (e as Error).message
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const result = await api<{ channel: Channel }>(`/api/channel-avatars/${channel.id}`, {
        method: 'DELETE'
      });
      onUpdated({ ...channel, avatar: result.channel.avatar });
      toast.push({ kind: 'success', title: 'Đã gỡ ảnh đại diện kênh' });
      onClose();
    } catch (e) {
      toast.push({
        kind: 'error',
        title: 'Không gỡ được ảnh đại diện kênh',
        body: (e as Error).message
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Ảnh đại diện kênh"
      onClose={busy ? () => {} : onClose}
      width="max-w-sm"
      footer={(
        <>
          {channel.avatar && (
            <button className={btn.ghost} disabled={busy} onClick={remove}>
              Gỡ ảnh
            </button>
          )}
          <button className={btn.ghost} disabled={busy} onClick={onClose}>
            Huỷ
          </button>
          <button
            className={btn.primary}
            disabled={(!file && !preset) || busy}
            onClick={save}
          >
            {busy ? 'Đang lưu...' : 'Lưu ảnh'}
          </button>
        </>
      )}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-full bg-slate-50 dark:bg-slate-800 p-2 ring-1 ring-slate-200 dark:ring-slate-700">
          {preset ? (
            <img src={`/api/channel-avatars/presets/${preset}.svg`} alt="Xem trước ảnh đại diện" className="h-28 w-28 rounded-full object-cover" />
          ) : preview ? (
            <img
              src={preview}
              alt="Xem trước ảnh đại diện"
              className="h-28 w-28 rounded-full object-cover"
            />
          ) : (
            <AnhDaiDien
              id={channel.id}
              name={channel.name}
              src={channel.avatar ? `/api/channel-avatars/${channel.id}` : undefined}
              size={112}
            />
          )}
        </div>
        <div className="w-full text-center">
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            {channel.name}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Chọn ảnh JPG, PNG hoặc WebP, tối đa 5MB.
          </p>
        </div>
        <div className="grid w-full grid-cols-4 gap-2">
          {['blue', 'violet', 'green', 'orange', 'pink', 'teal', 'indigo', 'rose'].map((item) => (
            <button key={item} type="button" disabled={busy} onClick={() => { setPreset(item); setFile(null); setPreview(null); }} className={`overflow-hidden rounded-full ring-2 ${preset === item ? 'ring-sky-500' : 'ring-transparent'}`} aria-label={`Chọn avatar ${item}`}>
              <img src={`/api/channel-avatars/presets/${item}.svg`} alt="" className="h-12 w-12" />
            </button>
          ))}
        </div>
        <label className={`${btn.secondary} flex w-full cursor-pointer items-center justify-center gap-2`}>
          Chọn ảnh từ thiết bị
          <input
            type="file"
            accept={ACCEPT}
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              choose(e.target.files?.[0]);
              setPreview(null);
              e.currentTarget.value = '';
            }}
          />
        </label>
      </div>
    </Modal>
  );
}