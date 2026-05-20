import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inquiry, InquiryStatus, InquiryType } from './entities';

export interface CreateInquiryDto {
  type: InquiryType;
  subject?: string;
  description?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  followUpDate?: string;
  followUpNotes?: string;
  customerId?: number;
  status?: InquiryStatus;
}

export type UpdateInquiryDto = Partial<CreateInquiryDto>;

@Injectable()
export class InquiriesService {
  constructor(
    @InjectRepository(Inquiry)
    private readonly inquiryRepository: Repository<Inquiry>,
  ) {}

  async create(data: CreateInquiryDto, userId: number): Promise<Inquiry> {
    const inquiry = this.inquiryRepository.create({
      type: data.type,
      subject: data.subject?.trim() || null,
      description: data.description?.trim() || null,
      contactName: data.contactName?.trim() || null,
      contactPhone: data.contactPhone?.replace(/\D+/g, '') || null,
      contactEmail: data.contactEmail?.trim() || null,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      followUpNotes: data.followUpNotes?.trim() || null,
      customerId: data.customerId ?? null,
      userId,
      status: data.status || InquiryStatus.NEW,
    });
    const saved = await this.inquiryRepository.save(inquiry);
    return this.findById(saved.id) as Promise<Inquiry>;
  }

  async update(id: number, data: UpdateInquiryDto): Promise<Inquiry> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundException('Inquiry not found');
    const patch: Partial<Inquiry> = {};
    if (data.type !== undefined) patch.type = data.type;
    if (data.subject !== undefined) patch.subject = data.subject?.trim() || null;
    if (data.description !== undefined)
      patch.description = data.description?.trim() || null;
    if (data.contactName !== undefined)
      patch.contactName = data.contactName?.trim() || null;
    if (data.contactPhone !== undefined)
      patch.contactPhone = data.contactPhone?.replace(/\D+/g, '') || null;
    if (data.contactEmail !== undefined)
      patch.contactEmail = data.contactEmail?.trim() || null;
    if (data.followUpDate !== undefined)
      patch.followUpDate = data.followUpDate ? new Date(data.followUpDate) : null;
    if (data.followUpNotes !== undefined)
      patch.followUpNotes = data.followUpNotes?.trim() || null;
    if (data.customerId !== undefined) patch.customerId = data.customerId ?? null;
    if (data.status !== undefined) patch.status = data.status;
    await this.inquiryRepository.update(id, patch);
    return this.findById(id) as Promise<Inquiry>;
  }

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
