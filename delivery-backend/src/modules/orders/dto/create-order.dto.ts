import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class SelectedModifierDto {
  @IsUUID() modifierId: string;
  @IsUUID() optionId: string;
}

class CartItemDto {
  @IsUUID() productId: string;
  @IsInt() @Min(1) quantity: number;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedModifierDto)
  selectedModifiers?: SelectedModifierDto[];
  @IsOptional() @IsString() @MaxLength(200) notes?: string;
}

class CartSnapshotDto {
  @IsUUID() restaurantId: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];
}

export class CreateOrderDto {
  @IsUUID() addressId: string;

  @IsEnum(['CASH_ON_DELIVERY'], {
    message: 'Only CASH_ON_DELIVERY is supported in MVP',
  })
  paymentMethod: 'CASH_ON_DELIVERY';

  @IsOptional() @IsString() @MaxLength(300) deliveryNotes?: string;

  @ValidateNested()
  @Type(() => CartSnapshotDto)
  cartSnapshot: CartSnapshotDto;
}
