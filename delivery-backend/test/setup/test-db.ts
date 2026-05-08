import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

/**
 * Wipes all data in the correct order (respects FK constraints).
 * Call in beforeEach or beforeAll depending on test isolation needs.
 */
export async function cleanDatabase(): Promise<void> {
  // Disable FK checks for clean teardown
  await prisma.$executeRaw`SET session_replication_role = replica`;

  const tables = [
    'AuditLog',
    'SupportMessage',
    'SupportTicket',
    'Notification',
    'DriverEarning',
    'DriverOffer',
    'DriverStatusHistory',
    'DriverLocation',
    'DriverDocument',
    'Delivery',
    'PaymentEvent',
    'Refund',
    'Payment',
    'OrderItemModifier',
    'OrderItem',
    'OrderCancellation',
    'OrderStatusHistory',
    'Order',
    'ProductModifierOption',
    'ProductModifier',
    'ProductImage',
    'Product',
    'MenuCategory',
    'RestaurantWorkingHour',
    'RestaurantStaff',
    'Commission',
    'Restaurant',
    'RestaurantCategory',
    'CartItem',
    'Cart',
    'CustomerAddress',
    'CustomerProfile',
    'DriverProfile',
    'DeviceToken',
    'UserSession',
    'OtpCode',
    'RefreshToken',
    'PlatformSetting',
    'User',
  ];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
  }

  await prisma.$executeRaw`SET session_replication_role = DEFAULT`;
}

export async function disconnectTestDb(): Promise<void> {
  await prisma.$disconnect();
}

export { prisma as testPrisma };
