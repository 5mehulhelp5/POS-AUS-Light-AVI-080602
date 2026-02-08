import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    return this.userRepository.findOne({
      where: { email },
      relations: ['role'],
    });
  }

  async findByPinCode(pinCode: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { pinCode, isActive: true },
      relations: ['role'],
    });
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { email, password, roleId, pinCode, ...rest } = createUserDto;

    // Check for existing email
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Check for existing PIN
    if (pinCode) {
      const existingPin = await this.findByPinCode(pinCode);
      if (existingPin) {
        throw new ConflictException('PIN code already in use');
      }
    }

    // Verify role exists
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const user = this.userRepository.create({
      ...rest,
      email,
      passwordHash,
      roleId,
      pinCode,
    });

    const savedUser = await this.userRepository.save(user);
    return this.findById(savedUser.id) as Promise<User>;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password, roleId, pinCode, email, ...rest } = updateUserDto;

    // Check email uniqueness if changing
    if (email && email !== user.email) {
      const existingUser = await this.findByEmail(email);
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
    }

    // Check PIN uniqueness if changing
    if (pinCode && pinCode !== user.pinCode) {
      const existingPin = await this.findByPinCode(pinCode);
      if (existingPin) {
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

    // Update user
    const updateData: Partial<User> = {
      ...rest,
    };

    if (email) updateData.email = email;
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
