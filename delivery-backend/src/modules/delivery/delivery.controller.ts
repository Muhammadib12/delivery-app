import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DeliveryService } from './delivery.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { UpdateLocationDto } from './dto/update-location.dto';

@ApiTags('Driver Delivery')
@ApiBearerAuth('access-token')
@Roles('DRIVER')
@Controller('drivers/me')
export class DeliveryController {
  constructor(private readonly service: DeliveryService) {}

  // ─── Location ─────────────────────────────────────────────────────────────

  @Patch('location')
  @HttpCode(200)
  updateLocation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.service.updateLocation(user.sub, dto);
  }

  // ─── Offers ───────────────────────────────────────────────────────────────

  @Get('offers/active')
  getActiveOffer(@CurrentUser() user: JwtPayload) {
    return this.service.getActiveOffer(user.sub);
  }

  @Post('offers/:offerId/accept')
  @HttpCode(200)
  acceptOffer(
    @CurrentUser() user: JwtPayload,
    @Param('offerId') offerId: string,
  ) {
    return this.service.acceptOffer(user.sub, offerId);
  }

  @Post('offers/:offerId/decline')
  @HttpCode(200)
  declineOffer(
    @CurrentUser() user: JwtPayload,
    @Param('offerId') offerId: string,
  ) {
    return this.service.declineOffer(user.sub, offerId);
  }

  // ─── Active delivery ──────────────────────────────────────────────────────

  @Get('active-delivery')
  getActiveDelivery(@CurrentUser() user: JwtPayload) {
    return this.service.getActiveDelivery(user.sub);
  }

  // ─── Delivery status transitions ──────────────────────────────────────────

  @Post('deliveries/:deliveryId/arrived-restaurant')
  @HttpCode(200)
  arrivedRestaurant(
    @CurrentUser() user: JwtPayload,
    @Param('deliveryId') id: string,
  ) {
    return this.service.markArrivedRestaurant(user.sub, id);
  }

  @Post('deliveries/:deliveryId/picked-up')
  @HttpCode(200)
  pickedUp(@CurrentUser() user: JwtPayload, @Param('deliveryId') id: string) {
    return this.service.markPickedUp(user.sub, id);
  }

  @Post('deliveries/:deliveryId/arrived-customer')
  @HttpCode(200)
  arrivedCustomer(
    @CurrentUser() user: JwtPayload,
    @Param('deliveryId') id: string,
  ) {
    return this.service.markArrivedCustomer(user.sub, id);
  }

  @Post('deliveries/:deliveryId/delivered')
  @HttpCode(200)
  delivered(@CurrentUser() user: JwtPayload, @Param('deliveryId') id: string) {
    return this.service.markDelivered(user.sub, id);
  }

  // ─── History ──────────────────────────────────────────────────────────────

  @Get('deliveries')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getDeliveryHistory(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.getDeliveryHistory(user.sub, { page, limit });
  }
}
