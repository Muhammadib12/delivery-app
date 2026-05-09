import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsNumber,
  IsArray,
  ValidateNested,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateModifierOptionDto {
  @IsString() @MaxLength(100) name: string;
  @IsOptional() @IsNumber() priceAdjustment?: number;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class CreateModifierDto {
  @IsString() @MaxLength(100) name: string;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsInt() @Min(0) minSelections?: number;
  @IsOptional() @IsInt() @Min(1) maxSelections?: number;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateModifierOptionDto)
  options?: CreateModifierOptionDto[];
}
