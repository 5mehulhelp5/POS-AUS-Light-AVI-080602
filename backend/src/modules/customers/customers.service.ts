import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer, SyncStatus } from './entities';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Refund } from '../orders/entities/refund.entity';
import { Quote, QuoteStatus } from '../quotes/entities/quote.entity';

export interface CustomerStats {
  totalSpent: number;
  orderCount: number;
  activeQuoteCount: number;
  previousQuoteCount: number;
  lastPurchaseDate: Date | null;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Refund)
    private readonly refundRepository: Repository<Refund>,
    @InjectRepository(Quote)
    private readonly quoteRepository: Repository<Quote>,
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
        '(customer.firstName LIKE :search OR customer.lastName LIKE :search OR customer.email LIKE :search OR customer.phone LIKE :search OR customer.company LIKE :search OR CONCAT(customer.firstName, \' \', customer.lastName) LIKE :search)',
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

  async getStats(customerId: number): Promise<CustomerStats> {
    // Sum grand totals of all non-cancelled orders for this customer
    const orderSum = await this.orderRepository
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.grandTotal), 0)', 'total')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MAX(o.createdAt)', 'lastDate')
      .where('o.customerId = :id', { id: customerId })
      .andWhere('o.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .getRawOne();

    const orderTotal = Number(orderSum?.total || 0);
    const orderCount = Number(orderSum?.count || 0);
    const lastPurchaseDate = orderSum?.lastDate || null;

    // Subtract refunds against those orders
    const refundSum = await this.refundRepository
      .createQueryBuilder('r')
      .innerJoin('r.order', 'o')
      .select('COALESCE(SUM(r.refundAmount), 0)', 'total')
      .where('o.customerId = :id', { id: customerId })
      .getRawOne();

    const refundTotal = Number(refundSum?.total || 0);
    const totalSpent = Math.max(0, Math.round((orderTotal - refundTotal) * 100) / 100);

    // Quote counts — "active" = open AND not yet past expiry; "previous" = everything else
    const now = new Date();
    const activeQuoteCount = await this.quoteRepository
      .createQueryBuilder('q')
      .where('q.customerId = :id', { id: customerId })
      .andWhere('q.status = :open', { open: QuoteStatus.OPEN })
      .andWhere('q.expiresAt >= :now', { now })
      .getCount();

    const previousQuoteCount = await this.quoteRepository
      .createQueryBuilder('q')
      .where('q.customerId = :id', { id: customerId })
      .andWhere(
        '(q.status != :open OR q.expiresAt < :now)',
        { open: QuoteStatus.OPEN, now },
      )
      .getCount();

    return {
      totalSpent,
      orderCount,
      activeQuoteCount,
      previousQuoteCount,
      lastPurchaseDate: lastPurchaseDate ? new Date(lastPurchaseDate) : null,
    };
  }
}
