import { IsEnum } from 'class-validator';

export class RejectOrderDto {
  @IsEnum(['OUT_OF_STOCK', 'TOO_BUSY', 'CLOSING_SOON', 'OTHER'])
  reason: string;
}
