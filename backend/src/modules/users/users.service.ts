import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, Role } from './entities';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async findAll(options?: {
    page?: number;
    limit?: number;
    role?: string;
    active?: boolean;
  }): Promise<{ users: User[]; total: number }> {
    const { role, active } = options || {};
    const page = Number(options?.page) || 1;
    const limit = Number(options?.limit) || 20;

    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role');

    if (role) {
      query.andWhere('role.name = :role', { role });
    }

    if (active !== undefined) {
      query.andWhere('user.isActive = :active', { active });
    }

    const [users, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('user.createdAt', 'DESC')
      .getManyAndCount();

    return { users, total };
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: ['role'],
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    // Skip lookup for blank emails — casuals without an email should never match.
    if (!email) return null;
    return this.userRepository.findOne({
      where: { email, isActive: true },
      relations: ['role'],
    });
  }

  /**
   * Check whether an email is already taken by a DIFFERENT active user.
   * Null/empty emails are always allowed (casuals without email).
   */
  private async isEmailTaken(
    email: string | null | undefined,
    excludeUserId?: number,
  ): Promise<boolean> {
    if (!email) return false;
    const query = this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email });
    if (excludeUserId) {
      query.andWhere('user.id != :id', { id: excludeUserId });
    }
    const existing = await query.getOne();
    return !!existing;
  }

  /**
   * Check whether a PIN is already taken by a DIFFERENT user.
   * PINs must be globally unique because they're the login identifier.
   */
  private async isPinTaken(
    pinCode: string,
    excludeUserId?: number,
  ): Promise<boolean> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .where('user.pinCode = :pinCode', { pinCode });
    if (excludeUserId) {
      query.andWhere('user.id != :id', { id: excludeUserId });
    }
    const existing = await query.getOne();
    return !!existing;
  }

  async findByPinCode(pinCode: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { pinCode, isActive: true },
      relations: ['role'],
    });
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { email, password, roleId, pinCode, ...rest } = createUserDto;

    // PIN is required for all users — it's the primary login for casuals
    // and also how sales are attributed in reports.
    if (!pinCode || !pinCode.trim()) {
      throw new BadRequestException('PIN code is required');
    }

    // Email is optional. When provided, it must be unique.
    const normalisedEmail = email && email.trim() ? email.trim() : null;
    if (await this.isEmailTaken(normalisedEmail)) {
      throw new ConflictException('Email already exists');
    }

    // PIN must be globally unique
    if (await this.isPinTaken(pinCode)) {
      throw new ConflictException('PIN code already in use');
    }

    // Verify role exists
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Password is optional too — casuals may only use PIN login.
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const user = this.userRepository.create({
      ...rest,
      email: normalisedEmail,
      passwordHash,
      roleId,
      pinCode,
    } as Partial<User>);

    const savedUser = await this.userRepository.save(user);
    return this.findById(savedUser.id) as Promise<User>;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password, roleId, pinCode, email, ...rest } = updateUserDto;

    // Email: allow clearing it (empty string → null) for casuals.
    let normalisedEmail: string | null | undefined;
    if (email !== undefined) {
      normalisedEmail = email && email.trim() ? email.trim() : null;
      if (normalisedEmail !== user.email) {
        if (await this.isEmailTaken(normalisedEmail, id)) {
          throw new ConflictException('Email already exists');
        }
      }
    }

    // PIN: cannot be cleared (still required) and must stay unique.
    if (pinCode !== undefined) {
      if (!pinCode || !pinCode.trim()) {
        throw new BadRequestException('PIN code is required');
      }
      if (pinCode !== user.pinCode && (await this.isPinTaken(pinCode, id))) {
        throw new ConflictException('PIN code already in use');
      }
    }

    // Verify role if changing
    if (roleId && roleId !== user.roleId) {
      const role = await this.roleRepository.findOne({ where: { id: roleId } });
      if (!role) {
        throw new NotFoundException('Role not found');
      }
    }

    // Build update payload
    const updateData: Partial<User> = {
      ...rest,
    };

    if (email !== undefined) updateData.email = normalisedEmail ?? null;
    if (pinCode !== undefined) updateData.pinCode = pinCode;
    if (roleId) updateData.roleId = roleId;
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    await this.userRepository.update(id, updateData);
    return this.findById(id) as Promise<User>;
  }

  async deactivate(id: number): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.update(id, { isActive: false });
  }

  async updateLastLogin(id: number): Promise<void> {
    await this.userRepository.update(id, {
      lastLoginAt: new Date(),
    });
  }

  async findAllRoles(): Promise<Role[]> {
    return this.roleRepository.find({
      order: { id: 'ASC' },
    });
  }
}
