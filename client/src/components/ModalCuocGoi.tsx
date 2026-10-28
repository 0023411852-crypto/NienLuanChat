import { useCall } from '../state/CallContext';
import AnhDaiDien from './AnhDaiDien';
import { MicIcon, MicOffIcon, PhoneIcon, PhoneOffIcon } from './BieuTuong';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ModalCuocGoi() {
  const { status, peer, isMuted, duration, acceptCall, rejectCall, endCall, toggleMute } = useCall();

  if (status === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl ring-1 ring-white/10 p-6 flex flex-col items-center text-center">
        {/* Trang trí hiệu ứng ánh sáng nền */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />

        {/* Tiêu đề trạng thái */}
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-6">
          {status === 'incoming' && '📞 Cuộc gọi thoại đến'}
          {status === 'calling' && 'Đang gọi thoại...'}
          {status === 'connected' && 'Cuộc gọi đang diễn ra'}
          {status === 'ended' && 'Cuộc gọi đã kết thúc'}
        </p>

        {/* Avatar với hiệu ứng vòng tròn phát sáng */}
        <div className="relative mb-6">
          {status === 'incoming' && (
            <div className="absolute inset-0 -m-3 animate-ping rounded-full bg-emerald-500/30 duration-1000" />
          )}
          {status === 'calling' && (
            <div className="absolute inset-0 -m-3 animate-ping rounded-full bg-sky-500/30 duration-1000" />
          )}
          {status === 'connected' && (
            <div className="absolute inset-0 -m-2 rounded-full border-2 border-emerald-500/50 animate-pulse" />
          )}

          <div className="relative rounded-full ring-4 ring-slate-800 shadow-xl overflow-hidden">
            <AnhDaiDien
              id={peer?.id || ''}
              name={peer?.name || 'Người dùng'}
              src={peer?.avatar || null}
              size={96}
            />
          </div>
        </div>

        {/* Thông tin đối phương */}
        <h3 className="text-xl font-bold text-white mb-1">{peer?.name || 'Người dùng'}</h3>
        {peer?.role && (
          <span className="mb-4 inline-block rounded-full bg-slate-800 px-3 py-0.5 text-xs font-medium text-slate-300">
            {peer.role === 'LECTURER' ? 'Giảng viên' : peer.role === 'ADMIN' ? 'Quản trị viên' : 'Sinh viên'}
          </span>
        )}

        {/* Thời lượng cuộc gọi hoặc trạng thái chuông */}
        <div className="mb-8 h-6 flex items-center justify-center">
          {status === 'connected' && (
            <span className="font-mono text-lg font-semibold tracking-wider text-emerald-400">
              {formatDuration(duration)}
            </span>
          )}
          {status === 'calling' && (
            <span className="text-sm text-slate-400 flex items-center gap-1.5">
              <span>Đang đổ chuông</span>
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:0.4s]" />
              </span>
            </span>
          )}
          {status === 'incoming' && (
            <span className="text-sm text-emerald-400 font-medium">Nhấn trả lời để bắt đầu cuộc trò chuyện</span>
          )}
          {status === 'ended' && (
            <span className="text-sm text-rose-400 font-medium">Đã ngắt kết nối</span>
          )}
        </div>

        {/* Các nút bấm điều khiển */}
        <div className="flex items-center justify-center gap-6 w-full">
          {status === 'incoming' && (
            <>
              {/* Nút từ chối */}
              <button
                onClick={rejectCall}
                className="group flex flex-col items-center gap-2 focus:outline-none"
                title="Từ chối"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg transition transform group-hover:scale-110 group-active:scale-95">
                  <PhoneOffIcon className="h-6 w-6" />
                </div>
                <span className="text-xs text-slate-300 group-hover:text-white">Từ chối</span>
              </button>

              {/* Nút trả lời */}
              <button
                onClick={acceptCall}
                className="group flex flex-col items-center gap-2 focus:outline-none"
                title="Trả lời"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/40 transition transform group-hover:scale-110 group-active:scale-95 animate-bounce">
                  <PhoneIcon className="h-6 w-6" />
                </div>
                <span className="text-xs text-slate-300 group-hover:text-white">Trả lời</span>
              </button>
            </>
          )}

          {status === 'calling' && (
            <button
              onClick={endCall}
              className="group flex flex-col items-center gap-2 focus:outline-none"
              title="Huỷ cuộc gọi"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-600/30 transition transform group-hover:scale-110 group-active:scale-95">
                <PhoneOffIcon className="h-6 w-6" />
              </div>
              <span className="text-xs text-slate-300 group-hover:text-white">Huỷ gọi</span>
            </button>
          )}

          {status === 'connected' && (
            <>
              {/* Nút bật/tắt Micro */}
              <button
                onClick={toggleMute}
                className="group flex flex-col items-center gap-2 focus:outline-none"
                title={isMuted ? 'Bật mic' : 'Tắt mic'}
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full transition transform group-hover:scale-105 group-active:scale-95 ${
                    isMuted ? 'bg-amber-600 text-white shadow-amber-600/30' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {isMuted ? <MicOffIcon className="h-5 w-5" /> : <MicIcon className="h-5 w-5" />}
                </div>
                <span className="text-xs text-slate-300 group-hover:text-white">
                  {isMuted ? 'Đang tắt mic' : 'Mic'}
                </span>
              </button>

              {/* Nút kết thúc */}
              <button
                onClick={endCall}
                className="group flex flex-col items-center gap-2 focus:outline-none"
                title="Kết thúc cuộc gọi"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-600/40 transition transform group-hover:scale-110 group-active:scale-95">
                  <PhoneOffIcon className="h-6 w-6" />
                </div>
                <span className="text-xs text-slate-300 group-hover:text-white">Kết thúc</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
