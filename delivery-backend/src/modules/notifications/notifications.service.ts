import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseEnabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const projectId = this.config.get<string>('firebase.projectId');
    const clientEmail = this.config.get<string>('firebase.clientEmail');
    const privateKey = this.config.get<string>('firebase.privateKey');

    if (projectId && clientEmail && privateKey && !admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      this.firebaseEnabled = true;
      this.logger.log('Firebase Admin initialized');
    } else {
      this.logger.warn(
        'Firebase not configured — running in MOCK mode (logs only)',
      );
    }
  }

  // ─── Device token registration ────────────────────────────────────────────

  async registerToken(
    userId: string,
    fcmToken: string,
    platform: 'android' | 'ios' | 'web',
  ) {
    await this.prisma.deviceToken.upsert({
      where: { fcmToken },
      update: { userId, platform, lastSeenAt: new Date() },
      create: { userId, fcmToken, platform },
    });
  }

  async removeToken(fcmToken: string) {
    await this.prisma.deviceToken.deleteMany({ where: { fcmToken } });
  }

  // ─── Send to a user (all their devices) ──────────────────────────────────

  async sendToUser(userId: string, notification: NotificationPayload) {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: { fcmToken: true },
    });

    if (tokens.length === 0) return;

    await this.send(
      tokens.map((t) => t.fcmToken),
      notification,
    );
  }

  // ─── Core send ────────────────────────────────────────────────────────────

  private async send(fcmTokens: string[], payload: NotificationPayload) {
    if (!this.firebaseEnabled) {
      this.logger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.warn(`  FCM MOCK — Sending to ${fcmTokens.length} device(s)`);
      this.logger.warn(`  Title : ${payload.title}`);
      this.logger.warn(`  Body  : ${payload.body}`);
      if (payload.data)
        this.logger.warn(`  Data  : ${JSON.stringify(payload.data)}`);
      this.logger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }

    // Send in batches of 500 (FCM limit)
    const batchSize = 500;
    for (let i = 0; i < fcmTokens.length; i += batchSize) {
      const batch = fcmTokens.slice(i, i + batchSize);
      try {
        const response = await admin.messaging().sendEachForMulticast({
          tokens: batch,
          notification: { title: payload.title, body: payload.body },
          data: payload.data ? this.stringifyData(payload.data) : undefined,
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default' } } },
        });

        // Remove invalid tokens
        response.responses.forEach((r, idx) => {
          if (
            !r.success &&
            r.error?.code === 'messaging/registration-token-not-registered'
          ) {
            this.removeToken(batch[idx]).catch(() => {});
          }
        });
      } catch (err) {
        this.logger.error('FCM send error:', err);
      }
    }
  }

  private stringifyData(data: Record<string, any>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)]),
    );
  }
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}
