/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { FinanceService } from '../finance/finance.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { DeliveryStatus } from '@prisma/client';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly finance: FinanceService,
    private readonly dispatch: DispatchService,
    @Optional() private readonly realtime?: RealtimeGateway,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  // ─── Update driver location ───────────────────────────────────────────────

  async updateLocation(userId: string, dto: UpdateLocationDto): Promise<void> {
    const driver = await this.getDriverProfile(userId);

    // Update Redis (live — TTL 2 minutes)
    await this.redis.setDriverLocation(driver.id, dto.latitude, dto.longitude);

    // Persist to DB for history/audit (7-day retention)
    await this.prisma.driverLocation.create({
      data: {
        driverId: driver.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        heading: dto.heading,
        speed: dto.speed,
      },
    });
  }

  // ─── Get active offer ─────────────────────────────────────────────────────

  async getActiveOffer(userId: string) {
    const driver = await this.getDriverProfile(userId);
    return this.dispatch.getActiveOfferForDriver(driver.id);
  }

  // ─── Accept offer ─────────────────────────────────────────────────────────

  async acceptOffer(userId: string, offerId: string) {
    const driver = await this.getDriverProfile(userId);

    try {
      const result = await this.dispatch.acceptOffer(offerId, driver.id);
      this.emitOrderStatus(result.orderId, 'DRIVER_ASSIGNED');
      await this.notifyOrderCustomer(
        result.orderId,
        'السائق في الطريق 🛵',
        'تم تعيين سائق لطلبك وهو في طريقه للمطعم',
        { orderId: result.orderId, type: 'DRIVER_ASSIGNED' },
      );
      return result;
    } catch (err: any) {
      if (err.message === 'DELIVERY_ALREADY_ASSIGNED') {
        throw new ForbiddenException('DELIVERY_ALREADY_ASSIGNED');
      }
      if (err.message === 'OFFER_EXPIRED') {
        throw new BadRequestException('OFFER_EXPIRED');
      }
      if (err.message === 'DRIVER_ALREADY_ON_DELIVERY') {
        throw new BadRequestException('DRIVER_ALREADY_ON_DELIVERY');
      }
      throw err;
    }
  }

  // ─── Decline offer ────────────────────────────────────────────────────────

  async declineOffer(userId: string, offerId: string, reason?: string) {
    const driver = await this.getDriverProfile(userId);
    await this.dispatch.declineOffer(offerId, driver.id, reason);
    return { message: 'Offer declined' };
  }

  // ─── Get active delivery ──────────────────────────────────────────────────

  async getActiveDelivery(userId: string) {
    const driver = await this.getDriverProfile(userId);

    const delivery = await this.prisma.delivery.findFirst({
      where: {
        driverId: driver.id,
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
            items: { select: { productNameSnapshot: true, quantity: true } },
          },
        },
      },
    });

    if (!delivery) throw new NotFoundException('RESOURCE_NOT_FOUND');

    // Customer full address only revealed after pickup
    const revealFullAddress = [
      'PICKED_UP',
      'ON_THE_WAY',
      'ARRIVED_CUSTOMER',
    ].includes(delivery.status);

    const addressSnapshot = delivery.order.addressSnapshot as any;

    return {
      deliveryId: delivery.id,
      orderId: delivery.order.id,
      status: delivery.status,
      restaurant: delivery.order.restaurant,
      customerDeliveryDistrict: addressSnapshot?.district ?? null,
      customerFullAddress: revealFullAddress ? addressSnapshot : null,
      orderItems: delivery.order.items,
      totalAmount: Number(delivery.order.total),
      paymentMethod: delivery.order.paymentMethod,
      estimatedEarnings: this.finance.getNumberSetting(
        'driver_delivery_amount',
        15,
      ),
    };
  }

  // ─── Delivery status transitions ──────────────────────────────────────────

  async markArrivedRestaurant(userId: string, deliveryId: string) {
    return this.updateDeliveryStatus(
      userId,
      deliveryId,
      'DRIVER_ARRIVED_RESTAURANT',
      {
        arrivedRestaurantAt: new Date(),
      },
      'DRIVER_ARRIVED_RESTAURANT',
    );
  }

  async markPickedUp(userId: string, deliveryId: string) {
    return this.updateDeliveryStatus(
      userId,
      deliveryId,
      'PICKED_UP',
      {
        pickedUpAt: new Date(),
      },
      'PICKED_UP',
    );
  }

  async markArrivedCustomer(userId: string, deliveryId: string) {
    return this.updateDeliveryStatus(
      userId,
      deliveryId,
      'ARRIVED_CUSTOMER',
      {
        arrivedCustomerAt: new Date(),
      },
      'ARRIVED_CUSTOMER',
    );
  }

  async markDelivered(userId: string, deliveryId: string) {
    const driver = await this.getDriverProfile(userId);
    const delivery = await this.findOwnedDelivery(driver.id, deliveryId);

    const allowedStatuses: DeliveryStatus[] = [
      'ARRIVED_CUSTOMER',
      'ON_THE_WAY',
    ];
    if (!allowedStatuses.includes(delivery.status)) {
      throw new BadRequestException('ORDER_INVALID_STATUS');
    }

    await this.prisma.$transaction([
      this.prisma.delivery.update({
        where: { id: deliveryId },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      }),
      this.prisma.order.update({
        where: { id: delivery.orderId },
        data: { status: 'DELIVERED' },
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId: delivery.orderId,
          actorType: 'DRIVER',
          fromStatus: delivery.order.status as any,
          toStatus: 'DELIVERED',
        },
      }),
      this.prisma.payment.updateMany({
        where: { orderId: delivery.orderId },
        data: { status: 'COLLECTED', collectedAt: new Date() },
      }),
      this.prisma.driverProfile.update({
        where: { id: driver.id },
        data: {
          availabilityStatus: 'ONLINE',
          totalDeliveries: { increment: 1 },
        },
      }),
    ]);

    // Record driver earnings
    const order = await this.prisma.order.findFirst({
      where: { id: delivery.orderId },
    });
    if (order) {
      await this.finance.recordDriverEarning(
        deliveryId,
        driver.id,
        order.paymentMethod === 'CARD' ? 'CARD' : 'CASH_ON_DELIVERY',
        Number(order.deliveryFee),
      );
    }

    // Get earning details for response
    const earning = await this.prisma.driverEarning.findFirst({
      where: { deliveryId },
    });

    this.emitOrderStatus(delivery.orderId, 'DELIVERED');
    await this.notifyOrderCustomer(
      delivery.orderId,
      'تم توصيل طلبك 🎉',
      'استمتع بوجبتك! شكراً لاستخدامك خدمتنا',
      { orderId: delivery.orderId, type: 'DELIVERED' },
    );

    return {
      deliveryId,
      status: 'DELIVERED',
      earnings: earning
        ? {
            grossAmount: Number(earning.grossAmount),
            commissionDeducted: Number(earning.commissionDeducted),
            netAmount: Number(earning.netAmount),
          }
        : null,
      deliveredAt: new Date(),
    };
  }

  // ─── Delivery history ─────────────────────────────────────────────────────

  async getDeliveryHistory(
    userId: string,
    query: { page?: number; limit?: number },
  ) {
    const driver = await this.getDriverProfile(userId);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 20);
    const skip = (page - 1) * limit;

    const [deliveries, total] = await Promise.all([
      this.prisma.delivery.findMany({
        where: { driverId: driver.id, status: 'DELIVERED' },
        include: {
          order: { include: { restaurant: { select: { name: true } } } },
          earning: true,
        },
        orderBy: { deliveredAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.delivery.count({
        where: { driverId: driver.id, status: 'DELIVERED' },
      }),
    ]);

    return {
      data: deliveries.map((d) => ({
        deliveryId: d.id,
        orderId: d.orderId,
        restaurantName: d.order.restaurant.name,
        status: d.status,
        netEarnings: d.earning ? Number(d.earning.netAmount) : 0,
        deliveredAt: d.deliveredAt,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private emitOrderStatus(orderId: string, status: string, extra?: object) {
    this.realtime?.emitToOrder(orderId, 'order_status_changed', {
      orderId,
      status,
      ...extra,
      timestamp: new Date().toISOString(),
    });
  }

  private async notifyOrderCustomer(
    orderId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: { include: { user: { select: { id: true } } } } },
    });
    if (order?.customer?.user?.id) {
      await this.notifications
        ?.sendToUser(order.customer.user.id, { title, body, data })
        .catch(() => {});
    }
  }

  private async getDriverProfile(userId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!driver) throw new NotFoundException('RESOURCE_NOT_FOUND');
    return driver;
  }

  private async findOwnedDelivery(driverProfileId: string, deliveryId: string) {
    const delivery = await this.prisma.delivery.findFirst({
      where: { id: deliveryId, driverId: driverProfileId },
      include: { order: true },
    });
    if (!delivery) throw new ForbiddenException('FORBIDDEN_ROLE');
    return delivery;
  }

  // Valid delivery status transitions — prevents out-of-order updates
  private static readonly DELIVERY_TRANSITIONS: Record<
    DeliveryStatus,
    DeliveryStatus[]
  > = {
    PENDING: ['DRIVER_ASSIGNED'],
    DRIVER_ASSIGNED: [
      'DRIVER_HEADING_TO_RESTAURANT',
      'DRIVER_ARRIVED_RESTAURANT',
    ],
    DRIVER_HEADING_TO_RESTAURANT: ['DRIVER_ARRIVED_RESTAURANT'],
    DRIVER_ARRIVED_RESTAURANT: ['PICKED_UP'],
    PICKED_UP: ['ON_THE_WAY'],
    ON_THE_WAY: ['ARRIVED_CUSTOMER', 'DELIVERED'],
    ARRIVED_CUSTOMER: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: [],
  };

  private assertDeliveryTransition(
    current: DeliveryStatus,
    next: DeliveryStatus,
  ): void {
    const allowed = DeliveryService.DELIVERY_TRANSITIONS[current] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException('ORDER_INVALID_STATUS');
    }
  }

  private async updateDeliveryStatus(
    userId: string,
    deliveryId: string,
    newStatus: DeliveryStatus,
    deliveryData: any,
    orderStatus: any,
  ) {
    const driver = await this.getDriverProfile(userId);
    const delivery = await this.findOwnedDelivery(driver.id, deliveryId);

    this.assertDeliveryTransition(delivery.status, newStatus);

    await this.prisma.$transaction([
      this.prisma.delivery.update({
        where: { id: deliveryId },
        data: { status: newStatus, ...deliveryData },
      }),
      this.prisma.order.update({
        where: { id: delivery.orderId },
        data: { status: orderStatus },
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId: delivery.orderId,
          actorType: 'DRIVER',
          fromStatus: delivery.order.status as any,
          toStatus: orderStatus,
        },
      }),
    ]);

    this.emitOrderStatus(delivery.orderId, newStatus);
    return { deliveryId, status: newStatus };
  }
}
