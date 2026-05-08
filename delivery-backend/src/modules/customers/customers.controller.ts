import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@ApiTags('Customers')
@ApiBearerAuth('access-token')
@Roles('CUSTOMER')
@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.service.getProfile(user.sub);
  }

  @Put('profile')
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.service.updateProfile(user.sub, dto);
  }

  @Get('addresses')
  listAddresses(@CurrentUser() user: JwtPayload) {
    return this.service.listAddresses(user.sub);
  }

  @Post('addresses')
  createAddress(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAddressDto,
  ) {
    return this.service.createAddress(user.sub, dto);
  }

  @Put('addresses/:addressId')
  updateAddress(
    @CurrentUser() user: JwtPayload,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.service.updateAddress(user.sub, addressId, dto);
  }

  @Delete('addresses/:addressId')
  @HttpCode(200)
  deleteAddress(
    @CurrentUser() user: JwtPayload,
    @Param('addressId') addressId: string,
  ) {
    return this.service.deleteAddress(user.sub, addressId);
  }

  @Patch('addresses/:addressId/default')
  setDefaultAddress(
    @CurrentUser() user: JwtPayload,
    @Param('addressId') addressId: string,
  ) {
    return this.service.setDefaultAddress(user.sub, addressId);
  }
}
