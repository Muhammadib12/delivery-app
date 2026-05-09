import {
  Controller,
  Get,
  Put,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RestaurantsService } from './restaurants.service';
import { MenuService } from '../menu/menu.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

// ─── Working Hours DTOs ───────────────────────────────────────────────────────

class WorkingHourDayDto {
  @IsInt() @Min(0) @Max(6) dayOfWeek: number;
  @IsString() @Matches(/^\d{2}:\d{2}$/) openTime: string;
  @IsString() @Matches(/^\d{2}:\d{2}$/) closeTime: string;
  @IsBoolean() isClosed: boolean;
}

class UpdateAllWorkingHoursDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHourDayDto)
  days: WorkingHourDayDto[];
}

class UpdateOneDayDto {
  @IsOptional() @IsString() @Matches(/^\d{2}:\d{2}$/) openTime?: string;
  @IsOptional() @IsString() @Matches(/^\d{2}:\d{2}$/) closeTime?: string;
  @IsOptional() @IsBoolean() isClosed?: boolean;
}

@ApiTags('Restaurants')
@ApiBearerAuth('access-token')
@Controller('restaurants')
export class RestaurantsController {
  constructor(
    private readonly service: RestaurantsService,
    private readonly menuService: MenuService,
  ) {}

  @Public()
  @Get()
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'lat', required: false, type: Number })
  @ApiQuery({ name: 'lng', required: false, type: Number })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['distance', 'rating', 'name'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listRestaurants(
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
    @Query('sort') sort?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.listPublic({
      categoryId,
      status,
      lat,
      lng,
      sort,
      page,
      limit,
    });
  }

  @Roles('RESTAURANT_OWNER', 'RESTAURANT_STAFF')
  @Get('me')
  getMyRestaurant(@CurrentUser() user: JwtPayload) {
    return this.service.getMyRestaurant(user.restaurantId!);
  }

  @Roles('RESTAURANT_OWNER')
  @Put('me')
  updateMyRestaurant(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateRestaurantDto,
  ) {
    return this.service.updateMyRestaurant(user.restaurantId!, dto);
  }

  @Roles('RESTAURANT_OWNER', 'RESTAURANT_STAFF')
  @Patch('me/status')
  updateStatus(@CurrentUser() user: JwtPayload, @Body() dto: UpdateStatusDto) {
    return this.service.updateStatus(user.restaurantId!, user.role, dto);
  }

  @Roles('RESTAURANT_OWNER', 'RESTAURANT_STAFF')
  @Get('me/dashboard')
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.service.getDashboard(user.restaurantId!);
  }

  // ─── Working Hours ──────────────────────────────────────────────────────────

  @Roles('RESTAURANT_OWNER', 'RESTAURANT_STAFF')
  @Get('me/working-hours')
  getWorkingHours(@CurrentUser() user: JwtPayload) {
    return this.service.getWorkingHours(user.restaurantId!);
  }

  @Roles('RESTAURANT_OWNER')
  @Put('me/working-hours')
  updateAllWorkingHours(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAllWorkingHoursDto,
  ) {
    return this.service.updateAllWorkingHours(user.restaurantId!, dto.days);
  }

  @Roles('RESTAURANT_OWNER')
  @Patch('me/working-hours/:day')
  updateOneDay(
    @CurrentUser() user: JwtPayload,
    @Param('day', ParseIntPipe) day: number,
    @Body() dto: UpdateOneDayDto,
  ) {
    return this.service.updateOneDay(user.restaurantId!, day, dto);
  }

  // ─── Public ─────────────────────────────────────────────────────────────────

  @Public()
  @Get(':restaurantId/menu')
  getMenu(@Param('restaurantId') restaurantId: string) {
    return this.menuService.getFullMenu(restaurantId);
  }

  @Public()
  @Get(':restaurantId')
  getRestaurantDetail(@Param('restaurantId') restaurantId: string) {
    return this.service.getPublicDetail(restaurantId);
  }
}
