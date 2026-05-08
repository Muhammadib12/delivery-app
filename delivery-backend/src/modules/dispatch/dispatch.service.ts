/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { FinanceService } from '../finance/finance.service';
import { haversineDistance } from '../../common/utils/haversine';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly finance: FinanceService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  // ─── Main dispatch entry point ────────────────────────────────────────────
  // Called when restaurant presses "Request Driver"

  async dispatchOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: { restaurant: true },
    });

    if (!order || order.status !== 'LOOKING_FOR_DRIVER') return;
    if (!order.restaurant.latitude || !order.restaurant.longitude) {
      await this.failOrder(orderId, 'Restaurant has no location set');
      return;
    }

    const initialRadius = this.finance.getNumberSetting(
      'dispatch_radius_km',
      5,
    );
    const expandBy = this.finance.getNumberSetting(
      'dispatch_radius_expand_km',
      2,
    );
    const maxRadius = initialRadius + expandBy * 3; // max 3 expansions

    let radius = initialRadius;
    let offered = false;

    while (radius <= maxRadius && !offered) {
      const driver = await this.findNearestDriver(
        Number(order.restaurant.latitude),
        Number(order.restaurant.longitude),
        radius,
        orderId,
      );

      if (driver) {
        await this.offerToDriver(orderId, driver.driverId, driver.distanceKm);
        offered = true;
      } else {
        this.logger.log(
          `No driver within ${radius}km for order ${orderId} — expanding`,
        );
        radius += expandBy;
      }
    }

    if (!offered) {
      await this.failOrder(orderId, 'No available drivers found');
    }
  }

  // ─── Find nearest available driver ───────────────────────────────────────

  private async findNearestDriver(
    restaurantLat: number,
    restaurantLng: number,
    radiusKm: number,
    orderId: string,
  ): Promise<{ driverId: string; distanceKm: number } | null> {
    // Get all ONLINE APPROVED drivers not currently on a delivery
    const candidates = await this.prisma.driverProfile.findMany({
      where: {
        availabilityStatus: 'ONLINE',
        verificationStatus: 'APPROVED',
        deliveries: {
          none: {
            status: {
              in: [
                'DRIVER_ASSIGNED',
                'DRIVER_HEADING_TO_RESTAURANT',
                'DRIVER_ARRIVED_RESTAURANT',
                'PICKED_UP',
                'ON_THE_WAY',
                'ARRIVED_CUSTOMER',
              ],
            },
          },
        },
        // Exclude drivers already offered this order
        offers: { none: { deliveryId: orderId } },
      },
      select: { id: true },
    });

    if (candidates.length === 0) return null;

    // Get locations from Redis and calculate distances
    const withDistance: Array<{ driverId: string; distanceKm: number }> = [];

    for (const driver of candidates) {
      const location = await this.redis.getDriverLocation(driver.id);
      if (!location) continue; // driver location stale — skip

      const dist = haversineDistance(
        restaurantLat,
        restaurantLng,
        location.lat,
        location.lng,
      );

      if (dist <= radiusKm) {
        withDistance.push({ driverId: driver.id, distanceKm: dist });
      }
    }

    if (withDistance.length === 0) return null;

    // Sort by distance — nearest first
    withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
    return withDistance[0];
  }

  // ─── Offer delivery to a specific driver ─────────────────────────────────

  async offerToDriver(
    orderId: string,
    driverId: string,
    distanceKm: number,
  ): Promise<void> {
    const timeoutSeconds = this.finance.getNumberSetting(
      'driver_offer_timeout_seconds',
      30,
    );

    // Get or create delivery record
    let delivery = await this.prisma.delivery.findFirst({ where: { orderId } });
    if (!delivery) {
      delivery = await this.prisma.delivery.create({
        data: { orderId, status: 'PENDING' },
      });
    }

    const expiresAt = new Date(Date.now() + timeoutSeconds * 1000);

    // Create offer record
    const offer = await this.prisma.driverOffer.create({
      data: {
        deliveryId: delivery.id,
        driverId,
        status: 'PENDING',
        expiresAt,
      },
    });

    // Update order status to DRIVER_OFFERED
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'DRIVER_OFFERED' },
    });

    await this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        actorType: 'SYSTEM',
        fromStatus: 'LOOKING_FOR_DRIVER',
        toStatus: 'DRIVER_OFFERED',
        note: `Offered to driver ${driverId} (${distanceKm.toFixed(1)}km away)`,
      },
    });

    this.logger.log(
      `Offer ${offer.id} sent to driver ${driverId} for order ${orderId}`,
    );

    // Notify driver about new delivery offer
    const driverUser = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      select: { userId: true },
    });
    if (driverUser?.userId) {
      const earnings = this.finance.getNumberSetting(
        'driver_delivery_amount',
        15,
      );
      await this.notifications
        ?.sendToUser(driverUser.userId, {
          title: 'طلب توصيل جديد 🛵',
          body: `عرض توصيل بقيمة ${earnings}₪ — لديك ${timeoutSeconds} ثانية للقبول`,
          data: { offerId: offer.id, type: 'DELIVERY_OFFER' },
        })
        .catch(() => {});
    }

    // Schedule timeout — try next driver after timeout (fire-and-forget)
    setTimeout(() => {
      void this.handleOfferTimeout(offer.id, orderId);
    }, timeoutSeconds * 1000);
  }

  // ─── Driver accepts offer ─────────────────────────────────────────────────

  async acceptOffer(
    offerId: string,
    driverProfileId: string,
  ): Promise<{
    deliveryId: string;
    orderId: string;
    restaurant: any;
    orderItems: any[];
    estimatedEarnings: number;
  }> {
    // Redis atomic lock — prevents race condition if 2 drivers accept simultaneously
    const lockKey = `dispatch:lock:offer:${offerId}`;
    const locked = await this.redis.acquireLock(lockKey, 10);
    if (!locked) {
      throw new Error('DELIVERY_ALREADY_ASSIGNED');
    }

    try {
      const offer = await this.prisma.driverOffer.findFirst({
        where: { id: offerId, driverId: driverProfileId },
        include: {
          delivery: {
            include: {
              order: {
                include: {
                  items: true,
                  restaurant: {
                    select: {
                      id: true,
                      name: true,
                      address: true,
                      latitude: true,
                      longitude: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!offer) throw new Error('OFFER_NOT_FOUND');
      if (offer.status !== 'PENDING')
        throw new Error('DELIVERY_ALREADY_ASSIGNED');
      if (offer.expiresAt < new Date()) throw new Error('OFFER_EXPIRED');

      // Check driver not already on a delivery
      const activeDelivery = await this.prisma.delivery.findFirst({
        where: {
          driverId: driverProfileId,
          status: {
            in: [
              'DRIVER_ASSIGNED',
              'DRIVER_HEADING_TO_RESTAURANT',
              'DRIVER_ARRIVED_RESTAURANT',
              'PICKED_UP',
              'ON_THE_WAY',
              'ARRIVED_CUSTOMER',
            ],
          },
        },
      });
      if (activeDelivery) throw new Error('DRIVER_ALREADY_ON_DELIVERY');

      const { delivery } = offer;
      const { order } = delivery;

      // All good — assign driver
      await this.prisma.$transaction([
        // Accept this offer
        this.prisma.driverOffer.update({
          where: { id: offerId },
          data: { status: 'ACCEPTED', respondedAt: new Date() },
        }),
        // Cancel any other pending offers for same delivery
        this.prisma.driverOffer.updateMany({
          where: {
            deliveryId: delivery.id,
            id: { not: offerId },
            status: 'PENDING',
          },
          data: { status: 'CANCELLED' },
        }),
        // Assign driver to delivery
        this.prisma.delivery.update({
          where: { id: delivery.id },
          data: {
            driverId: driverProfileId,
            status: 'DRIVER_ASSIGNED',
            assignedAt: new Date(),
          },
        }),
        // Update driver status
        this.prisma.driverProfile.update({
          where: { id: driverProfileId },
          data: { availabilityStatus: 'ON_DELIVERY' },
        }),
        // Update order status
        this.prisma.order.update({
          where: { id: order.id },
          data: { status: 'DRIVER_ASSIGNED' },
        }),
        // Log history
        this.prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            actorType: 'DRIVER',
            fromStatus: 'DRIVER_OFFERED',
            toStatus: 'DRIVER_ASSIGNED',
            note: `Driver ${driverProfileId} accepted`,
          },
        }),
      ]);

      const estimatedEarnings = this.finance.getNumberSetting(
        'driver_delivery_amount',
        15,
      );

      return {
        deliveryId: delivery.id,
        orderId: order.id,
        restaurant: order.restaurant,
        orderItems: order.items.map((i: any) => ({
          productName: i.productNameSnapshot,
          quantity: i.quantity,
        })),
        estimatedEarnings,
      };
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }

  // ─── Driver declines offer ────────────────────────────────────────────────

  async declineOffer(
    offerId: string,
    driverProfileId: string,
    _reason?: string,
  ): Promise<void> {
    const offer = await this.prisma.driverOffer.findFirst({
      where: { id: offerId, driverId: driverProfileId, status: 'PENDING' },
      include: { delivery: true },
    });

    if (!offer) return;

    await this.prisma.driverOffer.update({
      where: { id: offerId },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });

    this.logger.log(`Driver ${driverProfileId} declined offer ${offerId}`);

    // Try next driver
    await this.tryNextDriver(offer.delivery.orderId);
  }

  // ─── Handle offer timeout ─────────────────────────────────────────────────

  private async handleOfferTimeout(
    offerId: string,
    orderId: string,
  ): Promise<void> {
    const offer = await this.prisma.driverOffer.findFirst({
      where: { id: offerId, status: 'PENDING' },
    });

    if (!offer) return; // Already accepted or declined

    await this.prisma.driverOffer.update({
      where: { id: offerId },
      data: { status: 'TIMED_OUT' },
    });

    this.logger.log(`Offer ${offerId} timed out — trying next driver`);
    await this.tryNextDriver(orderId);
  }

  // ─── Try next driver after decline/timeout ────────────────────────────────

  private async tryNextDriver(orderId: string): Promise<void> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
      include: { restaurant: true },
    });

    if (
      !order ||
      order.status === 'DRIVER_ASSIGNED' ||
      order.status === 'CANCELLED'
    )
      return;

    // Reset to LOOKING_FOR_DRIVER and try again
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'LOOKING_FOR_DRIVER' },
    });

    // Dispatch again — will skip already-offered drivers
    await this.dispatchOrder(orderId);
  }

  // ─── Fail order when no driver found ─────────────────────────────────────

  private async failOrder(orderId: string, reason: string): Promise<void> {
    this.logger.warn(`Order ${orderId} FAILED: ${reason}`);

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'FAILED' },
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId,
          actorType: 'SYSTEM',
          fromStatus: 'LOOKING_FOR_DRIVER',
          toStatus: 'FAILED',
          note: reason,
        },
      }),
    ]);
  }

  // ─── Get active offer for driver ──────────────────────────────────────────

  async getActiveOfferForDriver(driverProfileId: string) {
    const offer = await this.prisma.driverOffer.findFirst({
      where: {
        driverId: driverProfileId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        delivery: {
          include: {
            order: {
              include: {
                restaurant: {
                  select: {
                    id: true,
                    name: true,
                    address: true,
                    latitude: true,
                    longitude: true,
                  },
                },
                items: {
                  select: { productNameSnapshot: true, quantity: true },
                },
              },
            },
          },
        },
      },
    });

    if (!offer) return null;

    const secondsRemaining = Math.max(
      0,
      Math.floor((offer.expiresAt.getTime() - Date.now()) / 1000),
    );

    return {
      offerId: offer.id,
      deliveryId: offer.delivery.id,
      orderId: offer.delivery.order.id,
      restaurant: offer.delivery.order.restaurant,
      orderItems: offer.delivery.order.items,
      total: Number(offer.delivery.order.total),
      paymentMethod: offer.delivery.order.paymentMethod,
      estimatedEarnings: this.finance.getNumberSetting(
        'driver_delivery_amount',
        15,
      ),
      expiresAt: offer.expiresAt,
      secondsRemaining,
    };
  }
}
