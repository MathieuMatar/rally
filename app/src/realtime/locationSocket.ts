import { io, type Socket } from 'socket.io-client';
import { SOCKET_EVENTS, type BroadcastMessage } from '@rally/shared';

export interface CallAnswerPayload {
  callId: string;
  toTeamId: string;
  sdp: { type: string; sdp: string };
}

export interface CallIcePayload {
  callId: string;
  candidate: object;
}

export interface LocationSocketHandlers {
  onHelpGranted?: (hintsRemaining: number) => void;
  onSosAck?: () => void;
  onBroadcast?: (message: BroadcastMessage) => void;
  onClueOverride?: (text: string) => void;
  onCallAnswer?: (payload: CallAnswerPayload) => void;
  onCallIce?: (payload: CallIcePayload) => void;
  onCallEnd?: (payload: { callId: string }) => void;
}

/**
 * Thin wrapper around a socket.io connection used to push live GPS pings to organizers (§3.3)
 * and to receive the team-targeted pushes that affect the hint counter and SOS confirmation.
 */
export class LocationSocket {
  private socket: Socket | null = null;

  constructor(
    private readonly serverUrl: string,
    private readonly token: string,
    private readonly handlers: LocationSocketHandlers = {},
  ) {}

  connect(): void {
    if (this.socket) return;
    this.socket = io(this.serverUrl, { transports: ['websocket', 'polling'] });
    this.socket.on('connect', () => {
      this.socket?.emit(SOCKET_EVENTS.HELLO, { token: this.token });
    });
    this.socket.on(SOCKET_EVENTS.HELP_GRANTED, (payload: { hintsRemaining: number }) => {
      this.handlers.onHelpGranted?.(payload.hintsRemaining);
    });
    this.socket.on(SOCKET_EVENTS.SOS_ACK, () => {
      this.handlers.onSosAck?.();
    });
    this.socket.on(SOCKET_EVENTS.BROADCAST, (payload: BroadcastMessage) => {
      this.handlers.onBroadcast?.(payload);
    });
    this.socket.on(SOCKET_EVENTS.CLUE_OVERRIDE, (payload: { text: string }) => {
      this.handlers.onClueOverride?.(payload.text);
    });
    this.socket.on(SOCKET_EVENTS.CALL_ANSWER, (payload: CallAnswerPayload) => {
      this.handlers.onCallAnswer?.(payload);
    });
    this.socket.on(SOCKET_EVENTS.CALL_ICE, (payload: CallIcePayload) => {
      this.handlers.onCallIce?.(payload);
    });
    this.socket.on(SOCKET_EVENTS.CALL_END, (payload: { callId: string }) => {
      this.handlers.onCallEnd?.(payload);
    });
  }

  sendLocation(lat: number, lng: number): void {
    this.socket?.emit(SOCKET_EVENTS.LOCATION, { lat, lng });
  }

  sendCallOffer(callId: string, callType: string, teamId: string, teamName: string, sdp: object): void {
    this.socket?.emit(SOCKET_EVENTS.CALL_OFFER, { callId, callType, teamId, teamName, sdp });
  }

  sendCallIce(callId: string, candidate: object): void {
    this.socket?.emit(SOCKET_EVENTS.CALL_ICE, { callId, candidate });
  }

  sendCallEnd(callId: string): void {
    this.socket?.emit(SOCKET_EVENTS.CALL_END, { callId });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
