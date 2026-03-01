import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quote, QuoteStatus } from './entities';
import { QuoteItem } from './entities/quote-item.entity';
import { Product } from '../products/entities/product.entity';
import { Customer } from '../customers/entities/customer.entity';

export interface CreateQuoteDto {
  customerId?: number;
  items: Array<{
    productId: number;
    quantity: number;
    discountPercent?: number;
  }>;
  notes?: string;
  expiryDays?: number;
}

@Injectable()
export class QuotesService {
  private readonly TAX_RATE = 0.10; // 10% GST

  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepository: Repository<Quote>,
    @InjectRepository(QuoteItem)
    private readonly quoteItemRepository: Repository<QuoteItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private async generateQuoteNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `QT-${year}-`;

    const lastQuote = await this.quoteRepository
      .createQueryBuilder('quote')
      .where('quote.quoteNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('quote.quoteNumber', 'DESC')
      .getOne();

    let nextNumber = 1;
    if (lastQuote) {
      const lastNum = parseInt(lastQuote.quoteNumber.replace(prefix, ''), 10);
      nextNumber = lastNum + 1;
    }

    return `${prefix}${String(nextNumber).padStart(6, '0')}`;
  }

  async create(dto: CreateQuoteDto, userId: number): Promise<Quote> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Quote must have at least one item');
    }

    // Validate customer if provided
    if (dto.customerId) {
      const customer = await this.customerRepository.findOne({
        where: { id: dto.customerId },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }
    }

    // Build quote items and calculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    const quoteItems: Partial<QuoteItem>[] = [];

    for (const item of dto.items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId },
      });
      if (!product) {
        throw new NotFoundException(`Product with ID ${item.productId} not found`);
      }

      const unitPrice = product.specialPrice
        ? parseFloat(product.specialPrice.toString())
        : parseFloat(product.price.toString());
      const quantity = item.quantity;
      const lineSubtotal = unitPrice * quantity;

      const discountPercent = item.discountPercent || 0;
      const discountAmount = this.round(lineSubtotal * (discountPercent / 100));
      const lineAfterDiscount = lineSubtotal - discountAmount;
      const lineTax = this.round(lineAfterDiscount * this.TAX_RATE);
      const rowTotal = this.round(lineAfterDiscount + lineTax);

      subtotal += lineSubtotal;
      totalDiscount += discountAmount;

      quoteItems.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        quantity,
        unitPrice,
        discountPercent,
        discountAmount,
        taxAmount: lineTax,
        rowTotal,
      });
    }

    const afterDiscount = subtotal - totalDiscount;
    const taxAmount = this.round(afterDiscount * this.TAX_RATE);
    const grandTotal = this.round(afterDiscount + taxAmount);

    const expiryDays = dto.expiryDays || 14;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const quoteNumber = await this.generateQuoteNumber();

    const quote = this.quoteRepository.create({
      quoteNumber,
      customerId: dto.customerId || null,
      userId,
      subtotal: this.round(subtotal),
      discountAmount: this.round(totalDiscount),
      taxAmount,
      grandTotal,
      status: QuoteStatus.OPEN,
      expiresAt,
      notes: dto.notes || null,
      items: quoteItems as QuoteItem[],
    });

    const savedQuote = await this.quoteRepository.save(quote);

    // Return with relations loaded
    return this.quoteRepository.findOne({
      where: { id: savedQuote.id },
      relations: ['customer', 'user', 'items'],
    }) as Promise<Quote>;
  }

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
