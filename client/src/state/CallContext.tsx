import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useChat } from './ChatContext';
import { useToast } from './toast';

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';

export interface CallPeer {
  id: string;
  name: string;
  avatar: string | null;
  role?: string;
}

interface CallContextType {
  status: CallStatus;
  peer: CallPeer | null;
  isMuted: boolean;
  duration: number;
  startCall: (peer: CallPeer, channelId?: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
}

const CallContext = createContext<CallContextType | null>(null);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall phải nằm trong CallProvider');
  return ctx;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// Tạo âm thanh chuông điện thoại thuần bằng Web Audio API (không cần tải file mp3 bên ngoài)
class PhoneSound {
  private ctx: AudioContext | null = null;
  private timer: any = null;

  private getCtx() {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playRing(type: 'incoming' | 'outgoing') {
    this.stop();
    const ctx = this.getCtx();
    if (!ctx) return;

    const playTone = () => {
      try {
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        // Tần số chuông chuẩn (440Hz + 480Hz)
        osc1.frequency.value = type === 'incoming' ? 440 : 400;
        osc2.frequency.value = type === 'incoming' ? 480 : 450;

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (type === 'incoming' ? 1.2 : 0.8));

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + (type === 'incoming' ? 1.2 : 0.8));
        osc2.stop(now + (type === 'incoming' ? 1.2 : 0.8));
      } catch (e) {
        console.warn('Ring tone error', e);
      }
    };

    playTone();
    this.timer = setInterval(playTone, type === 'incoming' ? 3000 : 2500);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

const ringSound = new PhoneSound();

export function CallProvider({ children }: { children: ReactNode }) {
  const { me, socket } = useChat();
  const toast = useToast();

  const [status, setStatus] = useState<CallStatus>('idle');
  const [peer, setPeer] = useState<CallPeer | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const timerRef = useRef<any>(null);
  const channelIdRef = useRef<string | null>(null);

  const cleanUp = useCallback(() => {
    ringSound.stop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    pendingCandidatesRef.current = [];
    pendingOfferRef.current = null;
    channelIdRef.current = null;
    setIsMuted(false);
    setDuration(0);
  }, []);

  const createPeerConnection = useCallback((targetUserId: string) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && socket?.connected) {
        socket.emit('call:candidate', {
          toUserId: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        ringSound.stop();
        setStatus('connected');
        if (!timerRef.current) {
          timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
        }
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        cleanUp();
        setStatus('ended');
        setTimeout(() => setStatus('idle'), 2000);
      }
    };

    return pc;
  }, [socket, cleanUp]);

  // Bắt đầu cuộc gọi đi
  const startCall = useCallback(async (targetPeer: CallPeer, chId?: string) => {
    if (!socket?.connected) {
      toast.push({ kind: 'error', title: 'Không có kết nối mạng', body: 'Vui lòng kiểm tra lại kết nối' });
      return;
    }
    if (targetPeer.id === me?.id) {
      toast.push({ kind: 'warning', title: 'Không thể tự gọi cho chính mình' });
      return;
    }

    try {
      cleanUp();
      setPeer(targetPeer);
      setStatus('calling');
      channelIdRef.current = chId || null;
      ringSound.playRing('outgoing');

      // Lấy micro
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const pc = createPeerConnection(targetPeer.id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call:invite', {
        toUserId: targetPeer.id,
        channelId: chId,
        offer,
      });
    } catch (err: any) {
      cleanUp();
      setStatus('idle');
      toast.push({
        kind: 'error',
        title: 'Không thể truy cập Microphone',
        body: err.name === 'NotAllowedError' ? 'Vui lòng cấp quyền truy cập mic trên trình duyệt.' : (err.message || 'Lỗi thiết bị âm thanh'),
      });
    }
  }, [socket, toast, cleanUp, createPeerConnection]);

  // Nhận cuộc gọi đến
  const acceptCall = useCallback(async () => {
    if (!peer || !pendingOfferRef.current || !socket?.connected) return;
    ringSound.stop();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const pc = createPeerConnection(peer.id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));

      // Thêm các candidate nhận trước đó nếu có
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('call:answer', {
        toUserId: peer.id,
        answer,
      });

      setStatus('connected');
      if (!timerRef.current) {
        timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      }
    } catch (err: any) {
      cleanUp();
      setStatus('idle');
      toast.push({ kind: 'error', title: 'Không thể kết nối cuộc gọi', body: err.message });
    }
  }, [peer, socket, toast, cleanUp, createPeerConnection]);

  // Từ chối cuộc gọi
  const rejectCall = useCallback(() => {
    if (peer && socket?.connected) {
      socket.emit('call:reject', { toUserId: peer.id, reason: 'declined' });
    }
    cleanUp();
    setStatus('idle');
    setPeer(null);
  }, [peer, socket, cleanUp]);

  // Kết thúc cuộc gọi
  const endCall = useCallback(() => {
    const wasCalling = status === 'calling';
    if (peer && socket?.connected) {
      socket.emit('call:end', { toUserId: peer.id, duration });
    }
    cleanUp();
    setStatus('ended');
    toast.push({
      kind: 'info',
      title: wasCalling ? 'Đã huỷ cuộc gọi' : 'Cuộc gọi đã kết thúc',
    });
    setTimeout(() => {
      setStatus('idle');
      setPeer(null);
    }, 1500);
  }, [peer, socket, duration, cleanUp, status, toast]);

  // Bật/tắt mic
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // Lắng nghe các sự kiện socket cuộc gọi
  useEffect(() => {
    if (!socket) return;

    // Cuộc gọi đến
    const onIncoming = ({ caller, channelId, offer }: { caller: CallPeer; channelId?: string; offer: RTCSessionDescriptionInit }) => {
      if (status !== 'idle') {
        // Đang bận cuộc gọi khác
        socket.emit('call:reject', { toUserId: caller.id, reason: 'busy' });
        return;
      }
      setPeer(caller);
      channelIdRef.current = channelId || null;
      pendingOfferRef.current = offer;
      setStatus('incoming');
      ringSound.playRing('incoming');
    };

    // Đối phương trả lời cuộc gọi
    const onAnswered = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      ringSound.stop();
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          for (const candidate of pendingCandidatesRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          }
          pendingCandidatesRef.current = [];
          setStatus('connected');
          if (!timerRef.current) {
            timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
          }
        } catch (e) {
          console.error('Lỗi thiết lập remote description', e);
        }
      }
    };

    // Nhận ICE Candidate
    const onCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      if (pcRef.current && pcRef.current.remoteDescription) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Lỗi addIceCandidate', e);
        }
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    // Đối phương từ chối
    const onRejected = ({ reason }: { reason: string }) => {
      cleanUp();
      setStatus('ended');
      toast.push({
        kind: 'info',
        title: reason === 'busy' ? 'Người dùng đang bận' : 'Cuộc gọi bị từ chối',
      });
      setTimeout(() => {
        setStatus('idle');
        setPeer(null);
      }, 1500);
    };

    // Đối phương kết thúc
    const onEnded = () => {
      const wasIncoming = status === 'incoming';
      cleanUp();
      setStatus('ended');
      toast.push({
        kind: 'info',
        title: wasIncoming ? 'Cuộc gọi nhỡ' : 'Cuộc gọi đã kết thúc',
      });
      setTimeout(() => {
        setStatus('idle');
        setPeer(null);
      }, 1500);
    };

    // Đối phương mất kết nối mạng
    const onPeerDisconnected = ({ userId }: { userId: string }) => {
      if (peer && peer.id === userId) {
        cleanUp();
        setStatus('ended');
        toast.push({ kind: 'warning', title: 'Đối phương đã mất kết nối' });
        setTimeout(() => {
          setStatus('idle');
          setPeer(null);
        }, 1500);
      }
    };

    // Cuộc gọi đã được xử lý hoặc kết thúc ở thiết bị/phiên đăng nhập khác của cùng tài khoản
    const onDismissed = ({ reason }: { peerId?: string; reason?: string }) => {
      cleanUp();
      setStatus('idle');
      setPeer(null);
      if (reason === 'answered_elsewhere') {
        toast.push({ kind: 'info', title: 'Cuộc gọi đã được nhận ở thiết bị khác' });
      }
    };

    socket.on('call:incoming', onIncoming);
    socket.on('call:answered', onAnswered);
    socket.on('call:candidate', onCandidate);
    socket.on('call:rejected', onRejected);
    socket.on('call:ended', onEnded);
    socket.on('call:dismissed', onDismissed);
    socket.on('call:peer_disconnected', onPeerDisconnected);

    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:answered', onAnswered);
      socket.off('call:candidate', onCandidate);
      socket.off('call:rejected', onRejected);
      socket.off('call:ended', onEnded);
      socket.off('call:dismissed', onDismissed);
      socket.off('call:peer_disconnected', onPeerDisconnected);
    };
  }, [socket, status, peer, cleanUp, toast]);

  return (
    <CallContext.Provider
      value={{
        status,
        peer,
        isMuted,
        duration,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        remoteAudioRef,
      }}
    >
      {children}
      {/* Thẻ audio ẩn phát âm thanh từ người đối diện */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
    </CallContext.Provider>
  );
}
