import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { UpdateDriverProfileDto } from './dto/update-profile.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: { select: { phone: true, email: true } } },
    });
    if (!profile) throw new NotFoundException('RESOURCE_NOT_FOUND');
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateDriverProfileDto) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('RESOURCE_NOT_FOUND');

    return this.prisma.driverProfile.update({
      where: { userId },
      data: {
        displayName: dto.displayName,
        vehicleType: dto.vehicleType,
        vehiclePlate: dto.vehiclePlate,
        vehicleColor: dto.vehicleColor,
      },
    });
  }

  async updateAvailability(userId: string, dto: UpdateAvailabilityDto) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('RESOURCE_NOT_FOUND');

    if (profile.verificationStatus !== 'APPROVED') {
      throw new ForbiddenException(
        'Driver must be APPROVED before going online',
      );
    }

    const prevStatus = profile.availabilityStatus;
    const newStatus = dto.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE';

    await this.prisma.driverProfile.update({
      where: { userId },
      data: { availabilityStatus: newStatus },
    });

    // Log status change
    await this.prisma.driverStatusHistory.create({
      data: {
        driverId: profile.id,
        fromStatus: prevStatus,
        toStatus: newStatus,
      },
    });

    // Clear location cache when going offline
    if (newStatus === 'OFFLINE') {
      await this.redis.del(`driver:${profile.id}:location`);
    }

    return { availabilityStatus: newStatus };
  }

  async getEarnings(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('RESOURCE_NOT_FOUND');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayEarnings, totalEarnings, pendingPayout] = await Promise.all([
      this.prisma.driverEarning.aggregate({
        where: { driverId: profile.id, createdAt: { gte: today } },
        _sum: { netAmount: true },
        _count: true,
      }),
      this.prisma.driverEarning.aggregate({
        where: { driverId: profile.id },
        _sum: { netAmount: true },
        _count: true,
      }),
      this.prisma.driverEarning.aggregate({
        where: { driverId: profile.id, payoutStatus: 'PENDING' },
        _sum: { netAmount: true },
      }),
    ]);

    return {
      todayEarnings: Number(todayEarnings._sum.netAmount ?? 0),
      todayDeliveries: todayEarnings._count,
      totalEarnings: Number(totalEarnings._sum.netAmount ?? 0),
      totalDeliveries: totalEarnings._count,
      pendingPayout: Number(pendingPayout._sum.netAmount ?? 0),
    };
  }
}
