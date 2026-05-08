import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import { SmsService } from './sms.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly smsService: SmsService,
  ) {}

  // ─── OTP Request ──────────────────────────────────────────────────────────

  async requestOtp(
    phone: string,
  ): Promise<{ message: string; expiresInSeconds: number }> {
    await this.prisma.otpCode.updateMany({
      where: { phone, isUsed: false },
      data: { isUsed: true },
    });

    const code = this.generateOtpCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.otpCode.create({ data: { phone, codeHash, expiresAt } });
    this.smsService.sendOtp(phone, code);

    return { message: 'OTP sent successfully', expiresInSeconds: 300 };
  }

  // ─── OTP Verify ───────────────────────────────────────────────────────────

  async verifyOtp(phone: string, code: string, role: 'CUSTOMER' | 'DRIVER') {
    const otpRecord = await this.prisma.otpCode.findFirst({
      where: { phone, isUsed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) throw new BadRequestException('AUTH_INVALID_OTP');
    if (otpRecord.expiresAt < new Date())
      throw new BadRequestException('AUTH_OTP_EXPIRED');
    if (otpRecord.attempts >= 3)
      throw new BadRequestException('AUTH_OTP_MAX_ATTEMPTS');

    const isValid = await bcrypt.compare(code, otpRecord.codeHash);

    if (!isValid) {
      await this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('AUTH_INVALID_OTP');
    }

    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    let user = await this.prisma.user.findFirst({
      where: { phone, deletedAt: null },
    });
    const isNewUser = !user;

    if (!user) {
      user = await this.prisma.user.create({
        data: { phone, role, status: 'ACTIVE' },
      });

      if (role === 'CUSTOMER') {
        await this.prisma.customerProfile.create({ data: { userId: user.id } });
      } else {
        await this.prisma.driverProfile.create({ data: { userId: user.id } });
      }
    }

    if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
      throw new ForbiddenException('USER_SUSPENDED');
    }

    const tokens = await this.generateTokens(user.id, user.role);
    return {
      ...tokens,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        status: user.status,
        isNewUser,
      },
    };
  }

  // ─── Email Login ──────────────────────────────────────────────────────────

  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: {
        restaurantStaff: {
          where: { isActive: true },
          select: { restaurantId: true },
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('AUTH_INVALID_CREDENTIALS');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('AUTH_INVALID_CREDENTIALS');

    if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
      throw new ForbiddenException('USER_SUSPENDED');
    }

    const restaurantId = user.restaurantStaff?.[0]?.restaurantId;
    const tokens = await this.generateTokens(user.id, user.role, restaurantId);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        restaurantId: restaurantId ?? null,
      },
    };
  }

  // ─── Refresh Token ────────────────────────────────────────────────────────

  async refresh(rawRefreshToken: string) {
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(rawRefreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('AUTH_TOKEN_EXPIRED');
    }

    // Find the most-recent non-revoked token record for this user
    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, isRevoked: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('AUTH_TOKEN_REVOKED');
    }

    // Verify the presented token matches the stored hash (token rotation security)
    const isMatch = await bcrypt.compare(rawRefreshToken, stored.tokenHash);
    if (!isMatch) {
      // Possible token reuse attack — revoke all tokens for this user
      await this.prisma.refreshToken.updateMany({
        where: { userId: payload.sub, isRevoked: false },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException('AUTH_TOKEN_REVOKED');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true },
    });

    return this.generateTokens(payload.sub, payload.role, payload.restaurantId);
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(
    userId: string,
    refreshToken: string,
  ): Promise<{ message: string }> {
    // Attempt to revoke the specific token presented; fall back to revoking all
    let payload: JwtPayload | null = null;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      // Token may be expired/invalid — still revoke all for this user
    }

    if (payload) {
      // Revoke only the matching stored token
      const stored = await this.prisma.refreshToken.findFirst({
        where: { userId, isRevoked: false },
        orderBy: { createdAt: 'desc' },
      });
      if (stored) {
        const isMatch = await bcrypt.compare(refreshToken, stored.tokenHash);
        if (isMatch) {
          await this.prisma.refreshToken.update({
            where: { id: stored.id },
            data: { isRevoked: true },
          });
          return { message: 'Logged out successfully' };
        }
      }
    }

    // Fallback: revoke all tokens (logout all devices)
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
    return { message: 'Logged out successfully' };
  }

  // ─── Get Me ───────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        role: true,
        status: true,
        customerProfile: {
          select: { displayName: true, profilePhotoUrl: true },
        },
        driverProfile: { select: { displayName: true, profilePhotoUrl: true } },
      },
    });

    if (!user) throw new UnauthorizedException('AUTH_USER_NOT_FOUND');

    const profile = user.customerProfile ?? user.driverProfile ?? null;
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      status: user.status,
      profile: profile
        ? {
            displayName: profile.displayName,
            profilePhotoUrl: profile.profilePhotoUrl,
          }
        : null,
    };
  }

  // ─── Register Device Token ────────────────────────────────────────────────

  async registerDeviceToken(
    userId: string,
    fcmToken: string,
    platform: string,
  ): Promise<{ message: string }> {
    await this.prisma.deviceToken.upsert({
      where: { fcmToken },
      create: { userId, fcmToken, platform, lastSeenAt: new Date() },
      update: { userId, platform, lastSeenAt: new Date() },
    });
    return { message: 'Device token registered' };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async generateTokens(
    userId: string,
    role: string,
    restaurantId?: string | null,
  ) {
    const payload: JwtPayload = {
      sub: userId,
      role,
      ...(restaurantId ? { restaurantId } : {}),
    };

    const accessSecret = this.config.get<string>('jwt.accessSecret')!;
    const refreshSecret = this.config.get<string>('jwt.refreshSecret')!;

    // expiresIn must be number (seconds) for @nestjs/jwt v11+
    const accessExpiresIn = 900; // 15 minutes
    const refreshExpiresIn = 2592000; // 30 days

    const accessToken = this.jwtService.sign(payload, {
      secret: accessSecret,
      expiresIn: accessExpiresIn,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    });

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken, expiresIn: 900 };
  }
}
