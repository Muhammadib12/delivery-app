/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { FinanceService } from '../finance/finance.service';
import { assertValidTransition } from './order-status.machine';
import { CreateOrderDto } from './dto/create-order.dto';
import { AcceptOrderDto } from './dto/accept-order.dto';
import { RejectOrderDto } from './dto/reject-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { OrderStatus } from '@prisma/client';
import { DispatchService } from '../dispatch/dispatch.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly finance: FinanceService,
    private readonly dispatch: DispatchService,
    @Optional() private readonly realtime?: RealtimeGateway,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  // ─── Create Order ─────────────────────────────────────────────────────────

  async createOrder(
    customerId: string,
    dto: CreateOrderDto,
    idempotencyKey: string,
  ) {
    // Idempotency check
    const existing = await this.redis.getIdempotencyKey(idempotencyKey);
    if (existing) return this.getOrderDetail(existing, customerId);

    const { restaurantId, items } = dto.cartSnapshot;

    // Validate restaurant
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
    });
    if (!restaurant) throw new NotFoundException('RESOURCE_NOT_FOUND');
    if (restaurant.status !== 'OPEN' && restaurant.status !== 'BUSY') {
      throw new BadRequestException('RESTAURANT_CLOSED');
    }
    if (!items || items.length === 0)
      throw new BadRequestException('CART_EMPTY');

    // Validate address
    const customerProfile = await this.prisma.customerProfile.findUnique({
      where: { userId: customerId },
    });
    if (!customerProfile) throw new NotFoundException('RESOURCE_NOT_FOUND');

    const address = await this.prisma.customerAddress.findFirst({
      where: {
        id: dto.addressId,
        customerId: customerProfile.id,
        deletedAt: null,
      },
    });
    if (!address) throw new NotFoundException('RESOURCE_NOT_FOUND');

    // Validate products and calculate subtotal
    let subtotal = 0;
    const orderItemsData: Array<{
      productId: string;
      productNameSnapshot: string;
      unitPriceSnapshot: number;
      quantity: number;
      lineTotal: number;
      notes?: string;
      modifiers: Array<{
        modifierNameSnapshot: string;
        optionNameSnapshot: string;
        priceAdjustmentSnapshot: number;
      }>;
    }> = [];

    for (const item of items) {
      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, restaurantId, deletedAt: null },
        include: { modifiers: { include: { options: true } } },
      });
      if (!product) throw new NotFoundException('RESOURCE_NOT_FOUND');
      if (!product.isAvailable)
        throw new BadRequestException('PRODUCT_UNAVAILABLE');

      let itemPrice = Number(product.price);
      const modifierSnapshots: Array<{
        modifierNameSnapshot: string;
        optionNameSnapshot: string;
        priceAdjustmentSnapshot: number;
      }> = [];

      if (item.selectedModifiers) {
        for (const sel of item.selectedModifiers) {
          const modifier = product.modifiers.find(
            (m) => m.id === sel.modifierId,
          );
          const option = modifier?.options.find((o) => o.id === sel.optionId);
          if (modifier && option) {
            itemPrice += Number(option.priceAdjustment);
            modifierSnapshots.push({
              modifierNameSnapshot: modifier.name,
              optionNameSnapshot: option.name,
              priceAdjustmentSnapshot: Number(option.priceAdjustment),
            });
          }
        }
      }

      const lineTotal = itemPrice * item.quantity;
      subtotal += lineTotal;
      orderItemsData.push({
        productId: item.productId,
        productNameSnapshot: product.name,
        unitPriceSnapshot: itemPrice,
        quantity: item.quantity,
        lineTotal,
        notes: item.notes,
        modifiers: modifierSnapshots,
      });
    }

    if (subtotal < Number(restaurant.minOrderAmount)) {
      throw new BadRequestException('MIN_ORDER_NOT_MET');
    }

    // ─── حساب الأرقام المالية الكاملة ─────────────────────────────────────
    const financials = await this.finance.calculateOrderFinancials(
      restaurantId,
      subtotal,
      dto.paymentMethod,
      restaurant.deliveryFeeOverride
        ? Number(restaurant.deliveryFeeOverride)
        : null,
    );

    const addressSnapshot = {
      street: address.street,
      city: address.city,
      district: address.district,
      landmark: address.landmark,
      latitude: Number(address.latitude),
      longitude: Number(address.longitude),
    };

    const autoRejectMinutes = this.finance.getNumberSetting(
      'auto_reject_minutes',
      3,
    );

    // ─── Create order in transaction ───────────────────────────────────────
    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          customerId: customerProfile.id,
          restaurantId,
          addressId: address.id,
          addressSnapshot,
          status: 'PENDING_RESTAURANT',
          subtotal: financials.subtotal,
          deliveryFee: financials.deliveryFee,
          total: financials.total,
          paymentMethod: dto.paymentMethod,
          deliveryNotes: dto.deliveryNotes,
          idempotencyKey,
          autoRejectAt: new Date(Date.now() + autoRejectMinutes * 60 * 1000),
          items: {
            create: orderItemsData.map((item) => ({
              productId: item.productId,
              productNameSnapshot: item.productNameSnapshot,
              unitPriceSnapshot: item.unitPriceSnapshot,
              quantity: item.quantity,
              lineTotal: item.lineTotal,
              notes: item.notes,
              modifiers: { create: item.modifiers },
            })),
          },
        },
        include: {
          items: { include: { modifiers: true } },
          restaurant: { select: { id: true, name: true, logoUrl: true } },
        },
      });

      // Payment record
      await tx.payment.create({
        data: {
          orderId: newOrder.id,
          method: dto.paymentMethod,
          status: 'PENDING',
          amount: financials.total,
        },
      });

      // Status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: newOrder.id,
          actorType: 'SYSTEM',
          fromStatus: null,
          toStatus: 'PENDING_RESTAURANT',
        },
      });

      return newOrder;
    });

    await this.redis.setIdempotencyKey(idempotencyKey, order.id);

    // Notify restaurant owners/staff about new order
    const restaurantStaff = await this.prisma.restaurantStaff.findMany({
      where: { restaurantId, isActive: true },
      select: { userId: true },
    });
    for (const staff of restaurantStaff) {
      await this.notifyUser(
        staff.userId,
        'طلب جديد 🔔',
        `وصل طلب جديد بقيمة ${financials.total}₪`,
        { orderId: order.id, type: 'NEW_ORDER' },
      );
    }

    return {
      ...this.formatOrder(order),
      financials: {
        subtotal: financials.subtotal,
        deliveryFee: financials.deliveryFee,
        total: financials.total,
        commissionRate: financials.commissionRate,
        // لا نكشف commissionAmount للزبون — للأدمن فقط
      },
    };
  }

  // ─── Get Active Order ─────────────────────────────────────────────────────

  async getActiveOrder(customerId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId: customerId },
    });
    if (!profile) throw new NotFoundException('RESOURCE_NOT_FOUND');

    const activeStatuses: OrderStatus[] = [
      'PENDING_RESTAURANT',
      'ACCEPTED_BY_RESTAURANT',
      'PREPARING',
      'LOOKING_FOR_DRIVER',
      'DRIVER_OFFERED',
      'DRIVER_ASSIGNED',
      'DRIVER_ARRIVED_RESTAURANT',
      'PICKED_UP',
      'ON_THE_WAY',
      'ARRIVED_CUSTOMER',
    ];

    const order = await this.prisma.order.findFirst({
      where: {
        customerId: profile.id,
        status: { in: activeStatuses },
        deletedAt: null,
      },
      include: {
        items: { include: { modifiers: true } },
        restaurant: { select: { id: true, name: true, logoUrl: true } },
        delivery: { include: { driver: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!order) throw new NotFoundException('RESOURCE_NOT_FOUND');
    return this.formatOrder(order);
  }

  // ─── Order Tracking ───────────────────────────────────────────────────────

  async getOrderTracking(orderId: string, customerId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId: customerId },
    });

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: profile?.id, deletedAt: null },
      include: {
        statusHistory: { orderBy: { createdAt: 'asc' } },
        delivery: {
          include: {
            driver: { include: { user: { select: { phone: true } } } },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('RESOURCE_NOT_FOUND');

    let driverLocation = null;
    if (order.delivery?.driver) {
      driverLocation = await this.redis.getDriverLocation(
        order.delivery.driver.id,
      );
    }

    return {
      orderId: order.id,
      status: order.status,
      statusHistory: order.statusHistory.map((h) => ({
        status: h.toStatus,
        timestamp: h.createdAt,
      })),
      driver: order.delivery?.driver
        ? {
            id: order.delivery.driver.id,
            displayName: order.delivery.driver.displayName,
            phone: order.delivery.driver.user.phone,
            vehicleType: order.delivery.driver.vehicleType,
            vehiclePlate: order.delivery.driver.vehiclePlate,
            rating: Number(order.delivery.driver.rating),
            currentLocation: driverLocation,
          }
        : null,
    };
  }

  // ─── Order History ────────────────────────────────────────────────────────

  async getOrderHistory(
    customerId: string,
    query: { status?: string; page?: number; limit?: number },
  ) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId: customerId },
    });
    if (!profile) throw new NotFoundException('RESOURCE_NOT_FOUND');

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: any = { customerId: profile.id, deletedAt: null };
    if (query.status) where.status = query.status;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          restaurant: { select: { id: true, name: true, logoUrl: true } },
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
        restaurant: o.restaurant,
        total: Number(o.total),
        itemCount: o._count.items,
        createdAt: o.createdAt,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Get Order Detail ─────────────────────────────────────────────────────

  async getOrderDetail(orderId: string, customerId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId: customerId },
    });

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: profile?.id, deletedAt: null },
      include: {
        items: { include: { modifiers: true } },
        restaurant: { select: { id: true, name: true, logoUrl: true } },
        delivery: true,
        payment: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) throw new NotFoundException('RESOURCE_NOT_FOUND');
    return this.formatOrder(order);
  }

  // ─── Cancel Order ─────────────────────────────────────────────────────────

  async cancelOrder(
    orderId: string,
    customerId: string,
    role: string,
    dto: CancelOrderDto,
  ) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId: customerId },
    });
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: profile?.id, deletedAt: null },
    });
    if (!order) throw new NotFoundException('RESOURCE_NOT_FOUND');

    assertValidTransition(order.status, 'CANCELLED', role);

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId,
          actorType: 'CUSTOMER',
          fromStatus: order.status,
          toStatus: 'CANCELLED',
          note: dto.reason,
        },
      }),
      this.prisma.orderCancellation.create({
        data: {
          orderId,
          cancelledBy: customerId,
          actorType: 'CUSTOMER',
          reason: dto.reason,
        },
      }),
    ]);

    this.emitOrderStatus(orderId, 'CANCELLED');
    return { message: 'Order cancelled', orderId };
  }

  // ─── Restaurant: List Orders ──────────────────────────────────────────────

  async getRestaurantOrders(
    restaurantId: string,
    query: { status?: string; page?: number; limit?: number },
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: any = { restaurantId, deletedAt: null };
    if (query.status) {
      const statuses = query.status.split(',') as OrderStatus[];
      where.status = { in: statuses };
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: { include: { modifiers: true } },
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
        subtotal: Number(o.subtotal),
        deliveryFee: Number(o.deliveryFee),
        total: Number(o.total),
        paymentMethod: o.paymentMethod,
        deliveryNotes: o.deliveryNotes,
        addressSnapshot: o.addressSnapshot,
        estimatedPrepMinutes: o.estimatedPrepMinutes,
        createdAt: o.createdAt,
        itemCount: o._count.items,
        items: o.items,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Restaurant: Accept Order ─────────────────────────────────────────────

  async acceptOrder(
    orderId: string,
    restaurantId: string,
    role: string,
    dto: AcceptOrderDto,
  ) {
    const order = await this.findRestaurantOrder(orderId, restaurantId);
    assertValidTransition(order.status, 'ACCEPTED_BY_RESTAURANT', role);

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'ACCEPTED_BY_RESTAURANT',
          estimatedPrepMinutes: dto.estimatedPrepMinutes,
        },
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId,
          actorType: 'RESTAURANT',
          fromStatus: order.status,
          toStatus: 'ACCEPTED_BY_RESTAURANT',
        },
      }),
    ]);

    this.emitOrderStatus(orderId, 'ACCEPTED_BY_RESTAURANT', {
      estimatedPrepMinutes: dto.estimatedPrepMinutes,
    });
    await this.notifyOrderCustomer(
      orderId,
      'تم قبول طلبك ✅',
      `المطعم قبل طلبك وسيجهزه خلال ${dto.estimatedPrepMinutes} دقيقة`,
      { orderId, type: 'ORDER_ACCEPTED' },
    );
    return {
      orderId,
      status: 'ACCEPTED_BY_RESTAURANT',
      estimatedPrepMinutes: dto.estimatedPrepMinutes,
    };
  }

  // ─── Restaurant: Reject Order ─────────────────────────────────────────────

  async rejectOrder(
    orderId: string,
    restaurantId: string,
    role: string,
    dto: RejectOrderDto,
  ) {
    const order = await this.findRestaurantOrder(orderId, restaurantId);
    assertValidTransition(order.status, 'REJECTED_BY_RESTAURANT', role);

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'REJECTED_BY_RESTAURANT' },
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId,
          actorType: 'RESTAURANT',
          fromStatus: order.status,
          toStatus: 'REJECTED_BY_RESTAURANT',
          note: dto.reason,
        },
      }),
    ]);

    this.emitOrderStatus(orderId, 'REJECTED_BY_RESTAURANT', {
      reason: dto.reason,
    });
    await this.notifyOrderCustomer(
      orderId,
      'تم رفض طلبك ❌',
      'عذراً، المطعم غير قادر على تلبية طلبك الآن',
      { orderId, type: 'ORDER_REJECTED' },
    );
    return { orderId, status: 'REJECTED_BY_RESTAURANT', reason: dto.reason };
  }

  // ─── Restaurant: Mark Preparing ───────────────────────────────────────────

  async markPreparing(orderId: string, restaurantId: string, role: string) {
    const order = await this.findRestaurantOrder(orderId, restaurantId);
    assertValidTransition(order.status, 'PREPARING', role);

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'PREPARING' },
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId,
          actorType: 'RESTAURANT',
          fromStatus: order.status,
          toStatus: 'PREPARING',
        },
      }),
    ]);

    this.emitOrderStatus(orderId, 'PREPARING');
    return { orderId, status: 'PREPARING' };
  }

  // ─── Restaurant: Request Driver ───────────────────────────────────────────

  async requestDriver(orderId: string, restaurantId: string, role: string) {
    const order = await this.findRestaurantOrder(orderId, restaurantId);
    assertValidTransition(order.status, 'LOOKING_FOR_DRIVER', role);

    const delivery = await this.prisma.delivery.findFirst({
      where: { orderId },
    });

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'LOOKING_FOR_DRIVER' },
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId,
          actorType: 'RESTAURANT',
          fromStatus: order.status,
          toStatus: 'LOOKING_FOR_DRIVER',
        },
      }),
      ...(delivery
        ? []
        : [
            this.prisma.delivery.create({
              data: { orderId, status: 'PENDING' },
            }),
          ]),
    ]);

    // Trigger dispatch algorithm asynchronously (fire-and-forget)
    setImmediate(() => {
      void this.dispatch.dispatchOrder(orderId);
    });

    this.emitOrderStatus(orderId, 'LOOKING_FOR_DRIVER');
    return { orderId, status: 'LOOKING_FOR_DRIVER' };
  }

  // ─── Driver: Mark Delivered ───────────────────────────────────────────────
  // يُستدعى من DeliveryModule — هنا لأن المنطق المالي مرتبط بالأوردر

  async markDelivered(orderId: string, driverId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: { delivery: true, payment: true },
    });
    if (!order) throw new NotFoundException('RESOURCE_NOT_FOUND');

    assertValidTransition(order.status, 'DELIVERED', 'DRIVER');

    await this.prisma.$transaction(async (tx) => {
      // تحديث حالة الأوردر
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'DELIVERED' },
      });

      // تحديث حالة التوصيل
      if (order.delivery) {
        await tx.delivery.update({
          where: { id: order.delivery.id },
          data: { status: 'DELIVERED', deliveredAt: new Date() },
        });
      }

      // تحديث حالة الدفع — نقدي: مُحصَّل
      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: {
            status: 'COLLECTED',
            collectedAt: new Date(),
          },
        });
      }

      // تسجيل التاريخ
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          actorType: 'DRIVER',
          fromStatus: order.status,
          toStatus: 'DELIVERED',
        },
      });
    });

    // ─── تسجيل أرباح السائق ───────────────────────────────────────────────
    if (order.delivery) {
      await this.finance.recordDriverEarning(
        order.delivery.id,
        driverId,
        order.paymentMethod === 'CARD' ? 'CARD' : 'CASH_ON_DELIVERY',
        Number(order.deliveryFee),
      );

      // تحديث عداد توصيلات السائق
      await this.prisma.driverProfile.update({
        where: { id: driverId },
        data: { totalDeliveries: { increment: 1 } },
      });
    }

    this.emitOrderStatus(orderId, 'DELIVERED');
    return { orderId, status: 'DELIVERED' };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async findRestaurantOrder(orderId: string, restaurantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId, deletedAt: null },
    });
    if (!order) throw new NotFoundException('RESOURCE_NOT_FOUND');
    return order;
  }

  private emitOrderStatus(orderId: string, status: string, extra?: object) {
    this.realtime?.emitToOrder(orderId, 'order_status_changed', {
      orderId,
      status,
      ...extra,
      timestamp: new Date().toISOString(),
    });
  }

  private async notifyUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    await this.notifications
      ?.sendToUser(userId, { title, body, data })
      .catch(() => {});
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
      await this.notifyUser(order.customer.user.id, title, body, data);
    }
  }

  private formatOrder(order: any) {
    return {
      id: order.id,
      status: order.status,
      restaurant: order.restaurant,
      items: order.items?.map((i: any) => ({
        id: i.id,
        productId: i.productId,
        productName: i.productNameSnapshot,
        unitPrice: Number(i.unitPriceSnapshot),
        quantity: i.quantity,
        lineTotal: Number(i.lineTotal),
        notes: i.notes,
        modifiers: i.modifiers ?? [],
      })),
      addressSnapshot: order.addressSnapshot,
      subtotal: Number(order.subtotal),
      deliveryFee: Number(order.deliveryFee),
      total: Number(order.total),
      paymentMethod: order.paymentMethod,
      deliveryNotes: order.deliveryNotes,
      estimatedPrepMinutes: order.estimatedPrepMinutes,
      createdAt: order.createdAt,
    };
  }
}
