import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@rally/shared';
import { SERVER_URL } from './config';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export type DashCallState = 'idle' | 'ringing' | 'connected';

export interface IncomingCall {
  callId: string;
  teamId: string;
  teamName: string;
  callType: 'hq' | 'emergency';
}

export interface IncomingCallHook {
  callState: DashCallState;
  incomingCall: IncomingCall | null;
  muted: boolean;
  accept(): Promise<void>;
  reject(): void;
  hangUp(): void;
  toggleMute(): void;
}

export function useIncomingCall(token: string): IncomingCallHook {
  const [callState, setCallState] = useState<DashCallState>('idle');
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [muted, setMuted] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const offerSdpRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }
    offerSdpRef.current = null;
    pendingIceRef.current = [];
    setCallState('idle');
    setIncomingCall(null);
    setMuted(false);
  }, []);

  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit(SOCKET_EVENTS.HELLO, { token });
    });

    socket.on(SOCKET_EVENTS.CALL_OFFER, (data: IncomingCall & { sdp: RTCSessionDescriptionInit }) => {
      // If already in a call, silently ignore subsequent offers.
      if (callState !== 'idle') return;
      offerSdpRef.current = data.sdp;
      setIncomingCall({ callId: data.callId, teamId: data.teamId, teamName: data.teamName, callType: data.callType });
      setCallState('ringing');
    });

    socket.on(SOCKET_EVENTS.CALL_ICE, (data: { callId: string; candidate: RTCIceCandidateInit }) => {
      const pc = pcRef.current;
      if (!pc || pc.remoteDescription === null) {
        pendingIceRef.current.push(data.candidate);
      } else {
        void pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    socket.on(SOCKET_EVENTS.CALL_END, () => {
      cleanup();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const accept = useCallback(async () => {
    const call = incomingCall;
    const offerSdp = offerSdpRef.current;
    const socket = socketRef.current;
    if (!call || !offerSdp || !socket) return;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.ontrack = (event) => {
      const audio = new Audio();
      audio.srcObject = event.streams[0] ?? null;
      audioRef.current = audio;
      void audio.play();
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit(SOCKET_EVENTS.CALL_ICE, {
          callId: call.callId,
          candidate: event.candidate.toJSON(),
          toTeamId: call.teamId,
        });
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));

    for (const c of pendingIceRef.current) {
      await pc.addIceCandidate(new RTCIceCandidate(c));
    }
    pendingIceRef.current = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit(SOCKET_EVENTS.CALL_ANSWER, {
      callId: call.callId,
      toTeamId: call.teamId,
      sdp: { type: pc.localDescription!.type, sdp: pc.localDescription!.sdp },
    });

    setCallState('connected');
  }, [incomingCall, cleanup]);

  const reject = useCallback(() => {
    const socket = socketRef.current;
    const call = incomingCall;
    if (socket && call) {
      socket.emit(SOCKET_EVENTS.CALL_END, { callId: call.callId, toTeamId: call.teamId });
    }
    cleanup();
  }, [incomingCall, cleanup]);

  const hangUp = useCallback(() => {
    reject();
  }, [reject]);

  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = muted; });
    setMuted((m) => !m);
  }, [muted]);

  return { callState, incomingCall, muted, accept, reject, hangUp, toggleMute };
}
