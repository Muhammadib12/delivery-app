import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDriverProfileDto {
  @IsOptional() @IsString() @MaxLength(100) displayName?: string;
  @IsOptional() @IsString() @MaxLength(50) vehicleType?: string;
  @IsOptional() @IsString() @MaxLength(30) vehiclePlate?: string;
  @IsOptional() @IsString() @MaxLength(50) vehicleColor?: string;
}
