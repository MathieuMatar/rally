import { io, type Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@rally/shared';

export interface LocationSocketHandlers {
  onHelpGranted?: (hintsRemaining: number) => void;
  onSosAck?: () => void;
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
    this.socket = io(this.serverUrl, { transports: ['websocket'] });
    this.socket.on('connect', () => {
      this.socket?.emit(SOCKET_EVENTS.HELLO, { token: this.token });
    });
    this.socket.on(SOCKET_EVENTS.HELP_GRANTED, (payload: { hintsRemaining: number }) => {
      this.handlers.onHelpGranted?.(payload.hintsRemaining);
    });
    this.socket.on(SOCKET_EVENTS.SOS_ACK, () => {
      this.handlers.onSosAck?.();
    });
  }

  sendLocation(lat: number, lng: number): void {
    this.socket?.emit(SOCKET_EVENTS.LOCATION, { lat, lng });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
