import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inquiry, InquiryStatus, InquiryType } from './entities';

@Injectable()
export class InquiriesService {
  constructor(
    @InjectRepository(Inquiry)
    private readonly inquiryRepository: Repository<Inquiry>,
  ) {}

  async findAll(options?: {
    status?: InquiryStatus;
    type?: InquiryType;
    customerId?: number;
    page?: number;
    limit?: number;
  }): Promise<{ inquiries: Inquiry[]; total: number }> {
    const { status, type, customerId } = options || {};
    const page = Number(options?.page) || 1;
    const limit = Number(options?.limit) || 20;

    const query = this.inquiryRepository
      .createQueryBuilder('inquiry')
      .leftJoinAndSelect('inquiry.customer', 'customer')
      .leftJoinAndSelect('inquiry.user', 'user');

    if (status) {
      query.andWhere('inquiry.status = :status', { status });
    }

    if (type) {
      query.andWhere('inquiry.type = :type', { type });
    }

    if (customerId) {
      query.andWhere('inquiry.customerId = :customerId', { customerId });
    }

    const [inquiries, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('inquiry.createdAt', 'DESC')
      .getManyAndCount();

    return { inquiries, total };
  }

  async findById(id: number): Promise<Inquiry | null> {
    return this.inquiryRepository.findOne({
      where: { id },
      relations: ['customer', 'user'],
    });
  }
}
