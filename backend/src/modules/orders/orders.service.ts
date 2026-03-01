import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  OrderSyncStatus,
} from './entities';
import { Payment, PaymentMethod, PaymentEntityStatus } from '../payments/entities/payment.entity';
import { ProductsService } from '../products/products.service';
import { DiscountsService, UserRole } from '../discounts/discounts.service';
import { DiscountType } from '../discounts/entities';
import { ConfigService } from '@nestjs/config';

interface CreateOrderDto {
  customerId?: number;
  items: Array<{
    productId: number;
    quantity: number;
    discountPercent?: number;
  }>;
  cartDiscount?: {
    type: 'percent' | 'fixed';
    value: number;
    reason?: string;
  };
  payments: Array<{
    method: string;
    amount: number;
    reference?: string;
    amountTendered?: number;
  }>;
  notes?: string;
}

@Injectable()
export class OrdersService {
  private readonly taxRate: number;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    private readonly productsService: ProductsService,
    private readonly discountsService: DiscountsService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.taxRate = parseFloat(
      this.configService.get<string>('TAX_RATE', '0.10'),
    );
  }

  async create(
    dto: CreateOrderDto,
    userId: number,
    userRole: UserRole,
  ): Promise<Order> {
    // Fetch products
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.productsService.findByIds(productIds);

    // Build cart items for validation
    const cartItems = dto.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        throw new BadRequestException(
          `Product ${item.productId} not found`,
        );
      }
      return {
        productId: item.productId,
        sku: product.sku,
        name: product.name,
        quantity: item.quantity,
        unitPrice: parseFloat(product.price.toString()),
        discountPercent: item.discountPercent,
      };
    });

    // Validate discounts
    const validation = this.discountsService.validateAndCalculate(
      { items: cartItems, cartDiscount: dto.cartDiscount },
      userRole,
    );

    if (!validation.isValid) {
      throw new BadRequestException({
        code: 'DISCOUNT_VALIDATION_FAILED',
        message: 'Discount validation failed',
        errors: validation.errors,
      });
    }

    // Check stock
    for (const item of dto.items) {
      const product = products.find((p) => p.id === item.productId);
      if (product && product.manageStock && product.stockQty < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${product.name}. Available: ${product.stockQty}`,
        );
      }
    }

    // Verify payment amount
    const totalPayments = dto.payments.reduce((sum, p) => sum + p.amount, 0);
    if (
      Math.abs(totalPayments - validation.calculatedTotals.grandTotal) > 0.01
    ) {
      throw new BadRequestException(
        `Payment amount $${totalPayments.toFixed(2)} does not match order total $${validation.calculatedTotals.grandTotal.toFixed(2)}`,
      );
    }

    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    // Create order in transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create order
      const order = queryRunner.manager.create(Order, {
        orderNumber,
        customerId: dto.customerId || null,
        userId,
        subtotal: validation.calculatedTotals.subtotal,
        discountAmount: validation.calculatedTotals.totalDiscount,
        taxAmount: validation.calculatedTotals.taxAmount,
        grandTotal: validation.calculatedTotals.grandTotal,
        taxRate: this.taxRate,
        status: OrderStatus.COMPLETE,
        paymentStatus: PaymentStatus.PAID,
        syncStatus: OrderSyncStatus.PENDING,
        notes: dto.notes || null,
      });

      const savedOrder = await queryRunner.manager.save(order);

      // Create order items
      for (const calcItem of validation.calculatedTotals.items) {
        const product = products.find((p) => p.id === calcItem.productId);
        const orderItem = queryRunner.manager.create(OrderItem, {
          orderId: savedOrder.id,
          productId: calcItem.productId,
          sku: product?.sku || calcItem.sku,
          name: product?.name || calcItem.name,
          quantity: calcItem.quantity,
          unitPrice: calcItem.unitPrice,
          discountPercent: calcItem.discountPercent,
          discountAmount: calcItem.discountAmount,
          taxAmount: calcItem.taxAmount,
          rowTotal: calcItem.rowTotal,
          costPrice: product?.cost || null,
        });
        await queryRunner.manager.save(orderItem);

        // Log product discount if applied
        if (calcItem.discountPercent > 0) {
          await this.discountsService.logAppliedDiscount(
            savedOrder.id,
            orderItem.id,
            userId,
            userRole.name,
            DiscountType.PRODUCT,
            calcItem.discountPercent,
            calcItem.discountAmount,
            calcItem.unitPrice * calcItem.quantity,
            calcItem.rowTotal,
            dto.cartDiscount ? true : false,
          );
        }

        // Update stock
        if (product) {
          await queryRunner.manager.update(
            'products',
            { id: product.id },
            {
              stockQty: () => `stock_qty - ${calcItem.quantity}`,
              isInStock: () =>
                `CASE WHEN stock_qty - ${calcItem.quantity} > 0 THEN 1 ELSE 0 END`,
            },
          );
        }
      }

      // Log cart discount if applied
      if (dto.cartDiscount && dto.cartDiscount.value > 0) {
        await this.discountsService.logAppliedDiscount(
          savedOrder.id,
          null,
          userId,
          userRole.name,
          DiscountType.CART,
          dto.cartDiscount.type === 'percent' ? dto.cartDiscount.value : 0,
          validation.calculatedTotals.cartDiscount,
          validation.calculatedTotals.subtotal -
            validation.calculatedTotals.itemDiscounts,
          validation.calculatedTotals.grandTotal,
          validation.calculatedTotals.itemDiscounts > 0,
          dto.cartDiscount.reason,
        );
      }

      // Save payments
      for (const paymentData of dto.payments) {
        const methodMap: Record<string, PaymentMethod> = {
          cash: PaymentMethod.CASH,
          eftpos: PaymentMethod.EFTPOS,
          credit_card: PaymentMethod.CREDIT_CARD,
          store_credit: PaymentMethod.STORE_CREDIT,
          other: PaymentMethod.OTHER,
        };

        const payment = queryRunner.manager.create(Payment, {
          orderId: savedOrder.id,
          userId,
          method: methodMap[paymentData.method] || PaymentMethod.OTHER,
          amount: paymentData.amount,
          reference: paymentData.reference || null,
          amountTendered: paymentData.amountTendered || null,
          changeGiven: paymentData.amountTendered
            ? paymentData.amountTendered - paymentData.amount
            : null,
          status: PaymentEntityStatus.COMPLETED,
        });
        await queryRunner.manager.save(payment);
      }

      await queryRunner.commitTransaction();

      return this.findById(savedOrder.id) as Promise<Order>;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(options?: {
    status?: OrderStatus;
    search?: string;
    userId?: number;
    customerId?: number;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ orders: Order[]; total: number }> {
    const {
      status,
      search,
      userId,
      customerId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = options || {};

    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.items', 'items');

    if (search) {
      query.andWhere(
        '(order.orderNumber LIKE :search OR customer.firstName LIKE :search OR customer.lastName LIKE :search OR customer.phone LIKE :search OR customer.email LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      query.andWhere('order.status = :status', { status });
    }

    if (userId) {
      query.andWhere('order.userId = :userId', { userId });
    }

    if (customerId) {
      query.andWhere('order.customerId = :customerId', { customerId });
    }

    if (dateFrom) {
      query.andWhere('order.createdAt >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      query.andWhere('order.createdAt <= :dateTo', { dateTo });
    }

    const [orders, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('order.createdAt', 'DESC')
      .getManyAndCount();

    return { orders, total };
  }

  async findById(id: number): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { id },
      relations: ['customer', 'user', 'items', 'payments'],
    });
  }

  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `POS-${year}-`;

    // Get last order number for this year
    const lastOrder = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.orderNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('order.id', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(
        lastOrder.orderNumber.replace(prefix, ''),
        10,
      );
      sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(6, '0')}`;
  }
}
