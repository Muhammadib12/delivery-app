import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { CreateOrderDto } from './dto/create-order.dto';
import { AcceptOrderDto } from './dto/accept-order.dto';
import { RejectOrderDto } from './dto/reject-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('Orders')
@ApiBearerAuth('access-token')
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  // ─── Customer endpoints ───────────────────────────────────────────────────

  @Roles('CUSTOMER')
  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'UUID v4 — auto-generated if not provided',
  })
  createOrder(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.service.createOrder(user.sub, dto, idempotencyKey ?? uuidv4());
  }

  @Roles('CUSTOMER')
  @Get('active')
  getActiveOrder(@CurrentUser() user: JwtPayload) {
    return this.service.getActiveOrder(user.sub);
  }

  @Roles('CUSTOMER')
  @Get()
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getOrderHistory(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.getOrderHistory(user.sub, { status, page, limit });
  }

  @Roles('CUSTOMER')
  @Get(':orderId/tracking')
  getOrderTracking(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.service.getOrderTracking(orderId, user.sub);
  }

  @Roles('CUSTOMER')
  @Get(':orderId')
  getOrderDetail(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.service.getOrderDetail(orderId, user.sub);
  }

  @Roles('CUSTOMER')
  @Post(':orderId/cancel')
  @HttpCode(200)
  cancelOrder(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.service.cancelOrder(orderId, user.sub, user.role, dto);
  }
}

// ─── Restaurant Orders Controller ────────────────────────────────────────────

@ApiTags('Restaurant Orders')
@ApiBearerAuth('access-token')
@Controller('restaurants/me/orders')
export class RestaurantOrdersController {
  constructor(private readonly service: OrdersService) {}

  @Roles('RESTAURANT_OWNER', 'RESTAURANT_STAFF')
  @Get()
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listOrders(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.getRestaurantOrders(user.restaurantId!, {
      status,
      page,
      limit,
    });
  }

  @Roles('RESTAURANT_OWNER', 'RESTAURANT_STAFF')
  @Post(':orderId/accept')
  @HttpCode(200)
  acceptOrder(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
    @Body() dto: AcceptOrderDto,
  ) {
    return this.service.acceptOrder(
      orderId,
      user.restaurantId!,
      user.role,
      dto,
    );
  }

  @Roles('RESTAURANT_OWNER', 'RESTAURANT_STAFF')
  @Post(':orderId/reject')
  @HttpCode(200)
  rejectOrder(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
    @Body() dto: RejectOrderDto,
  ) {
    return this.service.rejectOrder(
      orderId,
      user.restaurantId!,
      user.role,
      dto,
    );
  }

  @Roles('RESTAURANT_OWNER', 'RESTAURANT_STAFF')
  @Post(':orderId/preparing')
  @HttpCode(200)
  markPreparing(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.service.markPreparing(orderId, user.restaurantId!, user.role);
  }

  @Roles('RESTAURANT_OWNER', 'RESTAURANT_STAFF')
  @Post(':orderId/request-driver')
  @HttpCode(200)
  requestDriver(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.service.requestDriver(orderId, user.restaurantId!, user.role);
  }
}
