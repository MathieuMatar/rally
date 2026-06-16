import { PermissionsAndroid } from 'react-native';
import { mediaDevices, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';
import type { LocationSocket } from './locationSocket';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export type CallState = 'idle' | 'dialing' | 'connected';
export type CallType = 'hq' | 'emergency';

/**
 * Manages a single outgoing audio-only WebRTC call.
 * Signaling travels over the existing LocationSocket connection.
 */
export class WebRTCSession {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pc: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private stream: any = null;
  private callId = '';

  constructor(
    private readonly socket: LocationSocket,
    private readonly teamId: string,
    private readonly teamName: string,
    private readonly onStateChange: (state: CallState) => void,
  ) {}

  async start(callId: string, callType: CallType): Promise<void> {
    this.callId = callId;

    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('Microphone permission denied');
    }

    this.stream = await mediaDevices.getUserMedia({ audio: true, video: false });

    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.stream.getTracks().forEach((track: any) => this.pc.addTrack(track, this.stream));

    this.pc.addEventListener('icecandidate', (event: { candidate: { toJSON(): object } | null }) => {
      if (event.candidate) {
        this.socket.sendCallIce(this.callId, event.candidate.toJSON());
      }
    });

    const offer = await (this.pc as RTCPeerConnection).createOffer({ offerToReceiveAudio: true });
    await (this.pc as RTCPeerConnection).setLocalDescription(offer);

    this.socket.sendCallOffer(
      callId,
      callType,
      this.teamId,
      this.teamName,
      { type: (this.pc as RTCPeerConnection).localDescription!.type, sdp: (this.pc as RTCPeerConnection).localDescription!.sdp },
    );

    this.onStateChange('dialing');
  }

  async handleAnswer(sdp: { type: string; sdp: string }): Promise<void> {
    if (!this.pc) return;
    await (this.pc as RTCPeerConnection).setRemoteDescription(new RTCSessionDescription(sdp));
    this.onStateChange('connected');
  }

  async handleIce(candidate: object): Promise<void> {
    if (!this.pc) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.pc as RTCPeerConnection).addIceCandidate(new RTCIceCandidate(candidate as any));
  }

  end(): void {
    this.socket.sendCallEnd(this.callId);
    this.cleanup();
  }

  cleanup(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.stream?.getTracks().forEach((t: any) => { t.stop(); });
    this.stream = null;
    this.pc?.close();
    this.pc = null;
    this.onStateChange('idle');
  }

  setMuted(muted: boolean): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.stream?.getAudioTracks().forEach((t: any) => { t.enabled = !muted; });
  }
}
