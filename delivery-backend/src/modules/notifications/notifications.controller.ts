import { Controller, Post, Delete, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { IsString, IsIn } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';

class RegisterTokenDto {
  @IsString() fcmToken: string;
  @IsIn(['android', 'ios', 'web']) platform: 'android' | 'ios' | 'web';
}

class RemoveTokenDto {
  @IsString() fcmToken: string;
}

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('device-token')
  async register(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RegisterTokenDto,
  ) {
    await this.notifications.registerToken(
      user.sub,
      dto.fcmToken,
      dto.platform,
    );
    return { message: 'Device token registered' };
  }

  @Delete('device-token')
  async remove(@Body() dto: RemoveTokenDto) {
    await this.notifications.removeToken(dto.fcmToken);
    return { message: 'Device token removed' };
  }
}
