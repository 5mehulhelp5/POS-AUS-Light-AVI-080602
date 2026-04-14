import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Length,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  // Email is optional — casual staff without email addresses only log in via PIN.
  @ApiPropertyOptional({ example: 'staff@store.com' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== undefined && v !== '')
  @IsEmail()
  email?: string | null;

  // Password is optional too — casuals may only use PIN login.
  @ApiPropertyOptional({ example: 'SecurePass123!' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Smith' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  roleId: number;

  // PIN is required — primary login identifier and sale attribution key.
  @ApiProperty({ example: '1234' })
  @IsString()
  @IsNotEmpty()
  @Length(4, 6)
  pinCode: string;
}
