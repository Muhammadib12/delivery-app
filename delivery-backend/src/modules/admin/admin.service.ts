/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
  ) {}

  // ─── Dashboard ────────────────────────────────────────────────────────────

  async getDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalDrivers,
      totalRestaurants,
      totalOrders,
      todayOrders,
      pendingDrivers,
      deliveredOrders,
      totalEarnings,
      todayEarnings,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.driverProfile.count(),
      this.prisma.restaurant.count({ where: { deletedAt: null } }),
      this.prisma.order.count({ where: { deletedAt: null } }),
      this.prisma.order.count({
        where: { createdAt: { gte: today }, deletedAt: null },
      }),
      this.prisma.driverProfile.count({
        where: { verificationStatus: 'PENDING_REVIEW' },
      }),
      this.prisma.order.count({
        where: { status: 'DELIVERED', deletedAt: null },
      }),
      this.prisma.driverEarning.aggregate({ _sum: { grossAmount: true } }),
      this.prisma.driverEarning.aggregate({
        where: { createdAt: { gte: today } },
        _sum: { grossAmount: true },
      }),
    ]);

    return {
      users: { total: totalUsers },
      drivers: { total: totalDrivers, pendingApproval: pendingDrivers },
      restaurants: { total: totalRestaurants },
      orders: {
        total: totalOrders,
        today: todayOrders,
        delivered: deliveredOrders,
      },
      revenue: {
        totalDeliveryFees: Number(totalEarnings._sum.grossAmount ?? 0),
        todayDeliveryFees: Number(todayEarnings._sum.grossAmount ?? 0),
      },
    };
  }

  // ─── Users ────────────────────────────────────────────────────────────────

  async listUsers(query: {
    role?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.role) where.role = query.role;
    if (query.search) where.phone = { contains: query.search };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          customerProfile: { select: { displayName: true } },
          driverProfile: {
            select: { displayName: true, verificationStatus: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => ({
        id: u.id,
        phone: u.phone,
        role: u.role,
        status: u.status,
        displayName:
          u.customerProfile?.displayName ??
          u.driverProfile?.displayName ??
          null,
        driverStatus: u.driverProfile?.verificationStatus ?? null,
        createdAt: u.createdAt,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async setUserStatus(
    userId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'BANNED',
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('RESOURCE_NOT_FOUND');
    await this.prisma.user.update({ where: { id: userId }, data: { status } });
    return { userId, status };
  }

  // ─── Drivers ──────────────────────────────────────────────────────────────

  async listDrivers(query: { status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.verificationStatus = query.status;

    const [drivers, total] = await Promise.all([
      this.prisma.driverProfile.findMany({
        where,
        include: { user: { select: { phone: true, status: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.driverProfile.count({ where }),
    ]);

    return {
      data: drivers.map((d) => ({
        id: d.id,
        userId: d.userId,
        displayName: d.displayName,
        phone: d.user.phone,
        userStatus: d.user.status,
        verificationStatus: d.verificationStatus,
        availabilityStatus: d.availabilityStatus,
        vehicleType: d.vehicleType,
        vehiclePlate: d.vehiclePlate,
        rating: Number(d.rating),
        totalDeliveries: d.totalDeliveries,
        createdAt: d.createdAt,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getDriver(driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: {
        user: { select: { phone: true, status: true } },
        documents: true,
        earnings: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!driver) throw new NotFoundException('RESOURCE_NOT_FOUND');

    const totalEarnings = await this.prisma.driverEarning.aggregate({
      where: { driverId },
      _sum: { netAmount: true },
    });

    return {
      id: driver.id,
      userId: driver.userId,
      displayName: driver.displayName,
      phone: driver.user.phone,
      userStatus: driver.user.status,
      verificationStatus: driver.verificationStatus,
      availabilityStatus: driver.availabilityStatus,
      vehicleType: driver.vehicleType,
      vehiclePlate: driver.vehiclePlate,
      rating: Number(driver.rating),
      totalDeliveries: driver.totalDeliveries,
      totalEarnings: Number(totalEarnings._sum.netAmount ?? 0),
      documents: driver.documents,
      recentEarnings: driver.earnings.map((e) => ({
        deliveryId: e.deliveryId,
        grossAmount: Number(e.grossAmount),
        netAmount: Number(e.netAmount),
        payoutStatus: e.payoutStatus,
        createdAt: e.createdAt,
      })),
      createdAt: driver.createdAt,
    };
  }

  async updateDriverVerification(
    driverId: string,
    status: 'APPROVED' | 'REJECTED',
    note?: string,
  ) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
    });
    if (!driver) throw new NotFoundException('RESOURCE_NOT_FOUND');

    await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: {
        verificationStatus: status,
        rejectionReason: status === 'REJECTED' ? (note ?? null) : null,
      },
    });

    return { driverId, verificationStatus: status };
  }

  // ─── Restaurants ──────────────────────────────────────────────────────────

  async listRestaurants(query: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.status) where.status = query.status;

    const [restaurants, total] = await Promise.all([
      this.prisma.restaurant.findMany({
        where,
        include: {
          category: { select: { name: true } },
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.restaurant.count({ where }),
    ]);

    return {
      data: restaurants.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category?.name ?? null,
        status: r.status,
        address: r.address,
        rating: Number(r.rating),
        totalOrders: r._count.orders,
        commissionRate: r.commissionRate ? Number(r.commissionRate) : null,
        createdAt: r.createdAt,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getRestaurant(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
      include: {
        category: { select: { name: true } },
        staff: { include: { user: { select: { phone: true, role: true } } } },
        _count: { select: { orders: true, products: true } },
      },
    });
    if (!restaurant) throw new NotFoundException('RESOURCE_NOT_FOUND');

    const revenue = await this.prisma.order.aggregate({
      where: { restaurantId, status: 'DELIVERED', deletedAt: null },
      _sum: { total: true },
    });

    return {
      id: restaurant.id,
      name: restaurant.name,
      category: restaurant.category?.name ?? null,
      status: restaurant.status,
      address: restaurant.address,
      rating: Number(restaurant.rating),
      totalReviews: restaurant.totalReviews,
      commissionRate: restaurant.commissionRate
        ? Number(restaurant.commissionRate)
        : null,
      minOrderAmount: Number(restaurant.minOrderAmount),
      totalOrders: restaurant._count.orders,
      totalProducts: restaurant._count.products,
      totalRevenue: Number(revenue._sum.total ?? 0),
      staff: restaurant.staff.map((s) => ({
        userId: s.userId,
        phone: s.user.phone,
        role: s.role,
        isActive: s.isActive,
      })),
      createdAt: restaurant.createdAt,
    };
  }

  async updateRestaurantStatus(
    restaurantId: string,
    status: 'OPEN' | 'CLOSED' | 'SUSPENDED',
  ) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
    });
    if (!restaurant) throw new NotFoundException('RESOURCE_NOT_FOUND');
    await this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { status },
    });
    return { restaurantId, status };
  }

  async updateRestaurantCommission(restaurantId: string, rate: number) {
    if (rate < 0 || rate > 100)
      throw new BadRequestException('Invalid commission rate');
    await this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { commissionRate: rate },
    });
    return { restaurantId, commissionRate: rate };
  }

  // ─── Orders ───────────────────────────────────────────────────────────────

  async listOrders(query: {
    status?: string;
    restaurantId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.restaurantId) where.restaurantId = query.restaurantId;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          restaurant: { select: { name: true } },
          delivery: { include: { driver: { select: { displayName: true } } } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((o) => ({
        id: o.id,
        status: o.status,
        restaurantName: o.restaurant.name,
        driverName: o.delivery?.driver?.displayName ?? null,
        total: Number(o.total),
        paymentMethod: o.paymentMethod,
        itemCount: o._count.items,
        createdAt: o.createdAt,
        deliveredAt: o.delivery?.deliveredAt ?? null,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Finance ──────────────────────────────────────────────────────────────

  async getFinanceReport(query: { from?: string; to?: string }) {
    const from = query.from
      ? new Date(query.from)
      : new Date(Date.now() - 30 * 86400000);
    const to = query.to ? new Date(query.to) : new Date();

    const [orderStats, driverEarnings, pendingPayouts] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: from, lte: to }, deletedAt: null },
        _count: true,
        _sum: { total: true, deliveryFee: true },
      }),
      this.prisma.driverEarning.aggregate({
        where: { createdAt: { gte: from, lte: to } },
        _sum: { grossAmount: true, netAmount: true, commissionDeducted: true },
        _count: true,
      }),
      this.prisma.driverEarning.aggregate({
        where: { payoutStatus: 'PENDING' },
        _sum: { netAmount: true },
        _count: true,
      }),
    ]);

    const deliveredOrders = orderStats.find((o) => o.status === 'DELIVERED');

    return {
      period: { from, to },
      orders: {
        byStatus: orderStats.map((o) => ({
          status: o.status,
          count: o._count,
          totalValue: Number(o._sum.total ?? 0),
          totalDeliveryFees: Number(o._sum.deliveryFee ?? 0),
        })),
        deliveredRevenue: Number(deliveredOrders?._sum.total ?? 0),
        deliveredDeliveryFees: Number(deliveredOrders?._sum.deliveryFee ?? 0),
      },
      driverPayouts: {
        period: {
          count: driverEarnings._count,
          grossAmount: Number(driverEarnings._sum.grossAmount ?? 0),
          netAmount: Number(driverEarnings._sum.netAmount ?? 0),
        },
        pendingPayouts: {
          count: pendingPayouts._count,
          amount: Number(pendingPayouts._sum.netAmount ?? 0),
        },
      },
    };
  }

  async getDriverEarnings(
    driverId: string,
    query: { from?: string; to?: string; page?: number; limit?: number },
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 20);
    const skip = (page - 1) * limit;
    const from = query.from
      ? new Date(query.from)
      : new Date(Date.now() - 30 * 86400000);
    const to = query.to ? new Date(query.to) : new Date();

    const [earnings, total, summary] = await Promise.all([
      this.prisma.driverEarning.findMany({
        where: { driverId, createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.driverEarning.count({
        where: { driverId, createdAt: { gte: from, lte: to } },
      }),
      this.prisma.driverEarning.aggregate({
        where: { driverId, createdAt: { gte: from, lte: to } },
        _sum: { grossAmount: true, netAmount: true },
      }),
    ]);

    return {
      driverId,
      period: { from, to },
      summary: {
        count: total,
        grossAmount: Number(summary._sum.grossAmount ?? 0),
        netAmount: Number(summary._sum.netAmount ?? 0),
      },
      data: earnings.map((e) => ({
        id: e.id,
        deliveryId: e.deliveryId,
        grossAmount: Number(e.grossAmount),
        netAmount: Number(e.netAmount),
        payoutStatus: e.payoutStatus,
        createdAt: e.createdAt,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async markDriverPaid(earningIds: string[]) {
    const result = await this.prisma.driverEarning.updateMany({
      where: { id: { in: earningIds }, payoutStatus: 'PENDING' },
      data: { payoutStatus: 'PAID' },
    });
    return { updated: result.count };
  }

  // ─── Platform Settings ────────────────────────────────────────────────────

  async getSettings() {
    const settings = await this.prisma.platformSetting.findMany({
      orderBy: { key: 'asc' },
    });
    return settings.map((s) => ({
      key: s.key,
      value: s.dataType === 'number' ? Number(s.value) : s.value,
      dataType: s.dataType,
    }));
  }

  async updateSetting(key: string, value: string) {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key },
    });
    if (!setting) throw new NotFoundException(`Setting '${key}' not found`);

    if (setting.dataType === 'number' && isNaN(Number(value))) {
      throw new BadRequestException(`Setting '${key}' must be a number`);
    }

    await this.prisma.platformSetting.update({
      where: { key },
      data: { value },
    });
    await this.finance.reloadSettings();

    return {
      key,
      value: setting.dataType === 'number' ? Number(value) : value,
    };
  }
}
