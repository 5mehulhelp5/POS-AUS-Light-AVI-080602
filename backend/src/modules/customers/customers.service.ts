import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer, SyncStatus } from './entities';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  async findAll(options?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ customers: Customer[]; total: number }> {
    const { search, page = 1, limit = 20 } = options || {};

    const query = this.customerRepository.createQueryBuilder('customer');

    if (search) {
      query.where(
        '(customer.firstName LIKE :search OR customer.lastName LIKE :search OR customer.email LIKE :search OR customer.phone LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [customers, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('customer.lastName', 'ASC')
      .getManyAndCount();

    return { customers, total };
  }

  async findById(id: number): Promise<Customer | null> {
    return this.customerRepository.findOne({ where: { id } });
  }

  async create(data: Partial<Customer>): Promise<Customer> {
    const customer = this.customerRepository.create({
      ...data,
      syncStatus: SyncStatus.PENDING,
    });
    return this.customerRepository.save(customer);
  }

  async update(id: number, data: Partial<Customer>): Promise<Customer> {
    const customer = await this.findById(id);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    await this.customerRepository.update(id, data);
    return this.findById(id) as Promise<Customer>;
  }
}
