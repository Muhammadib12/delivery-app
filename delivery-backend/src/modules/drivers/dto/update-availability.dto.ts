import { IsEnum } from 'class-validator';

export class UpdateAvailabilityDto {
  @IsEnum(['ONLINE', 'OFFLINE'], {
    message: 'status must be ONLINE or OFFLINE',
  })
  status: 'ONLINE' | 'OFFLINE';
}
