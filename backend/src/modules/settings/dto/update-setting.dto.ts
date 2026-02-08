import { IsString, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SettingType } from '../entities/setting.entity';

export class UpdateSettingDto {
  @ApiProperty({ description: 'Setting key' })
  @IsString()
  key: string;

  @ApiProperty({ description: 'Setting value' })
  value: any;

  @ApiPropertyOptional({ enum: SettingType, description: 'Value type' })
  @IsOptional()
  @IsEnum(SettingType)
  type?: SettingType;

  @ApiPropertyOptional({ description: 'Setting description' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateMultipleSettingsDto {
  @ApiProperty({ type: [UpdateSettingDto], description: 'Array of settings to update' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSettingDto)
  settings: UpdateSettingDto[];
}

export class UpdateStoreSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  store_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  store_abn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  store_address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  store_phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  store_email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  tax_rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  quote_expiry_days?: number;

  @ApiPropertyOptional({ description: 'Trading hours JSON' })
  @IsOptional()
  trading_hours?: any;
}

export class UpdatePaymentSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  payment_cash_enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  payment_eftpos_enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  payment_credit_card_enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  payment_store_credit_enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  default_payment_method?: string;
}

export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  maxDiscountPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  canStackDiscounts?: boolean;
}
