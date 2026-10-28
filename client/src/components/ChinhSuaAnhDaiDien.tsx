import { useEffect, useState } from 'react';
import type { User } from '../types';
import { api, uploadFile } from '../lib/api';
import { useToast } from '../state/toast';
import AnhDaiDien from './AnhDaiDien';
import Modal, { btn } from './ui/HopThoai';

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

export default function ChinhSuaAnhDaiDien({ me, onClose, onUpdated }: {
  me: User;
  onClose: () => void;
  onUpdated: (user: User) => void;
}) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
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
  };

  const save = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const result = await uploadFile<{ user: User }>('/api/auth/avatar', file, file.name);
      onUpdated(result.user);
      toast.push({ kind: 'success', title: 'Đã cập nhật ảnh đại diện' });
      onClose();
    } catch (e) {
      toast.push({ kind: 'error', title: 'Không cập nhật được ảnh đại diện', body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const result = await api<{ user: User }>('/api/auth/avatar', { method: 'DELETE' });
      onUpdated(result.user);
      toast.push({ kind: 'success', title: 'Đã gỡ ảnh đại diện' });
      onClose();
    } catch (e) {
      toast.push({ kind: 'error', title: 'Không gỡ được ảnh đại diện', body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Ảnh đại diện"
      onClose={busy ? () => {} : onClose}
      width="max-w-sm"
      footer={(
        <>
          {me.avatar && <button className={btn.ghost} disabled={busy} onClick={remove}>Gỡ ảnh</button>}
          <button className={btn.ghost} disabled={busy} onClick={onClose}>Huỷ</button>
          <button className={btn.primary} disabled={!file || busy} onClick={save}>{busy ? 'Đang lưu...' : 'Lưu ảnh'}</button>
        </>
      )}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-full bg-slate-50 dark:bg-slate-800 p-2 ring-1 ring-slate-200 dark:ring-slate-700">
          {preview ? <img src={preview} alt="Xem trước ảnh đại diện" className="h-28 w-28 rounded-full object-cover" /> : <AnhDaiDien id={me.id} name={me.name} src={me.avatar} size={112} />}
        </div>
        <div className="w-full text-center">
          <p className="font-semibold text-slate-800 dark:text-slate-100">{me.name}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Chọn ảnh JPG, PNG hoặc WebP, tối đa 5MB.</p>
        </div>
        <label className={`${btn.secondary} flex w-full cursor-pointer items-center justify-center gap-2`}>
          Chọn ảnh từ thiết bị
          <input type="file" accept={ACCEPT} className="hidden" disabled={busy} onChange={(e) => { choose(e.target.files?.[0]); e.currentTarget.value = ''; }} />
        </label>
      </div>
    </Modal>
  );
}
