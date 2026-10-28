import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useChat } from '../state/ChatContext';
import { useToast } from '../state/toast';
import type { Channel } from '../types';
import Modal, { btn, inputCls } from './ui/HopThoai';

interface ModalSuaKenhProps {
  channel: Channel;
  onClose: () => void;
  onUpdated: (updatedChannel: Channel) => void;
}

export default function ModalSuaKenh({ channel, onClose, onUpdated }: ModalSuaKenhProps) {
  const { me } = useChat();
  const toast = useToast();
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = me.role === 'ADMIN';

  // Only admin can edit course code
  const [courseCode, setCourseCode] = useState(channel.courseCode || '');

  useEffect(() => {
    setName(channel.name);
    setDescription(channel.description || '');
    setCourseCode(channel.courseCode || '');
  }, [channel]);

  const handleUpdate = async () => {
    if (!name.trim()) {
      setError('Vui lòng nhập tên kênh');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const updateData: any = {
        name: name.trim(),
        description: description.trim() || null,
      };

      // Only admin can update course code
      if (isAdmin) {
        updateData.courseCode = courseCode.trim() || null;
      }

      const res = await api<{ channel: Channel }>(`/api/admin/channels/${channel.id}`, {
        method: 'PATCH',
        json: updateData,
      });

      onUpdated(res.channel);
      toast.push({
        kind: 'success',
        title: 'Cập nhật nhóm thành công',
      });
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Không thể cập nhật nhóm');
      toast.push({
        kind: 'error',
        title: 'Lỗi khi cập nhật nhóm',
        body: (err as Error).message,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Modal
      title="Chỉnh sửa nhóm"
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <button className={btn.ghost} onClick={onClose} disabled={isUpdating}>
            Huỷ
          </button>
          <button
            className={btn.primary}
            onClick={handleUpdate}
            disabled={isUpdating || !name.trim()}
          >
            {isUpdating ? 'Đang lưu...' : 'Lưu'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Tên nhóm <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên nhóm"
            className={inputCls}
            disabled={isUpdating}
          />
        </div>

        <div>
          <label className="block mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Mô tả
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả ngắn về nhóm"
            className={inputCls}
            disabled={isUpdating}
          />
        </div>

        {isAdmin && (
          <div>
            <label className="block mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Mã học phần {channel.type === 'CLASS' && <span className="text-rose-500">*</span>}
            </label>
            <input
              type="text"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
              placeholder="CT101"
              className={inputCls}
              disabled={isUpdating}
            />
          </div>
        )}

        {error && (
          <div className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}