import { IsEnum, IsString, IsNotEmpty } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsString()
  @IsNotEmpty()
  fcmToken: string;

  @IsEnum(['android', 'ios'], { message: 'platform must be android or ios' })
  platform: 'android' | 'ios';
}
