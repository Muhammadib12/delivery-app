import { Controller, Get, Put, Patch, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { UpdateDriverProfileDto } from './dto/update-profile.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@ApiTags('Drivers')
@ApiBearerAuth('access-token')
@Roles('DRIVER')
@Controller('drivers/me')
export class DriversController {
  constructor(private readonly service: DriversService) {}

  @Get()
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.service.getProfile(user.sub);
  }

  @Put()
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateDriverProfileDto,
  ) {
    return this.service.updateProfile(user.sub, dto);
  }

  @Patch('availability')
  updateAvailability(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.service.updateAvailability(user.sub, dto);
  }

  @Get('earnings')
  getEarnings(@CurrentUser() user: JwtPayload) {
    return this.service.getEarnings(user.sub);
  }
}
