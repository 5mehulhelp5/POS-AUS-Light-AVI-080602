import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Brackets, WhereExpressionBuilder } from 'typeorm';
import {
  Order,
  OrderItem,
  OrderStatus,
  OrderType,
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
import { SettingsService } from '../settings/settings.service';

interface CreateOrderDto {
  customerId?: number;
  items: Array<{
    productId: number;
    quantity: number;
    discountPercent?: number;
    // Mark a line as a backorder. Skips the stock availability check and
    // doesn't deduct inventory. Stock is decremented when the manager
    // marks the item as fulfilled.
    isBackorder?: boolean;
    // Mark a line as held by the store on a layby. Stock IS deducted
    // (reserved) but the customer doesn't take the item home until the
    // layby balance is paid in full. Enables a single order to mix
    // take-now items with layby-held items.
    isLaybyHeld?: boolean;
    // Manual unit price override. Honoured only for backorder lines —
    // catalogue items must be sold at their DB price (use discountPercent
    // for adjustments instead).
    unitPrice?: number;
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
  // Layby options. When `orderType === 'layby'`, the sum of payments
  // is treated as a deposit rather than the full grand total. The
  // remainder is owed by the customer and collected via
  // `takeLaybyPayment`. `laybyExpiresAt` is when the balance must be
  // paid by; defaults to now + laybyMaxDays (settings).
  orderType?: 'standard' | 'layby';
  laybyExpiresAt?: string;
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
    private readonly settingsService: SettingsService,
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
      // For backorder lines, let the cashier override the unit price —
      // catalogue price may be $0 (new SKU, pre-order) or out of date.
      // Non-backorder lines must use the catalogue price; cashiers have
      // the discount flow for adjustments.
      const resolvedUnitPrice =
        item.isBackorder &&
        item.unitPrice != null &&
        Number(item.unitPrice) >= 0
          ? Number(item.unitPrice)
          : parseFloat(effective.toString());
      return {
        productId: item.productId,
        sku: product.sku,
        name: product.name,
        quantity: item.quantity,
        unitPrice: resolvedUnitPrice,
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

    // Check stock. Skip backorder lines — those are explicitly allowed to
    // exceed available stock and stock isn't deducted until fulfilment.
    const isBackorderByProductId = new Map<number, boolean>();
    const isLaybyHeldByProductId = new Map<number, boolean>();
    for (const item of dto.items) {
      isBackorderByProductId.set(item.productId, !!item.isBackorder);
      isLaybyHeldByProductId.set(item.productId, !!item.isLaybyHeld);
      if (item.isBackorder) continue;
      const product = products.find((p) => p.id === item.productId);
      if (product && product.manageStock && product.stockQty < item.quantity) {
        // Include the isBackorder flag we received in the error so it's
        // obvious whether the issue is "not ticked" vs "backend on stale
        // code" vs "flag got lost in transit".
        throw new BadRequestException(
          `Insufficient stock for ${product.name}. Available: ${product.stockQty}. ` +
          `(isBackorder flag received from client: ${JSON.stringify(item.isBackorder)})`,
        );
      }
    }

    // Figure out what kind of order this is and how much the customer must
    // actually pay now. Any line flagged isLaybyHeld turns the whole
    // order into a layby; any backorder line flags the order as
    // backorder-pending; both can coexist on the same order.
    const hasBackorder = Array.from(isBackorderByProductId.values()).some(
      (b) => b,
    );
    const hasLaybyHeld = Array.from(isLaybyHeldByProductId.values()).some(
      (b) => b,
    );
    const isLayby = dto.orderType === 'layby' || hasLaybyHeld;
    const grandTotal = validation.calculatedTotals.grandTotal;

    // One-line breadcrumb so we can see in pm2 logs whether the layby flag
    // and backorder flags actually reached the server. Cheap and helpful
    // next time someone reports "it didn't work".
    // eslint-disable-next-line no-console
    console.log(
      `[orders.create] type=${dto.orderType || 'standard'} isLayby=${isLayby} hasBackorder=${hasBackorder} grandTotal=${grandTotal} payments=${dto.payments.length}`,
    );

    // Laybys require a linked customer — without one, there's no way to
    // track the balance or release credits on cancellation.
    if (isLayby && !dto.customerId) {
      throw new BadRequestException(
        'Layby orders must be linked to a customer',
      );
    }

    // Verify payment amount. Standard orders must pay the full grand
    // total; laybys must pay at least the configured deposit percent
    // (default 20%). Coerce amounts to Number so a stray string
    // amount doesn't silently concatenate into a bogus total.
    const totalPayments = dto.payments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0,
    );

    // Deposit-based orders: laybys OR any order with backorder items let
    // the customer pay a deposit now (>= 20% of the deferred portion)
    // with balance collected later. Take-now lines must be paid in
    // full at the register; held / backorder lines only need their 20%
    // share now.
    const isDepositOrder = isLayby || hasBackorder;
    if (isDepositOrder) {
      // Resolve the min deposit percent from settings (same 20% default
      // for both layby and backorder).
      const minPercent = Number(
        (await this.settingsService.getValue<number | string>(
          isLayby ? 'layby_min_deposit_percent' : 'backorder_min_deposit_percent',
          20,
        )) || 20,
      );

      // Minimum deposit is a flat percentage of the whole order total
      // (covers take-now AND deferred items together). Cashier can
      // collect more, even the full amount, but never less without a
      // manager override.
      const minDeposit =
        Math.round((grandTotal * minPercent) / 100 * 100) / 100;

      const depositOverridden = !!userRole && [
        'admin',
        'manager',
      ].includes(userRole.name);
      const label = hasLaybyHeld
        ? 'Mixed Lay By'
        : isLayby
          ? 'Layby'
          : 'Backorder';
      if (totalPayments + 0.01 < minDeposit && !depositOverridden) {
        throw new BadRequestException(
          `${label} deposit of $${totalPayments.toFixed(2)} is below the ${minPercent}% minimum ($${minDeposit.toFixed(2)} of $${grandTotal.toFixed(2)}). A manager can override.`,
        );
      }
      if (totalPayments > grandTotal + 0.01) {
        throw new BadRequestException(
          `${label} deposit $${totalPayments.toFixed(2)} exceeds the order total $${grandTotal.toFixed(2)}`,
        );
      }
    } else if (Math.abs(totalPayments - grandTotal) > 0.01) {
      const breakdown = dto.payments
        .map((p) => `${p.method}:$${Number(p.amount || 0).toFixed(2)}`)
        .join(', ');
      throw new BadRequestException(
        `Payment amount $${totalPayments.toFixed(2)} does not match order total $${grandTotal.toFixed(2)} (${breakdown})`,
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

    // Pick the right status/payment-status combo for this order.
    // Laybys sit in LAYBY_ACTIVE until fully paid.
    // Orders containing backorder items sit in BACKORDER_PENDING until every
    // line is fulfilled.
    // Everything else completes immediately.
    let initialStatus: OrderStatus;
    if (isLayby) {
      initialStatus = OrderStatus.LAYBY_ACTIVE;
    } else if (hasBackorder) {
      initialStatus = OrderStatus.BACKORDER_PENDING;
    } else {
      initialStatus = OrderStatus.COMPLETE;
    }
    // Deposit orders (layby OR backorder with deposit-only) sit in
    // PARTIAL until the balance is paid. A backorder order that was
    // paid in full can still go straight to PAID.
    let initialPaymentStatus: PaymentStatus;
    if (isDepositOrder && totalPayments + 0.01 < grandTotal) {
      initialPaymentStatus =
        totalPayments > 0 ? PaymentStatus.PARTIAL : PaymentStatus.PENDING;
    } else {
      initialPaymentStatus = PaymentStatus.PAID;
    }

    // Compute layby expiry from settings unless the caller supplied one.
    let laybyExpiresAt: Date | null = null;
    if (isLayby) {
      if (dto.laybyExpiresAt) {
        laybyExpiresAt = new Date(dto.laybyExpiresAt);
      } else {
        const maxDays = Number(
          (await this.settingsService.getValue<number | string>(
            'layby_max_days',
            90,
          )) || 90,
        );
        laybyExpiresAt = new Date(Date.now() + maxDays * 24 * 60 * 60 * 1000);
      }
    }

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
        grandTotal,
        taxRate: this.taxRate,
        status: initialStatus,
        paymentStatus: initialPaymentStatus,
        syncStatus: OrderSyncStatus.PENDING,
        notes: dto.notes || null,
        orderType: isLayby ? OrderType.LAYBY : OrderType.STANDARD,
        laybyExpiresAt,
      });

      const savedOrder = await queryRunner.manager.save(order);

      // Create order items
      for (const calcItem of validation.calculatedTotals.items) {
        const product = products.find((p) => p.id === calcItem.productId);
        const lineIsBackorder = !!isBackorderByProductId.get(calcItem.productId);
        const lineIsLaybyHeld = !!isLaybyHeldByProductId.get(calcItem.productId);
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
          isBackorder: lineIsBackorder,
          isLaybyHeld: lineIsLaybyHeld,
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

        // Update stock — except for backorder lines (not yet in hand) and
        // layby orders (stock is held on paper but we still decrement so
        // it's reserved against other sales).
        if (product && !lineIsBackorder) {
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
      //
      // Laybys don't push until they're fully paid (handled in
      // completeLayby). Backorder orders DO push — Magento tracks them as
      // a regular order with a note that items are on backorder.
      if (!isLayby) {
        this.syncService
          .pushOrderToMagentoWithRetry(savedOrder.id)
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error(
              `[pushOrderToMagento] unhandled error for order ${savedOrder.id}:`,
              err,
            );
          });
      }

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
    orderType?: OrderType;
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
      orderType,
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

    if (orderType) {
      query.andWhere('order.orderType = :orderType', { orderType });
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
    // Short, readable invoice number — POS-NNNN. Drops the year and
    // padding from 6 digits to 4 to keep printed invoices compact.
    // Sequence comes from the highest existing POS-* number so we
    // don't collide with existing orders that used the longer format.
    const prefix = 'POS-';

    const lastOrder = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.orderNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('order.id', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastOrder) {
      // Pull the trailing run of digits — works for both the new
      // POS-0007 format and the legacy POS-2026-000007 format.
      const match = lastOrder.orderNumber.match(/(\d+)$/);
      if (match) sequence = parseInt(match[1], 10) + 1;
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
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

  // -------------------------------------------------------------------
  // Layby + backorder helpers
  // -------------------------------------------------------------------

  /**
   * Sum of every completed payment against an order. Used to compute
   * layby balance due = grandTotal - paid.
   */
  private async sumPaidForOrder(orderId: number): Promise<number> {
    const row = await this.dataSource
      .createQueryBuilder(Payment, 'p')
      .where('p.orderId = :orderId', { orderId })
      .andWhere('p.status = :status', { status: PaymentEntityStatus.COMPLETED })
      .select('COALESCE(SUM(p.amount), 0)', 'total')
      .getRawOne();
    return Number(row?.total || 0);
  }

  async getLaybyBalance(orderId: number): Promise<{
    grandTotal: number;
    paid: number;
    balance: number;
  }> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) throw new BadRequestException('Order not found');
    const grandTotal = Number(order.grandTotal);
    const paid = await this.sumPaidForOrder(orderId);
    const balance = Math.max(0, Math.round((grandTotal - paid) * 100) / 100);
    return { grandTotal, paid, balance };
  }

  /**
   * Record a balance-due payment against an open order. Works for
   * laybys (active or expired) and backorder-pending orders — both
   * flows are "deposit now, rest later". When the balance reaches 0:
   *   - Laybys complete immediately and push to Magento.
   *   - Backorder orders only complete if every backorder line is
   *     already fulfilled; otherwise paymentStatus flips to PAID but
   *     the order stays BACKORDER_PENDING until stock arrives.
   */
  async takeLaybyPayment(
    orderId: number,
    userId: number,
    dto: {
      amount: number;
      method: string;
      reference?: string;
      amountTendered?: number;
    },
  ): Promise<Order> {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order) throw new BadRequestException('Order not found');
    const isLaybyOrder = order.orderType === OrderType.LAYBY;
    const isBackorderPending = order.status === OrderStatus.BACKORDER_PENDING;
    if (
      !isLaybyOrder &&
      !isBackorderPending &&
      order.status !== OrderStatus.LAYBY_ACTIVE &&
      order.status !== OrderStatus.LAYBY_EXPIRED
    ) {
      throw new BadRequestException(
        `Cannot take balance payment on an order with status "${order.status}"`,
      );
    }

    const { balance } = await this.getLaybyBalance(orderId);
    const toApply = Math.min(Number(dto.amount), balance);
    if (toApply <= 0) {
      throw new BadRequestException('Layby balance is already paid in full');
    }

    const methodMap: Record<string, PaymentMethod> = {
      cash: PaymentMethod.CASH,
      eftpos: PaymentMethod.EFTPOS,
      credit_card: PaymentMethod.CREDIT_CARD,
      bank_transfer: PaymentMethod.BANK_TRANSFER,
      store_credit: PaymentMethod.STORE_CREDIT,
      other: PaymentMethod.OTHER,
    };
    const paymentMethod = methodMap[dto.method] || PaymentMethod.OTHER;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // If paying with store credit, verify the customer has the balance
      // and deduct from it inside the same transaction.
      if (paymentMethod === PaymentMethod.STORE_CREDIT) {
        if (!order.customerId) {
          throw new BadRequestException(
            'Store credit payments need a linked customer',
          );
        }
        await this.storeCreditService.assertSufficientBalance(
          order.customerId,
          toApply,
        );
      }

      const payment = queryRunner.manager.create(Payment, {
        orderId: order.id,
        userId,
        method: paymentMethod,
        amount: toApply,
        reference: dto.reference || null,
        amountTendered: dto.amountTendered || null,
        changeGiven: dto.amountTendered
          ? dto.amountTendered - toApply
          : null,
        status: PaymentEntityStatus.COMPLETED,
      });
      await queryRunner.manager.save(payment);

      if (paymentMethod === PaymentMethod.STORE_CREDIT && order.customerId) {
        await this.storeCreditService.redeemForOrder(
          queryRunner.manager,
          order.customerId,
          toApply,
          order.id,
          userId,
        );
      }

      // Check if the order is now fully paid.
      const newPaid = await queryRunner.manager
        .createQueryBuilder(Payment, 'p')
        .where('p.orderId = :orderId', { orderId: order.id })
        .andWhere('p.status = :status', {
          status: PaymentEntityStatus.COMPLETED,
        })
        .select('COALESCE(SUM(p.amount), 0)', 'total')
        .getRawOne();
      const paidTotal = Number(newPaid?.total || 0);
      const grandTotal = Number(order.grandTotal);
      const isFullyPaid = paidTotal + 0.01 >= grandTotal;

      // Backorder orders can't complete until every backorder line is
      // fulfilled (stock has arrived). They just go to PAID.
      const hasOutstandingBackorder = (order.items || []).some(
        (i) => i.isBackorder && !i.backorderFulfilledAt,
      );

      if (isFullyPaid) {
        order.paymentStatus = PaymentStatus.PAID;
        if (!hasOutstandingBackorder) {
          order.status = OrderStatus.COMPLETE;
        }
      } else {
        order.paymentStatus = PaymentStatus.PARTIAL;
      }
      await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();

      // Push to Magento only when the order is actually complete. For
      // laybys that means fully paid; for backorder orders that means
      // fully paid AND all stock arrived.
      if (isFullyPaid && !hasOutstandingBackorder && isLaybyOrder) {
        this.syncService
          .pushOrderToMagentoWithRetry(order.id)
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error(
              `[pushOrderToMagento] layby ${order.id}:`,
              err,
            );
          });
      }

      return (await this.findById(order.id)) as Order;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Cancel an active layby. Releases reserved stock back to inventory.
   * `refundAsStoreCredit` — return the deposit(s) to the customer as
   * store credit. `forfeitDeposit` — keep the deposit (admin option,
   * e.g. after no-show + expiry).
   */
  async cancelLayby(
    orderId: number,
    userId: number,
    opts: { reason?: string; refundAsStoreCredit?: boolean } = {},
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order) throw new BadRequestException('Order not found');
    if (order.orderType !== OrderType.LAYBY) {
      throw new BadRequestException('Order is not a layby');
    }
    if (
      order.status !== OrderStatus.LAYBY_ACTIVE &&
      order.status !== OrderStatus.LAYBY_EXPIRED
    ) {
      throw new BadRequestException(
        `Cannot cancel layby with status "${order.status}"`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Release stock for items the store is still holding. Backorder
      // lines never took stock (so nothing to release). For mixed
      // orders, take-now lines have already been handed to the
      // customer — we can't reclaim their stock on cancel. Only the
      // isLaybyHeld lines (and, for pure legacy laybys with no per-line
      // flags, all non-backorder lines) get released.
      const isPureLegacyLayby = !order.items.some((i) => i.isLaybyHeld);
      for (const item of order.items) {
        if (!item.productId || item.isBackorder) continue;
        const shouldReleaseStock = isPureLegacyLayby || item.isLaybyHeld;
        if (!shouldReleaseStock) continue;
        await queryRunner.manager.update(
          'products',
          { id: item.productId },
          {
            stockQty: () => `stock_qty + ${item.quantity}`,
            isInStock: () => `1`,
          },
        );
      }

      // Optionally issue store credit for what was paid.
      if (opts.refundAsStoreCredit && order.customerId) {
        const paid = await this.sumPaidForOrder(order.id);
        if (paid > 0) {
          await this.storeCreditService.issueFromRefund(
            queryRunner.manager,
            order.customerId,
            paid,
            order.id, // using orderId as a related ref since there's no Refund row
            userId,
          );
        }
      }

      order.status = OrderStatus.CANCELLED;
      order.notes = [order.notes, opts.reason ? `Cancelled: ${opts.reason}` : null]
        .filter(Boolean)
        .join('\n');
      await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();
      return (await this.findById(order.id)) as Order;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Mark any active laybys whose expiry has passed as LAYBY_EXPIRED so
   * they surface on the list for admin review. Intended to be called on
   * a schedule or on demand. Returns the number of orders touched.
   */
  async expireLaybys(): Promise<number> {
    const result = await this.orderRepository
      .createQueryBuilder()
      .update(Order)
      .set({ status: OrderStatus.LAYBY_EXPIRED })
      .where('orderType = :type', { type: OrderType.LAYBY })
      .andWhere('status = :status', { status: OrderStatus.LAYBY_ACTIVE })
      .andWhere('laybyExpiresAt IS NOT NULL')
      .andWhere('laybyExpiresAt < :now', { now: new Date() })
      .execute();
    return result.affected || 0;
  }

  /**
   * Mark one or more backorder line items as fulfilled (stock arrived).
   * Decrements stock and, if every backorder line on the order is now
   * fulfilled, transitions the order from BACKORDER_PENDING to COMPLETE.
   */
  async fulfillBackorderItems(
    orderId: number,
    itemIds: number[],
  ): Promise<Order> {
    if (!itemIds || itemIds.length === 0) {
      throw new BadRequestException('No items to fulfil');
    }
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order) throw new BadRequestException('Order not found');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (const id of itemIds) {
        const item = order.items.find((i) => i.id === id);
        if (!item) {
          throw new BadRequestException(`Item ${id} is not on this order`);
        }
        if (!item.isBackorder) {
          throw new BadRequestException(
            `Item ${id} is not flagged as a backorder`,
          );
        }
        if (item.backorderFulfilledAt) {
          continue; // already fulfilled
        }
        item.backorderFulfilledAt = new Date();
        await queryRunner.manager.save(item);

        if (item.productId) {
          await queryRunner.manager.update(
            'products',
            { id: item.productId },
            {
              stockQty: () => `stock_qty - ${item.quantity}`,
              isInStock: () =>
                `CASE WHEN stock_qty - ${item.quantity} > 0 THEN 1 ELSE 0 END`,
            },
          );
        }
      }

      // If everything is now fulfilled AND the balance is paid, flip
      // the order to COMPLETE and push it to Magento. If the customer
      // still owes money, keep the order PENDING so the cashier can
      // collect the balance via Take Payment before closing it out.
      const refreshed = await queryRunner.manager.findOne(Order, {
        where: { id: orderId },
        relations: ['items'],
      });
      const outstanding =
        refreshed?.items?.some(
          (i) => i.isBackorder && !i.backorderFulfilledAt,
        ) ?? false;
      if (!outstanding && refreshed) {
        const paidRow = await queryRunner.manager
          .createQueryBuilder(Payment, 'p')
          .where('p.orderId = :orderId', { orderId })
          .andWhere('p.status = :status', {
            status: PaymentEntityStatus.COMPLETED,
          })
          .select('COALESCE(SUM(p.amount), 0)', 'total')
          .getRawOne();
        const paidTotal = Number(paidRow?.total || 0);
        const grandTotal = Number(refreshed.grandTotal);
        const balanceOwed = paidTotal + 0.01 < grandTotal;
        if (!balanceOwed) {
          refreshed.status = OrderStatus.COMPLETE;
          refreshed.paymentStatus = PaymentStatus.PAID;
        }
        await queryRunner.manager.save(refreshed);
      }

      await queryRunner.commitTransaction();
      return (await this.findById(order.id)) as Order;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
