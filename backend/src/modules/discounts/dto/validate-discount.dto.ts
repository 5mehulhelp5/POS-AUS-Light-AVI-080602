import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CartItemDto {
  @ApiProperty()
  @IsNumber()
  productId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  // Clearance / sale item — excluded from the cart-level discount base
  // (already marked down, can't be discounted further).
  @ApiPropertyOptional()
  @IsOptional()
  isSaleItem?: boolean;
}

export class CartDiscountDto {
  @ApiProperty({ enum: ['percent', 'fixed'] })
  @IsEnum(['percent', 'fixed'])
  type: 'percent' | 'fixed';

  @ApiProperty()
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ValidateDiscountDto {
  @ApiProperty({ type: [CartItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @ApiPropertyOptional({ type: CartDiscountDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CartDiscountDto)
  cartDiscount?: CartDiscountDto;
}
