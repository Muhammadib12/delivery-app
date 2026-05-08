import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsUUID() menuCategoryId: string;
  @IsString() @MaxLength(150) name: string;
  @IsOptional() @IsString() description?: string;
  @IsNumber() @Min(0) price: number;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
  @IsOptional() @IsNumber() @Min(0) sortOrder?: number;
}
