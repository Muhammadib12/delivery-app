import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Seeds all users, restaurant, menu, driver, and platform settings needed
 * for the e2e test suite. Call after cleanDatabase().
 */
export async function seedTestData(prisma: PrismaClient): Promise<SeedResult> {
  // ─── Platform settings ────────────────────────────────────────────────────
  const settings = [
    {
      key: 'commission_rate_default',
      value: '15',
      dataType: 'number',
      description: '',
    },
    {
      key: 'delivery_fee_cod',
      value: '15',
      dataType: 'number',
      description: '',
    },
    {
      key: 'delivery_fee_card',
      value: '16',
      dataType: 'number',
      description: '',
    },
    {
      key: 'driver_delivery_amount',
      value: '15',
      dataType: 'number',
      description: '',
    },
    {
      key: 'dispatch_radius_km',
      value: '5',
      dataType: 'number',
      description: '',
    },
    {
      key: 'dispatch_radius_expand_km',
      value: '2',
      dataType: 'number',
      description: '',
    },
    {
      key: 'driver_offer_timeout_seconds',
      value: '30',
      dataType: 'number',
      description: '',
    },
    {
      key: 'auto_reject_minutes',
      value: '3',
      dataType: 'number',
      description: '',
    },
    {
      key: 'min_order_amount_global',
      value: '0',
      dataType: 'number',
      description: '',
    },
    {
      key: 'platform_currency',
      value: 'ILS',
      dataType: 'string',
      description: '',
    },
    {
      key: 'platform_country',
      value: 'Israel',
      dataType: 'string',
      description: '',
    },
    {
      key: 'platform_phone_prefix',
      value: '+972',
      dataType: 'string',
      description: '',
    },
  ];

  for (const s of settings) {
    await prisma.platformSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  // ─── Users ────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Test1234!', 10);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  const superAdminUser = await prisma.user.create({
    data: {
      email: 'superadmin@test.com',
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });

  const supportUser = await prisma.user.create({
    data: {
      email: 'support@test.com',
      passwordHash,
      role: 'SUPPORT',
      status: 'ACTIVE',
    },
  });

  // ─── Restaurant category ──────────────────────────────────────────────────
  const restaurantCategory = await prisma.restaurantCategory.create({
    data: { name: 'Fast Food', sortOrder: 1, isActive: true },
  });

  // ─── Restaurant owner ─────────────────────────────────────────────────────
  const restaurantOwnerUser = await prisma.user.create({
    data: {
      email: 'owner@testrestaurant.com',
      passwordHash,
      role: 'RESTAURANT_OWNER',
      status: 'ACTIVE',
    },
  });

  const restaurant = await prisma.restaurant.create({
    data: {
      categoryId: restaurantCategory.id,
      name: 'Test Restaurant',
      description: 'A test restaurant',
      address: 'Kabul Street 1, Test City',
      latitude: 31.7683,
      longitude: 35.2137,
      status: 'OPEN',
      commissionRate: 15,
      avgPrepTimeMinutes: 20,
      minOrderAmount: 30,
    },
  });

  await prisma.restaurantStaff.create({
    data: {
      userId: restaurantOwnerUser.id,
      restaurantId: restaurant.id,
      role: 'OWNER',
      isActive: true,
    },
  });

  // Update user's token with restaurantId (handled by login, but set up staff link)
  const restaurantStaffUser = await prisma.user.create({
    data: {
      email: 'staff@testrestaurant.com',
      passwordHash,
      role: 'RESTAURANT_STAFF',
      status: 'ACTIVE',
    },
  });

  await prisma.restaurantStaff.create({
    data: {
      userId: restaurantStaffUser.id,
      restaurantId: restaurant.id,
      role: 'STAFF',
      isActive: true,
    },
  });

  // ─── Menu ─────────────────────────────────────────────────────────────────
  const menuCategory = await prisma.menuCategory.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Main Course',
      sortOrder: 1,
      isActive: true,
    },
  });

  const product = await prisma.product.create({
    data: {
      restaurantId: restaurant.id,
      menuCategoryId: menuCategory.id,
      name: 'Test Burger',
      description: 'A juicy test burger',
      price: 45,
      isAvailable: true,
      sortOrder: 1,
    },
  });

  const unavailableProduct = await prisma.product.create({
    data: {
      restaurantId: restaurant.id,
      menuCategoryId: menuCategory.id,
      name: 'Unavailable Item',
      price: 20,
      isAvailable: false,
      sortOrder: 2,
    },
  });

  // ─── Driver ───────────────────────────────────────────────────────────────
  const driverUser = await prisma.user.create({
    data: {
      phone: '+972501000099',
      role: 'DRIVER',
      status: 'ACTIVE',
    },
  });

  const driverProfile = await prisma.driverProfile.create({
    data: {
      userId: driverUser.id,
      displayName: 'Test Driver',
      vehicleType: 'motorcycle',
      vehiclePlate: 'TEST-123',
      vehicleColor: 'Black',
      verificationStatus: 'APPROVED',
      availabilityStatus: 'OFFLINE',
    },
  });

  // ─── Customer ─────────────────────────────────────────────────────────────
  const customerUser = await prisma.user.create({
    data: {
      phone: '+972501000088',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    },
  });

  const customerProfile = await prisma.customerProfile.create({
    data: {
      userId: customerUser.id,
      displayName: 'Test Customer',
    },
  });

  const customerAddress = await prisma.customerAddress.create({
    data: {
      customerId: customerProfile.id,
      label: 'Home',
      street: '1 Test Street',
      city: 'Kabul',
      latitude: 31.77,
      longitude: 35.22,
      isDefault: true,
    },
  });

  return {
    adminUser,
    superAdminUser,
    supportUser,
    restaurantOwnerUser,
    restaurantStaffUser,
    restaurant,
    restaurantCategory,
    menuCategory,
    product,
    unavailableProduct,
    driverUser,
    driverProfile,
    customerUser,
    customerProfile,
    customerAddress,
  };
}

export interface SeedResult {
  adminUser: any;
  superAdminUser: any;
  supportUser: any;
  restaurantOwnerUser: any;
  restaurantStaffUser: any;
  restaurant: any;
  restaurantCategory: any;
  menuCategory: any;
  product: any;
  unavailableProduct: any;
  driverUser: any;
  driverProfile: any;
  customerUser: any;
  customerProfile: any;
  customerAddress: any;
}
