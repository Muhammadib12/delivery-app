import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import {
  IsString,
  IsIn,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class UpdateDriverVerificationDto {
  @IsIn(['APPROVED', 'REJECTED']) status: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() note?: string;
}

class UpdateRestaurantStatusDto {
  @IsIn(['OPEN', 'CLOSED', 'SUSPENDED']) status:
    | 'OPEN'
    | 'CLOSED'
    | 'SUSPENDED';
}

class UpdateRestaurantCommissionDto {
  @IsNumber() @Min(0) @Max(100) @Type(() => Number) rate: number;
}

class UpdateSettingDto {
  @IsString() value: string;
}

class SetUserStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'BANNED']) status:
    | 'ACTIVE'
    | 'SUSPENDED'
    | 'BANNED';
}

class MarkDriverPaidDto {
  @IsArray() @IsString({ each: true }) earningIds: string[];
}

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  @Get('dashboard')
  async getDashboard() {
    return this.admin.getDashboard();
  }

  // ─── Users ─────────────────────────────────────────────────────────────────

  @Get('users')
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listUsers(@Query() query: any) {
    return this.admin.listUsers(query);
  }

  @Patch('users/:userId/status')
  async setUserStatus(
    @Param('userId') userId: string,
    @Body() dto: SetUserStatusDto,
  ) {
    return this.admin.setUserStatus(userId, dto.status);
  }

  // ─── Drivers ───────────────────────────────────────────────────────────────

  @Get('drivers')
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listDrivers(@Query() query: any) {
    return this.admin.listDrivers(query);
  }

  @Get('drivers/:driverId')
  async getDriver(@Param('driverId') driverId: string) {
    return this.admin.getDriver(driverId);
  }

  @Patch('drivers/:driverId/verification')
  async updateDriverVerification(
    @Param('driverId') driverId: string,
    @Body() dto: UpdateDriverVerificationDto,
  ) {
    return this.admin.updateDriverVerification(driverId, dto.status, dto.note);
  }

  // ─── Restaurants ───────────────────────────────────────────────────────────

  @Get('restaurants')
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listRestaurants(@Query() query: any) {
    return this.admin.listRestaurants(query);
  }

  @Get('restaurants/:restaurantId')
  async getRestaurant(@Param('restaurantId') restaurantId: string) {
    return this.admin.getRestaurant(restaurantId);
  }

  @Patch('restaurants/:restaurantId/status')
  async updateRestaurantStatus(
    @Param('restaurantId') restaurantId: string,
    @Body() dto: UpdateRestaurantStatusDto,
  ) {
    return this.admin.updateRestaurantStatus(restaurantId, dto.status);
  }

  @Patch('restaurants/:restaurantId/commission')
  async updateRestaurantCommission(
    @Param('restaurantId') restaurantId: string,
    @Body() dto: UpdateRestaurantCommissionDto,
  ) {
    return this.admin.updateRestaurantCommission(restaurantId, dto.rate);
  }

  // ─── Orders ────────────────────────────────────────────────────────────────

  @Get('orders')
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'restaurantId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listOrders(@Query() query: any) {
    return this.admin.listOrders(query);
  }

  // ─── Finance ───────────────────────────────────────────────────────────────

  @Get('finance/report')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async getFinanceReport(@Query() query: any) {
    return this.admin.getFinanceReport(query);
  }

  @Get('finance/drivers/:driverId')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getDriverEarnings(
    @Param('driverId') driverId: string,
    @Query() query: any,
  ) {
    return this.admin.getDriverEarnings(driverId, query);
  }

  @Post('finance/drivers/mark-paid')
  async markDriverPaid(@Body() dto: MarkDriverPaidDto) {
    return this.admin.markDriverPaid(dto.earningIds);
  }

  // ─── Platform Settings ─────────────────────────────────────────────────────

  @Get('settings')
  async getSettings() {
    return this.admin.getSettings();
  }

  @Patch('settings/:key')
  async updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.admin.updateSetting(key, dto.value);
  }
}
