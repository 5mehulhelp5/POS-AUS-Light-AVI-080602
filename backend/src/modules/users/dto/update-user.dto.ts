import {
  IsEmail,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Length,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  // Empty string / null clears the email (for existing casuals).
  @ApiPropertyOptional({ example: 'staff@store.com' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== undefined && v !== '')
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ example: 'NewSecurePass123!' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Smith' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  roleId?: number;

  @ApiPropertyOptional({ example: '1234' })
  @IsOptional()
  @IsString()
  @Length(4, 6)
  pinCode?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
