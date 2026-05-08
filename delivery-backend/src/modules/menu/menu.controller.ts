import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MenuService } from './menu.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@ApiTags('Menu')
@ApiBearerAuth('access-token')
@Roles('RESTAURANT_OWNER', 'RESTAURANT_STAFF')
@Controller('restaurants/me/menu')
export class MenuController {
  constructor(private readonly service: MenuService) {}

  // Categories
  @Get('categories')
  listCategories(@CurrentUser() user: JwtPayload) {
    return this.service.listCategories(user.restaurantId!);
  }

  @Post('categories')
  createCategory(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.service.createCategory(user.restaurantId!, dto);
  }

  @Delete('categories/:categoryId')
  @HttpCode(200)
  deleteCategory(
    @CurrentUser() user: JwtPayload,
    @Param('categoryId') categoryId: string,
  ) {
    return this.service.deleteCategory(user.restaurantId!, categoryId);
  }

  // Products
  @Post('products')
  createProduct(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateProductDto,
  ) {
    return this.service.createProduct(user.restaurantId!, dto);
  }

  @Patch('products/:productId/availability')
  updateAvailability(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.service.updateAvailability(user.restaurantId!, productId, dto);
  }

  @Delete('products/:productId')
  @HttpCode(200)
  deleteProduct(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
  ) {
    return this.service.deleteProduct(user.restaurantId!, productId);
  }
}
