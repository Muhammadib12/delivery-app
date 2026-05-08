import { registerAs } from '@nestjs/config';

export default registerAs('firebase', () => ({
  // false = stub mode. All FCM calls are logged to console only.
  enabled: process.env.FCM_ENABLED === 'true',
  projectId: process.env.FCM_PROJECT_ID ?? '',
  clientEmail: process.env.FCM_CLIENT_EMAIL ?? '',
  privateKey: (process.env.FCM_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
}));
