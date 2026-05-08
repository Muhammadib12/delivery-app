import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeliveryFeeResult {
  deliveryFee: number; // ما يدفعه الزبون
  driverAmount: number; // ما يحصل عليه السائق
  platformDeliveryFee: number; // ما تحصل عليه المنصة من التوصيل
}

export interface CommissionResult {
  rate: number; // نسبة العمولة %
  commissionAmount: number; // مبلغ العمولة بالشيكل
  restaurantNet: number; // صافي المطعم بعد العمولة
}

export interface OrderFinancials {
  subtotal: number;
  deliveryFee: number;
  total: number;
  commissionRate: number;
  commissionAmount: number;
  restaurantNet: number;
  driverAmount: number;
  platformDeliveryFee: number;
  platformTotal: number; // إجمالي ما تكسبه المنصة
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class FinanceService implements OnModuleInit {
  private readonly logger = new Logger(FinanceService.name);
  private settings: Record<string, string> = {};

  constructor(private readonly prisma: PrismaService) {}

  // تُحمَّل الإعدادات عند بدء التطبيق وتُخزَّن في الذاكرة للسرعة
  async onModuleInit(): Promise<void> {
    await this.loadSettings();
    this.logger.log('Finance settings loaded');
  }

  async loadSettings(): Promise<void> {
    const rows = await this.prisma.platformSetting.findMany();
    this.settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async reloadSettings(): Promise<void> {
    await this.loadSettings();
  }

  // ─── إعدادات المنصة ───────────────────────────────────────────────────────

  getSetting(key: string, fallback: string): string {
    return this.settings[key] ?? fallback;
  }

  getNumberSetting(key: string, fallback: number): number {
    const val = this.settings[key];
    return val !== undefined ? parseFloat(val) : fallback;
  }

  // ─── رسوم التوصيل ─────────────────────────────────────────────────────────

  calculateDeliveryFee(
    paymentMethod: 'CASH_ON_DELIVERY' | 'CARD',
    restaurantOverride?: number | null,
  ): DeliveryFeeResult {
    // لو المطعم حدد رسوم خاصة تُستخدم بغض النظر عن طريقة الدفع
    if (restaurantOverride !== null && restaurantOverride !== undefined) {
      return {
        deliveryFee: restaurantOverride,
        driverAmount: restaurantOverride, // نقدي: السائق يأخذ كل شيء
        platformDeliveryFee: 0,
      };
    }

    if (paymentMethod === 'CASH_ON_DELIVERY') {
      // نقدي: السائق يأخذ رسوم التوصيل كاملة من الزبون مباشرة
      const fee = this.getNumberSetting('delivery_fee_cod', 15);
      return {
        deliveryFee: fee,
        driverAmount: fee, // كل الرسوم للسائق
        platformDeliveryFee: 0, // المنصة لا تأخذ شيئاً من التوصيل نقدي
      };
    } else {
      // كرت: رسوم أعلى بشيكل — الفرق للمنصة
      const feeCard = this.getNumberSetting('delivery_fee_card', 16);
      const driverFixed = this.getNumberSetting('driver_delivery_amount', 15);
      return {
        deliveryFee: feeCard,
        driverAmount: driverFixed, // السائق يأخذ مبلغ ثابت
        platformDeliveryFee: feeCard - driverFixed, // الباقي للمنصة
      };
    }
  }

  // ─── عمولة المطعم ─────────────────────────────────────────────────────────

  async calculateCommission(
    restaurantId: string,
    subtotal: number,
  ): Promise<CommissionResult> {
    // نبحث أولاً عن عمولة خاصة بهذا المطعم
    const specific = await this.prisma.commission.findFirst({
      where: {
        restaurantId,
        isActive: true,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    // لو ما فيه خاصة نبحث عن العمولة العامة
    const general = !specific
      ? await this.prisma.commission.findFirst({
          where: {
            restaurantId: null,
            isActive: true,
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
          },
          orderBy: { effectiveFrom: 'desc' },
        })
      : null;

    const commission = specific ?? general;

    let rate = this.getNumberSetting('commission_rate_default', 15);
    let commissionAmount = 0;

    if (commission) {
      if (commission.type === 'PERCENTAGE' && commission.rate) {
        rate = Number(commission.rate);
        commissionAmount = (subtotal * rate) / 100;
      } else if (commission.type === 'FLAT_FEE' && commission.flatAmount) {
        rate = 0;
        commissionAmount = Number(commission.flatAmount);
      }
    } else {
      // استخدام النسبة الافتراضية من platform_settings
      commissionAmount = (subtotal * rate) / 100;
    }

    const restaurantNet = subtotal - commissionAmount;

    return {
      rate,
      commissionAmount: Math.round(commissionAmount * 100) / 100,
      restaurantNet: Math.round(restaurantNet * 100) / 100,
    };
  }

  // ─── حساب كل الأرقام المالية لأوردر ─────────────────────────────────────

  async calculateOrderFinancials(
    restaurantId: string,
    subtotal: number,
    paymentMethod: 'CASH_ON_DELIVERY' | 'CARD',
    restaurantDeliveryOverride?: number | null,
  ): Promise<OrderFinancials> {
    const delivery = this.calculateDeliveryFee(
      paymentMethod,
      restaurantDeliveryOverride,
    );
    const commission = await this.calculateCommission(restaurantId, subtotal);

    const total = subtotal + delivery.deliveryFee;

    // إجمالي ما تكسبه المنصة:
    // عمولة المطعم + عمولة التوصيل (كرت فقط)
    const platformTotal =
      commission.commissionAmount + delivery.platformDeliveryFee;

    return {
      subtotal,
      deliveryFee: delivery.deliveryFee,
      total,
      commissionRate: commission.rate,
      commissionAmount: commission.commissionAmount,
      restaurantNet: commission.restaurantNet,
      driverAmount: delivery.driverAmount,
      platformDeliveryFee: delivery.platformDeliveryFee,
      platformTotal,
    };
  }

  // ─── تسجيل أرباح السائق عند اكتمال التوصيل ──────────────────────────────

  async recordDriverEarning(
    deliveryId: string,
    driverId: string,
    paymentMethod: 'CASH_ON_DELIVERY' | 'CARD',
    deliveryFee: number,
  ): Promise<void> {
    const existing = await this.prisma.driverEarning.findFirst({
      where: { deliveryId },
    });
    if (existing) return; // لا تسجل مرتين

    const deliveryResult = this.calculateDeliveryFee(paymentMethod);
    const driverAmount = deliveryResult.driverAmount;
    const platformShare = deliveryResult.platformDeliveryFee;

    // نقدي: السائق استلم نقداً من الزبون — يُسجَّل كـ PAID مباشرة
    // كرت:  المنصة تحوله لاحقاً — يُسجَّل كـ PENDING
    const payoutStatus =
      paymentMethod === 'CASH_ON_DELIVERY' ? 'PAID' : 'PENDING';

    await this.prisma.driverEarning.create({
      data: {
        deliveryId,
        driverId,
        grossAmount: deliveryFee,
        commissionDeducted: platformShare,
        netAmount: driverAmount,
        payoutStatus,
      },
    });
  }

  // ─── الإعداد الأولي لـ platform_settings ────────────────────────────────
  // تُستدعى مرة واحدة عند أول تشغيل أو عند الـ seed

  async seedDefaultSettings(): Promise<void> {
    const defaults = [
      // ─── مالية ───────────────────────────────────────────────
      {
        key: 'commission_rate_default',
        value: '15',
        dataType: 'number',
        description: 'نسبة عمولة المنصة الافتراضية من المطاعم (%)',
      },
      {
        key: 'delivery_fee_cod',
        value: '15',
        dataType: 'number',
        description: 'رسوم التوصيل — دفع نقدي (₪) — يذهب كاملاً للسائق',
      },
      {
        key: 'delivery_fee_card',
        value: '16',
        dataType: 'number',
        description: 'رسوم التوصيل — دفع بكرت (₪) — شيكل زيادة يبقى للمنصة',
      },
      {
        key: 'driver_delivery_amount',
        value: '15',
        dataType: 'number',
        description: 'المبلغ الثابت للسائق من رسوم التوصيل (₪)',
      },
      // ─── dispatch ────────────────────────────────────────────
      {
        key: 'dispatch_radius_km',
        value: '5',
        dataType: 'number',
        description: 'نطاق البحث عن سائق بالكيلومتر',
      },
      {
        key: 'dispatch_radius_expand_km',
        value: '2',
        dataType: 'number',
        description: 'زيادة النطاق عند عدم إيجاد سائق',
      },
      {
        key: 'driver_offer_timeout_seconds',
        value: '30',
        dataType: 'number',
        description: 'وقت انتظار السائق للرد على العرض (ثانية)',
      },
      {
        key: 'auto_reject_minutes',
        value: '3',
        dataType: 'number',
        description: 'وقت الرفض التلقائي للأوردر إذا لم يستجب المطعم (دقيقة)',
      },
      // ─── عام ─────────────────────────────────────────────────
      {
        key: 'min_order_amount_global',
        value: '0',
        dataType: 'number',
        description: 'الحد الأدنى للطلب عالمياً (₪) — 0 = بدون حد',
      },
      {
        key: 'platform_currency',
        value: 'ILS',
        dataType: 'string',
        description: 'عملة المنصة — شيكل إسرائيلي',
      },
      {
        key: 'platform_country',
        value: 'Israel',
        dataType: 'string',
        description: 'دولة المنصة',
      },
      {
        key: 'platform_phone_prefix',
        value: '+972',
        dataType: 'string',
        description: 'مسبقة رقم الهاتف',
      },
    ];

    for (const setting of defaults) {
      await this.prisma.platformSetting.upsert({
        where: { key: setting.key },
        update: {},
        create: setting,
      });
    }

    // إعادة تحميل الإعدادات في الذاكرة
    await this.loadSettings();
    this.logger.log(`Seeded ${defaults.length} platform settings`);
  }
}
