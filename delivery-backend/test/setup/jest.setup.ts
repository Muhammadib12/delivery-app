import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test — must happen before any module imports
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// Safety guard: never run tests against production
if (process.env.NODE_ENV === 'production') {
  throw new Error(
    '⛔  Tests MUST NOT run against a production environment.\n' +
      '    Set NODE_ENV=test and use a dedicated test database.',
  );
}

if (!process.env.DATABASE_URL?.includes('test')) {
  console.warn(
    '⚠️  WARNING: DATABASE_URL does not contain "test". ' +
      'Make sure you are not pointing at production!',
  );
}
