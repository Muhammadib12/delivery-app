/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { haversineDistance } from '../../common/utils/haversine';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Injectable()
export class RestaurantsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Public: List Restaurants ─────────────────────────────────────────────

  async listPublic(query: {
    categoryId?: string;
    status?: string;
    lat?: number;
    lng?: number;
    sort?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.status) where.status = query.status;
    else
      where.status = { in: ['OPEN', 'BUSY', 'CLOSED', 'TEMPORARILY_CLOSED'] };

    const [restaurants, total] = await Promise.all([
      this.prisma.restaurant.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        skip,
        take: limit,
        orderBy: query.sort === 'rating' ? { rating: 'desc' } : { name: 'asc' },
      }),
      this.prisma.restaurant.count({ where }),
    ]);

    const data = restaurants.map((r) => {
      const distanceKm =
        query.lat && query.lng && r.latitude && r.longitude
          ? haversineDistance(
              query.lat,
              query.lng,
              Number(r.latitude),
              Number(r.longitude),
            )
          : null;

      return {
        id: r.id,
        name: r.name,
        description: r.description,
        logoUrl: r.logoUrl,
        bannerUrl: r.bannerUrl,
        category: r.category,
        status: r.status,
        rating: Number(r.rating),
        totalReviews: r.totalReviews,
        minOrderAmount: Number(r.minOrderAmount),
        deliveryFee: r.deliveryFeeOverride
          ? Number(r.deliveryFeeOverride)
          : null,
        avgPrepTimeMinutes: r.avgPrepTimeMinutes,
        distanceKm: distanceKm ? Math.round(distanceKm * 10) / 10 : null,
        isOpen: r.status === 'OPEN' || r.status === 'BUSY',
      };
    });

    if (query.sort === 'distance' && query.lat && query.lng) {
      data.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    }

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Public: Get Restaurant Detail ────────────────────────────────────────

  async getPublicDetail(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        workingHours: { orderBy: { dayOfWeek: 'asc' } },
      },
    });

    if (!restaurant) throw new NotFoundException('RESOURCE_NOT_FOUND');

    return {
      id: restaurant.id,
      name: restaurant.name,
      description: restaurant.description,
      logoUrl: restaurant.logoUrl,
      bannerUrl: restaurant.bannerUrl,
      category: restaurant.category,
      status: restaurant.status,
      rating: Number(restaurant.rating),
      totalReviews: restaurant.totalReviews,
      address: restaurant.address,
      latitude: restaurant.latitude ? Number(restaurant.latitude) : null,
      longitude: restaurant.longitude ? Number(restaurant.longitude) : null,
      minOrderAmount: Number(restaurant.minOrderAmount),
      deliveryFee: restaurant.deliveryFeeOverride
        ? Number(restaurant.deliveryFeeOverride)
        : null,
      avgPrepTimeMinutes: restaurant.avgPrepTimeMinutes,
      workingHours: restaurant.workingHours.map((wh) => ({
        dayOfWeek: wh.dayOfWeek,
        openTime: wh.openTime,
        closeTime: wh.closeTime,
        isClosed: wh.isClosed,
      })),
      isCurrentlyOpen:
        restaurant.status === 'OPEN' || restaurant.status === 'BUSY',
    };
  }

  // ─── Public: Get Categories ───────────────────────────────────────────────

  async getCategories() {
    return this.prisma.restaurantCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, iconUrl: true, sortOrder: true },
    });
  }

  // ─── Public: Search ───────────────────────────────────────────────────────

  async search(q: string, _lat?: number, _lng?: number) {
    if (!q || q.length < 2) return { restaurants: [], products: [] };

    const [restaurants, products] = await Promise.all([
      this.prisma.restaurant.findMany({
        where: {
          deletedAt: null,
          name: { contains: q, mode: 'insensitive' },
        },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          rating: true,
          status: true,
        },
        take: 10,
      }),
      this.prisma.product.findMany({
        where: {
          deletedAt: null,
          isAvailable: true,
          name: { contains: q, mode: 'insensitive' },
        },
        select: {
          id: true,
          name: true,
          price: true,
          isAvailable: true,
          restaurant: { select: { id: true, name: true, status: true } },
        },
        take: 10,
      }),
    ]);

    return {
      restaurants: restaurants.map((r) => ({ ...r, rating: Number(r.rating) })),
      products: products.map((p) => ({ ...p, price: Number(p.price) })),
    };
  }

  // ─── Restaurant Staff: Get own restaurant ─────────────────────────────────

  async getMyRestaurant(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        workingHours: { orderBy: { dayOfWeek: 'asc' } },
        _count: { select: { orders: true } },
      },
    });
    if (!restaurant) throw new NotFoundException('RESOURCE_NOT_FOUND');
    return restaurant;
  }

  async updateMyRestaurant(restaurantId: string, dto: UpdateRestaurantDto) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
    });
    if (!restaurant) throw new NotFoundException('RESOURCE_NOT_FOUND');

    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        name: dto.name,
        description: dto.description,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        minOrderAmount: dto.minOrderAmount,
        deliveryFeeOverride: dto.deliveryFeeOverride,
        avgPrepTimeMinutes: dto.avgPrepTimeMinutes,
      },
    });
  }

  async updateStatus(restaurantId: string, role: string, dto: UpdateStatusDto) {
    if (dto.status === 'TEMPORARILY_CLOSED' && role !== 'RESTAURANT_OWNER') {
      throw new ForbiddenException(
        'Only RESTAURANT_OWNER can set TEMPORARILY_CLOSED',
      );
    }
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { status: dto.status },
      select: { id: true, status: true },
    });
  }

  async getDashboard(restaurantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayOrders, pendingCount, activeStatuses, restaurant] =
      await Promise.all([
        this.prisma.order.findMany({
          where: { restaurantId, createdAt: { gte: today }, deletedAt: null },
          select: { total: true, status: true },
        }),
        this.prisma.order.count({
          where: {
            restaurantId,
            status: 'PENDING_RESTAURANT',
            deletedAt: null,
          },
        }),
        this.prisma.order.count({
          where: {
            restaurantId,
            deletedAt: null,
            status: {
              in: [
                'ACCEPTED_BY_RESTAURANT',
                'PREPARING',
                'LOOKING_FOR_DRIVER',
                'DRIVER_OFFERED',
                'DRIVER_ASSIGNED',
                'DRIVER_ARRIVED_RESTAURANT',
                'PICKED_UP',
                'ON_THE_WAY',
              ],
            },
          },
        }),
        this.prisma.restaurant.findUnique({
          where: { id: restaurantId },
          select: { status: true },
        }),
      ]);

    const todayRevenue = todayOrders
      .filter((o) => o.status === 'DELIVERED')
      .reduce((sum, o) => sum + Number(o.total), 0);

    return {
      todayOrderCount: todayOrders.length,
      todayRevenue,
      pendingOrderCount: pendingCount,
      activeOrderCount: activeStatuses,
      restaurantStatus: restaurant?.status,
    };
  }
}
