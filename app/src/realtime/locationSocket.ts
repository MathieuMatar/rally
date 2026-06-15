import { io, type Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@rally/shared';

/** Thin wrapper around a socket.io connection used to push live GPS pings to organizers (§3.3). */
export class LocationSocket {
  private socket: Socket | null = null;

  constructor(
    private readonly serverUrl: string,
    private readonly token: string,
  ) {}

  connect(): void {
    if (this.socket) return;
    this.socket = io(this.serverUrl, { transports: ['websocket'] });
    this.socket.on('connect', () => {
      this.socket?.emit(SOCKET_EVENTS.HELLO, { token: this.token });
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
