import { IsEnum } from 'class-validator';

export class UpdateStatusDto {
  @IsEnum(['OPEN', 'CLOSED', 'BUSY', 'TEMPORARILY_CLOSED'], {
    message: 'status must be OPEN, CLOSED, BUSY, or TEMPORARILY_CLOSED',
  })
  status: 'OPEN' | 'CLOSED' | 'BUSY' | 'TEMPORARILY_CLOSED';
}
