import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quote, QuoteStatus } from './entities';

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepository: Repository<Quote>,
  ) {}

  async findAll(options?: {
    status?: QuoteStatus;
    customerId?: number;
    page?: number;
    limit?: number;
  }): Promise<{ quotes: Quote[]; total: number }> {
    const { status, customerId } = options || {};
    const page = Number(options?.page) || 1;
    const limit = Number(options?.limit) || 20;

    const query = this.quoteRepository
      .createQueryBuilder('quote')
      .leftJoinAndSelect('quote.customer', 'customer')
      .leftJoinAndSelect('quote.user', 'user')
      .leftJoinAndSelect('quote.items', 'items');

    if (status) {
      query.andWhere('quote.status = :status', { status });
    }

    if (customerId) {
      query.andWhere('quote.customerId = :customerId', { customerId });
    }

    const [quotes, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('quote.createdAt', 'DESC')
      .getManyAndCount();

    return { quotes, total };
  }

  async findById(id: number): Promise<Quote | null> {
    return this.quoteRepository.findOne({
      where: { id },
      relations: ['customer', 'user', 'items'],
    });
  }
}
