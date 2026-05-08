import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class AcceptOrderDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  estimatedPrepMinutes?: number;
}
