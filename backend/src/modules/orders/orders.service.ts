import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Brackets, WhereExpressionBuilder } from 'typeorm';
import {
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  OrderSyncStatus,
  OrderSource,
} from './entities';
import { Payment, PaymentMethod, PaymentEntityStatus } from '../payments/entities/payment.entity';
import { ProductsService } from '../products/products.service';
import { DiscountsService, UserRole } from '../discounts/discounts.service';
import { DiscountType } from '../discounts/entities';
import { ConfigService } from '@nestjs/config';
import { StoreCreditService } from '../customers/store-credit.service';
import { SyncService } from '../sync/sync.service';

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
    private readonly storeCreditService: StoreCreditService,
    private readonly syncService: SyncService,
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
      // Use the special price if one is set, otherwise the regular price.
      // Must match the POS cart (which uses `specialPrice || price` with no
      // date check) — otherwise the cashier's total and the server's total
      // disagree and the payment check rejects the order.
      const effective =
        product.specialPrice && Number(product.specialPrice) > 0
          ? product.specialPrice
          : product.price;
      return {
        productId: item.productId,
        sku: product.sku,
        name: product.name,
        quantity: item.quantity,
        unitPrice: parseFloat(effective.toString()),
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

    // Verify payment amount. Coerce amounts to Number so a stray string
    // amount doesn't silently concatenate into a bogus total.
    const totalPayments = dto.payments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0,
    );
    if (
      Math.abs(totalPayments - validation.calculatedTotals.grandTotal) > 0.01
    ) {
      const breakdown = dto.payments
        .map((p) => `${p.method}:$${Number(p.amount || 0).toFixed(2)}`)
        .join(', ');
      throw new BadRequestException(
        `Payment amount $${totalPayments.toFixed(2)} does not match order total $${validation.calculatedTotals.grandTotal.toFixed(2)} (${breakdown})`,
      );
    }

    // Store credit validation: if any payment uses store_credit, the order
    // must be linked to a customer and that customer must have enough balance.
    const storeCreditTotal = dto.payments
      .filter((p) => p.method === 'store_credit')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    if (storeCreditTotal > 0) {
      if (!dto.customerId) {
        throw new BadRequestException(
          'Store credit can only be used when a customer is attached to the order',
        );
      }
      await this.storeCreditService.assertSufficientBalance(
        dto.customerId,
        storeCreditTotal,
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
          bank_transfer: PaymentMethod.BANK_TRANSFER,
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

      // Deduct store credit after payments are recorded. Runs inside the
      // same transaction so a failure rolls back the whole order.
      if (storeCreditTotal > 0 && dto.customerId) {
        await this.storeCreditService.redeemForOrder(
          queryRunner.manager,
          dto.customerId,
          storeCreditTotal,
          savedOrder.id,
          userId,
        );
      }

      await queryRunner.commitTransaction();

      // Fire-and-forget push to Magento. Runs in the background so staff
      // aren't blocked by Magento response time. Failures update the
      // order's sync_status and can be retried from the Orders page.
      this.syncService
        .pushOrderToMagentoWithRetry(savedOrder.id)
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error(
            `[pushOrderToMagento] unhandled error for order ${savedOrder.id}:`,
            err,
          );
        });

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
    source?: OrderSource;
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
      source,
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
      // Split on whitespace so "Lisa Davis" matches firstName=Lisa OR lastName=Davis
      const tokens = search.trim().split(/\s+/).filter(Boolean);
      if (tokens.length > 0) {
        query.andWhere(
          new Brackets((qb: WhereExpressionBuilder) => {
            // Full-string match against order number and simple fields
            qb.where('order.orderNumber LIKE :fullSearch', { fullSearch: `%${search}%` })
              .orWhere('order.magentoIncrementId LIKE :fullSearch', { fullSearch: `%${search}%` })
              .orWhere('customer.phone LIKE :fullSearch', { fullSearch: `%${search}%` })
              .orWhere('customer.email LIKE :fullSearch', { fullSearch: `%${search}%` });

            // Per-token match against name + CONCAT fullname (so "lisa davis" matches)
            tokens.forEach((token, idx) => {
              const key = `token${idx}`;
              qb.orWhere(`customer.firstName LIKE :${key}`, { [key]: `%${token}%` })
                .orWhere(`customer.lastName LIKE :${key}`, { [key]: `%${token}%` });
            });

            qb.orWhere(
              "CONCAT(customer.firstName, ' ', customer.lastName) LIKE :fullSearch",
              { fullSearch: `%${search}%` },
            );
          }),
        );
      }
    }

    if (status) {
      query.andWhere('order.status = :status', { status });
    }

    if (source) {
      query.andWhere('order.source = :source', { source });
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

  /**
   * Link a customer to an existing order. Used to attach a buyer to a
   * walk-in order so staff can issue store credit on a refund.
   */
  async linkCustomer(orderId: number, customerId: number): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new BadRequestException('Order not found');
    }
    order.customerId = customerId;
    await this.orderRepository.save(order);
    return (await this.findById(orderId)) as Order;
  }
}
