import {
  Controller,
  Get,
  Post,
  Put,
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
import { CreateModifierDto, CreateModifierOptionDto } from './dto/create-modifier.dto';

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

  // ─── Modifiers ────────────────────────────────────────────────────────────

  @Get('products/:productId/modifiers')
  listModifiers(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
  ) {
    return this.service.listModifiers(user.restaurantId!, productId);
  }

  @Post('products/:productId/modifiers')
  createModifier(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
    @Body() dto: CreateModifierDto,
  ) {
    return this.service.createModifier(user.restaurantId!, productId, dto);
  }

  @Put('products/:productId/modifiers/:modifierId')
  updateModifier(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
    @Param('modifierId') modifierId: string,
    @Body() dto: CreateModifierDto,
  ) {
    return this.service.updateModifier(
      user.restaurantId!,
      productId,
      modifierId,
      dto,
    );
  }

  @Delete('products/:productId/modifiers/:modifierId')
  @HttpCode(200)
  deleteModifier(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
    @Param('modifierId') modifierId: string,
  ) {
    return this.service.deleteModifier(
      user.restaurantId!,
      productId,
      modifierId,
    );
  }

  // ─── Modifier Options ─────────────────────────────────────────────────────

  @Post('products/:productId/modifiers/:modifierId/options')
  addOption(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
    @Param('modifierId') modifierId: string,
    @Body() dto: CreateModifierOptionDto,
  ) {
    return this.service.addOption(
      user.restaurantId!,
      productId,
      modifierId,
      dto,
    );
  }

  @Delete('products/:productId/modifiers/:modifierId/options/:optionId')
  @HttpCode(200)
  deleteOption(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
    @Param('modifierId') modifierId: string,
    @Param('optionId') optionId: string,
  ) {
    return this.service.deleteOption(
      user.restaurantId!,
      productId,
      modifierId,
      optionId,
    );
  }
}
