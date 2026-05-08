import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: string;

  constructor(private readonly config: ConfigService) {
    this.provider = this.config.get<string>('sms.provider') ?? 'mock';
  }

  sendOtp(phone: string, code: string): void {
    if (this.provider === 'mock') {
      // Local development — log OTP to console instead of sending real SMS
      this.logger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.warn(`  SMS MOCK — Phone: ${phone}`);
      this.logger.warn(`  OTP CODE: ${code}`);
      this.logger.warn(`  Expires in: 5 minutes`);
      this.logger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }

    // Real provider integration added in production (Inforu / 019 Mobile — +972)
    throw new Error(`SMS provider "${this.provider}" not yet implemented`);
  }
}
