import { useEffect, useState, useRef } from 'react';
import { api, uploadFile } from '../lib/api';
import { useChat } from '../state/ChatContext';
import { useToast } from '../state/toast';
import type { Channel } from '../types';
import Modal, { btn, inputCls } from './ui/HopThoai';
import ChonNguoiDung from './admin/ChonNguoiDung';

interface ModalTaoCongDongProps {
  onClose: () => void;
  onCreated: (channel: Channel) => void;
}

export default function ModalTaoCongDong({ onClose, onCreated }: ModalTaoCongDongProps) {
  const { me } = useChat();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarFile, setAnhDaiDienFile] = useState<File | null>(null);
  const [avatarPreview, setAnhDaiDienPreview] = useState<string | null>(null);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [friends, setFriends] = useState<{ id: string; name: string; email: string; role: 'STUDENT' | 'LECTURER' | 'ADMIN'; studentCode: string | null; avatar: string | null }[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ friends: typeof friends }>('/api/friends').then(({ friends: list }) => setFriends(list)).catch(() => setFriends([]));
  }, []);

  useEffect(() => {
    if (!avatarFile) return;
    const url = URL.createObjectURL(avatarFile);
    setAnhDaiDienPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Vui lòng nhập tên nhóm');
      return;
    }

    if (members.length === 0) {
      setError('Vui lòng chọn ít nhất một thành viên');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // First create the channel
      const res = await api<{ channel: Channel }>('/api/channels/community', {
        method: 'POST',
        json: {
          name: name.trim(),
          description: description.trim() || undefined,
          memberIds: members.map(m => m.id),
        },
      });

      // Then upload avatar if provided
      if (avatarFile) {
        try {
          await uploadFile<{ channel: Channel }>(
            `/api/channel-avatars/${res.channel.id}`,
            avatarFile,
            avatarFile.name
          );
        } catch (avatarErr) {
          // Don't fail the whole operation if avatar upload fails
          toast.push({
            kind: 'error',
            title: 'Không cập nhật được ảnh đại diện',
            body: (avatarErr as Error).message
          });
        }
      }

      // Refresh the channel to get updated avatar info
      const { channel } = await api<{ channel: Channel }>(`/api/channels/${res.channel.id}`);
      onCreated(channel);
      toast.push({
        kind: 'success',
        title: me.role === 'LECTURER' ? 'Tạo cộng đồng thành công' : 'Tạo nhóm thành công',
        body: `"${res.channel.name}" đã được tạo`,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Không thể tạo nhóm');
      toast.push({
        kind: 'error',
        title: 'Lỗi khi tạo nhóm',
        body: (err as Error).message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal
      title={me.role === 'LECTURER' ? 'Tạo cộng đồng' : 'Tạo nhóm'}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <button className={btn.ghost} onClick={onClose} disabled={isCreating}>
            Huỷ
          </button>
          <button
            className={btn.primary}
            onClick={handleCreate}
            disabled={isCreating || !name.trim() || members.length === 0}
          >
            {isCreating ? 'Đang tạo...' : me.role === 'LECTURER' ? 'Tạo cộng đồng' : 'Tạo nhóm'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {me.role === 'LECTURER' ? 'Tên cộng đồng' : 'Tên nhóm'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={me.role === 'LECTURER' ? 'VD: Cộng đồng học tập, CLB...' : 'VD: Nhóm học tập, CLB Sinh viên...'}
              className={inputCls}
              disabled={isCreating}
            />
          </div>
          <div>
            <label className="block mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Ảnh đại diện
            </label>
            <div className="flex items-center gap-2">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Xem trước ảnh đại diện" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Ảnh</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                disabled={isCreating}
              >
                Chọn ảnh
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={isCreating}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                      toast.push({ kind: 'error', title: 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP' });
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      toast.push({ kind: 'error', title: 'Ảnh đại diện tối đa 5MB' });
                      return;
                    }
                    setAnhDaiDienFile(file);
                  }
                  e.currentTarget.value = '';
                }}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Mô tả (tuỳ chọn)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả ngắn về nhóm"
            className={inputCls}
            disabled={isCreating}
          />
        </div>

        <div>
          <label className="block mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Thành viên (tối đa {me.role === 'LECTURER' ? '2.000' : '101'}, tính cả bạn) <span className="text-rose-500">*</span>
          </label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {members.map((member) => (
              <span
                key={member.id}
                className="flex items-center gap-1 rounded-full bg-indigo-50 py-1 pl-3 pr-1.5 text-xs text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
              >
                {member.name}
                <button
                  onClick={() => setMembers(members.filter(m => m.id !== member.id))}
                  disabled={isCreating}
                  className="rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <ChonNguoiDung
            options={friends}
            exclude={[me.id, ...members.map(m => m.id)]}
            onPick={(user) => setMembers((current) => current.length < (me.role === 'LECTURER' ? 1999 : 100) ? [...current, user] : current)}
            placeholder="Tìm theo tên, email, MSSV hoặc chọn từ bạn bè..."
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Gợi ý: Chọn nhanh từ bạn bè hoặc nhập tên, email, MSSV để tìm bất kỳ sinh viên, giảng viên nào.</p>
        </div>

        {error && (
          <div className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}
        {members.length >= (me.role === 'LECTURER' ? 1999 : 100) && (
          <p className="text-xs text-amber-700 dark:text-amber-300">Đã đạt giới hạn thành viên được mời.</p>
        )}
      </div>
    </Modal>
  );
}

// Simple X icon component
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}