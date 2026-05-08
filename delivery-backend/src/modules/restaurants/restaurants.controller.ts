import {
  Controller,
  Get,
  Put,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RestaurantsService } from './restaurants.service';
import { MenuService } from '../menu/menu.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

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
