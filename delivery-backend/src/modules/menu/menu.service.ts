import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Public: Full Menu ────────────────────────────────────────────────────

  async getFullMenu(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
      select: { id: true },
    });
    if (!restaurant) throw new NotFoundException('RESOURCE_NOT_FOUND');

    const categories = await this.prisma.menuCategory.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: {
            images: { orderBy: { sortOrder: 'asc' } },
            modifiers: {
              orderBy: { sortOrder: 'asc' },
              include: { options: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
      },
    });

    return {
      restaurantId,
      categories: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        sortOrder: cat.sortOrder,
        products: cat.products.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: Number(p.price),
          isAvailable: p.isAvailable,
          sortOrder: p.sortOrder,
          images: p.images.map((img) => ({
            url: img.url,
            isPrimary: img.isPrimary,
          })),
          modifiers: p.modifiers.map((mod) => ({
            id: mod.id,
            name: mod.name,
            isRequired: mod.isRequired,
            minSelections: mod.minSelections,
            maxSelections: mod.maxSelections,
            options: mod.options.map((opt) => ({
              id: opt.id,
              name: opt.name,
              priceAdjustment: Number(opt.priceAdjustment),
              isDefault: opt.isDefault,
            })),
          })),
        })),
      })),
    };
  }

  // ─── Categories ───────────────────────────────────────────────────────────

  async createCategory(restaurantId: string, dto: CreateCategoryDto) {
    return this.prisma.menuCategory.create({
      data: {
        restaurantId,
        name: dto.name,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async listCategories(restaurantId: string) {
    return this.prisma.menuCategory.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async deleteCategory(restaurantId: string, categoryId: string) {
    const cat = await this.prisma.menuCategory.findFirst({
      where: { id: categoryId, restaurantId },
    });
    if (!cat) throw new NotFoundException('RESOURCE_NOT_FOUND');
    await this.prisma.menuCategory.delete({ where: { id: categoryId } });
    return { message: 'Category deleted' };
  }

  // ─── Products ─────────────────────────────────────────────────────────────

  async createProduct(restaurantId: string, dto: CreateProductDto) {
    const cat = await this.prisma.menuCategory.findFirst({
      where: { id: dto.menuCategoryId, restaurantId },
    });
    if (!cat) throw new NotFoundException('RESOURCE_NOT_FOUND');

    return this.prisma.product.create({
      data: {
        restaurantId,
        menuCategoryId: dto.menuCategoryId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        isAvailable: dto.isAvailable ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateAvailability(
    restaurantId: string,
    productId: string,
    dto: UpdateAvailabilityDto,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, restaurantId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('RESOURCE_NOT_FOUND');

    return this.prisma.product.update({
      where: { id: productId },
      data: { isAvailable: dto.isAvailable },
      select: { id: true, name: true, isAvailable: true },
    });
  }

  async deleteProduct(restaurantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, restaurantId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('RESOURCE_NOT_FOUND');
    await this.prisma.product.update({
      where: { id: productId },
      data: { deletedAt: new Date() },
    });
    return { message: 'Product deleted' };
  }
}
