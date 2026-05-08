import { registerAs } from '@nestjs/config';

export default registerAs('sms', () => ({
  // "mock" = log OTP to console. No real SMS sent in development.
  provider: process.env.SMS_PROVIDER ?? 'mock',
  apiKey: process.env.SMS_API_KEY ?? '',
  senderName: process.env.SMS_SENDER_NAME ?? 'DELIVERY',
  // Israel country code — all phone numbers use +972
  phonePrefix: process.env.SMS_PHONE_PREFIX ?? '+972',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
  },
}));
