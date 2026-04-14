import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto, PinLoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      this.logger.warn(`Login attempt with invalid email: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      this.logger.warn(`Login attempt by inactive user: ${email}`);
      throw new UnauthorizedException('Account is disabled');
    }

    // Casual users without a password hash can only log in via PIN.
    if (!user.passwordHash) {
      this.logger.warn(`Email login blocked for PIN-only user: ${email}`);
      throw new UnauthorizedException('This account uses PIN login only');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn(`Invalid password for user: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    return this.generateAuthResponse(user);
  }

  async pinLogin(pinLoginDto: PinLoginDto): Promise<AuthResponseDto> {
    const { pinCode } = pinLoginDto;

    const user = await this.usersService.findByPinCode(pinCode);
    if (!user) {
      this.logger.warn(`Invalid PIN login attempt`);
      throw new UnauthorizedException('Invalid PIN');
    }

    if (!user.isActive) {
      this.logger.warn(`PIN login attempt by inactive user: ${user.email}`);
      throw new UnauthorizedException('Account is disabled');
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    return this.generateAuthResponse(user);
  }

  async validateUser(payload: JwtPayload): Promise<any> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      return null;
    }
    return user;
  }

  private generateAuthResponse(user: any): AuthResponseDto {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role.name,
      roleId: user.role.id,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: {
            id: user.role.id,
            name: user.role.name,
            displayName: user.role.displayName,
            maxDiscountPercent: parseFloat(user.role.maxDiscountPercent),
            canStackDiscounts: user.role.canStackDiscounts,
          },
        },
        accessToken,
        expiresIn: 28800, // 8 hours in seconds
      },
    };
  }
}
