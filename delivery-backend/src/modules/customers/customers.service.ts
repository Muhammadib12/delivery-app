import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Profile ──────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      include: { user: { select: { phone: true, email: true } } },
    });
    if (!profile) throw new NotFoundException('RESOURCE_NOT_FOUND');

    return {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      profilePhotoUrl: profile.profilePhotoUrl,
      phone: profile.user.phone,
      email: profile.user.email,
      defaultAddressId: profile.defaultAddressId,
      createdAt: profile.createdAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('RESOURCE_NOT_FOUND');

    await this.prisma.customerProfile.update({
      where: { userId },
      data: { displayName: dto.displayName },
    });

    if (dto.email) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { email: dto.email },
      });
    }

    return this.getProfile(userId);
  }

  // ─── Addresses ────────────────────────────────────────────────────────────

  async listAddresses(userId: string) {
    const profile = await this.getProfileOrFail(userId);

    return this.prisma.customerAddress.findMany({
      where: { customerId: profile.id, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    const profile = await this.getProfileOrFail(userId);

    if (dto.isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId: profile.id, deletedAt: null },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.customerAddress.create({
      data: {
        customerId: profile.id,
        label: dto.label,
        street: dto.street,
        city: dto.city,
        district: dto.district,
        landmark: dto.landmark,
        latitude: dto.latitude,
        longitude: dto.longitude,
        isDefault: dto.isDefault ?? false,
      },
    });

    if (dto.isDefault) {
      await this.prisma.customerProfile.update({
        where: { id: profile.id },
        data: { defaultAddressId: address.id },
      });
    }

    return address;
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ) {
    const address = await this.findOwnedAddress(userId, addressId);

    if (dto.isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId: address.customerId, deletedAt: null },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.customerAddress.update({
      where: { id: addressId },
      data: {
        label: dto.label,
        street: dto.street,
        city: dto.city,
        district: dto.district,
        landmark: dto.landmark,
        latitude: dto.latitude !== undefined ? dto.latitude : undefined,
        longitude: dto.longitude !== undefined ? dto.longitude : undefined,
        isDefault: dto.isDefault,
      },
    });

    if (dto.isDefault) {
      await this.prisma.customerProfile.update({
        where: { id: address.customerId },
        data: { defaultAddressId: addressId },
      });
    }

    return updated;
  }

  async deleteAddress(userId: string, addressId: string) {
    await this.findOwnedAddress(userId, addressId);

    await this.prisma.customerAddress.update({
      where: { id: addressId },
      data: { deletedAt: new Date(), isDefault: false },
    });

    return { message: 'Address deleted' };
  }

  async setDefaultAddress(userId: string, addressId: string) {
    const address = await this.findOwnedAddress(userId, addressId);

    await this.prisma.customerAddress.updateMany({
      where: { customerId: address.customerId, deletedAt: null },
      data: { isDefault: false },
    });

    const updated = await this.prisma.customerAddress.update({
      where: { id: addressId },
      data: { isDefault: true },
    });

    await this.prisma.customerProfile.update({
      where: { id: address.customerId },
      data: { defaultAddressId: addressId },
    });

    return updated;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async getProfileOrFail(userId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('RESOURCE_NOT_FOUND');
    return profile;
  }

  private async findOwnedAddress(userId: string, addressId: string) {
    const profile = await this.getProfileOrFail(userId);
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId: profile.id, deletedAt: null },
    });
    if (!address) throw new NotFoundException('RESOURCE_NOT_FOUND');
    return address;
  }
}
