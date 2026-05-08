/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/realtime',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  // userId → socketId mapping for targeted emits
  private readonly userSockets = new Map<string, string>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Connection lifecycle ─────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) throw new Error('No token');

      const secret = this.config.get<string>('jwt.accessSecret');
      const payload = this.jwt.verify<{ sub: string; role: string }>(token, {
        secret,
      });

      client.data.userId = payload.sub;
      client.data.role = payload.role;

      this.userSockets.set(payload.sub, client.id);
      this.logger.log(`Connected: userId=${payload.sub} role=${payload.role}`);
    } catch {
      client.emit('error', { message: 'UNAUTHORIZED' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data.userId) {
      this.userSockets.delete(client.data.userId);
      this.logger.log(`Disconnected: userId=${client.data.userId}`);
    }
  }

  // ─── Room subscription ────────────────────────────────────────────────────

  @SubscribeMessage('join_order')
  async joinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    if (!client.data.userId) throw new WsException('UNAUTHORIZED');
    const room = `order:${data.orderId}`;
    await client.join(room);
    client.emit('joined', { room });
  }

  @SubscribeMessage('leave_order')
  async leaveOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    await client.leave(`order:${data.orderId}`);
  }

  // ─── Driver location relay ────────────────────────────────────────────────

  @SubscribeMessage('driver_location')
  handleDriverLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { orderId: string; latitude: number; longitude: number },
  ) {
    if (client.data.role !== 'DRIVER') return;
    // Relay location to everyone in the order room (customer + restaurant)
    this.server.to(`order:${data.orderId}`).emit('driver_location_updated', {
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: new Date().toISOString(),
    });
  }

  // ─── Server-side emit helpers (called by services) ────────────────────────

  emitToOrder(orderId: string, event: string, payload: object) {
    this.server.to(`order:${orderId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: object) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(event, payload);
    }
  }

  // ─── Reconnection sync ────────────────────────────────────────────────────

  @SubscribeMessage('sync_order')
  async syncOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string; currentStatus: string },
  ) {
    // Client sends its last known status; server confirms or sends latest
    // The actual latest status is fetched by the client via REST —
    // this event just triggers a re-emit of the last status event for that order.
    client.emit('sync_ack', {
      orderId: data.orderId,
      message: 'Use REST to fetch latest state',
    });
  }
}
