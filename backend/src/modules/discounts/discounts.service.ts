import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscountAuditLog, DiscountType } from './entities';
import {
  ValidateDiscountDto,
  CartItemDto,
  CartDiscountDto,
} from './dto/validate-discount.dto';
import { ConfigService } from '@nestjs/config';

export interface DiscountValidationResult {
  isValid: boolean;
  errors: DiscountError[];
  warnings: string[];
  calculatedTotals: CalculatedTotals;
  auditEntries: AuditEntry[];
}

export interface DiscountError {
  code: string;
  message: string;
  field?: string;
  attemptedValue?: number;
  maxAllowed?: number;
}

export interface CalculatedItem {
  productId: number;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxAmount: number;
  rowTotal: number;
}

export interface CalculatedTotals {
  items: CalculatedItem[];
  subtotal: number;
  itemDiscounts: number;
  cartDiscount: number;
  totalDiscount: number;
  taxAmount: number;
  grandTotal: number;
}

export interface AuditEntry {
  type: DiscountType;
  productId?: number;
  attemptedPercent: number;
  wasRejected: boolean;
  rejectionReason?: string;
}

export interface UserRole {
  id: number;
  name: string;
  maxDiscountPercent: number;
  canStackDiscounts: boolean;
}

@Injectable()
export class DiscountsService {
  private readonly logger = new Logger(DiscountsService.name);
  private readonly taxRate: number;

  constructor(
    @InjectRepository(DiscountAuditLog)
    private readonly auditLogRepository: Repository<DiscountAuditLog>,
    private readonly configService: ConfigService,
  ) {
    this.taxRate = parseFloat(
      this.configService.get<string>('TAX_RATE', '0.10'),
    );
  }

  /**
   * Main validation function - enforces all discount rules
   */
  validateAndCalculate(
    dto: ValidateDiscountDto,
    userRole: UserRole,
  ): DiscountValidationResult {
    const errors: DiscountError[] = [];
    const warnings: string[] = [];
    const auditEntries: AuditEntry[] = [];

    // Step 1: Validate individual product discounts
    for (const item of dto.items) {
      if (item.discountPercent && item.discountPercent > 0) {
        const validation = this.validateProductDiscount(
          item.discountPercent,
          userRole,
        );

        if (!validation.isValid) {
          errors.push({
            code: 'DISCOUNT_EXCEEDS_LIMIT',
            message: `Product discount of ${item.discountPercent}% exceeds your maximum of ${userRole.maxDiscountPercent}%`,
            field: `items.${item.productId}.discountPercent`,
            attemptedValue: item.discountPercent,
            maxAllowed: userRole.maxDiscountPercent,
          });

          auditEntries.push({
            type: DiscountType.PRODUCT,
            productId: item.productId,
            attemptedPercent: item.discountPercent,
            wasRejected: true,
            rejectionReason: 'EXCEEDS_ROLE_LIMIT',
          });
        }
      }
    }

    // Step 2: Validate cart-level discount
    if (dto.cartDiscount && dto.cartDiscount.value > 0) {
      if (dto.cartDiscount.type === 'percent') {
        const validation = this.validateCartDiscount(
          dto.cartDiscount.value,
          userRole,
        );

        if (!validation.isValid) {
          errors.push({
            code: 'DISCOUNT_EXCEEDS_LIMIT',
            message: `Cart discount of ${dto.cartDiscount.value}% exceeds your maximum of ${userRole.maxDiscountPercent}%`,
            field: 'cartDiscount.value',
            attemptedValue: dto.cartDiscount.value,
            maxAllowed: userRole.maxDiscountPercent,
          });

          auditEntries.push({
            type: DiscountType.CART,
            attemptedPercent: dto.cartDiscount.value,
            wasRejected: true,
            rejectionReason: 'EXCEEDS_ROLE_LIMIT',
          });
        }
      }
    }

    // Step 3: Check stacking rules
    const hasProductDiscounts = dto.items.some(
      (item) => item.discountPercent && item.discountPercent > 0,
    );
    const hasCartDiscount =
      dto.cartDiscount && dto.cartDiscount.value > 0;

    if (hasProductDiscounts && hasCartDiscount) {
      if (!userRole.canStackDiscounts) {
        errors.push({
          code: 'STACKING_NOT_ALLOWED',
          message:
            'Your role does not allow combining product and cart discounts',
          field: 'cartDiscount',
        });

        auditEntries.push({
          type: DiscountType.CART,
          attemptedPercent: dto.cartDiscount?.value || 0,
          wasRejected: true,
          rejectionReason: 'STACKING_NOT_ALLOWED',
        });
      }
    }

    // Step 4: Calculate totals
    const calculatedTotals = this.calculateCartTotals(
      dto.items,
      dto.cartDiscount,
      errors.length > 0, // If errors, calculate without discounts
    );

    // Step 5: Add warnings for high discounts
    const totalDiscountPercent = this.calculateEffectiveDiscountPercent(
      dto.items,
      dto.cartDiscount,
    );

    if (totalDiscountPercent > 15 && errors.length === 0) {
      warnings.push(
        `High discount alert: Effective discount is ${totalDiscountPercent.toFixed(1)}%`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      calculatedTotals,
      auditEntries,
    };
  }

  /**
   * Validate a product-level discount against role limits
   */
  private validateProductDiscount(
    discountPercent: number,
    userRole: UserRole,
  ): { isValid: boolean } {
    // Rule 1: Cannot be negative
    if (discountPercent < 0) {
      return { isValid: false };
    }

    // Rule 2: Cannot exceed 100%
    if (discountPercent > 100) {
      return { isValid: false };
    }

    // Rule 3: Must be within role's limit
    if (discountPercent > userRole.maxDiscountPercent) {
      return { isValid: false };
    }

    return { isValid: true };
  }

  /**
   * Validate a cart-level discount against role limits
   */
  private validateCartDiscount(
    discountPercent: number,
    userRole: UserRole,
  ): { isValid: boolean } {
    return this.validateProductDiscount(discountPercent, userRole);
  }

  /**
   * Calculate cart totals with discounts applied
   */
  calculateCartTotals(
    items: CartItemDto[],
    cartDiscount: CartDiscountDto | undefined,
    ignoreDiscounts: boolean = false,
  ): CalculatedTotals {
    let subtotal = 0;
    let itemDiscountTotal = 0;
    const calculatedItems: CalculatedItem[] = [];

    for (const item of items) {
      const lineSubtotal = item.unitPrice * item.quantity;
      subtotal += lineSubtotal;

      let discountAmount = 0;
      let discountPercent = 0;

      if (!ignoreDiscounts && item.discountPercent) {
        discountPercent = item.discountPercent;
        discountAmount = lineSubtotal * (discountPercent / 100);
        itemDiscountTotal += discountAmount;
      }

      const lineTotal = lineSubtotal - discountAmount;
      const lineTax = lineTotal * this.taxRate;

      calculatedItems.push({
        productId: item.productId,
        sku: item.sku || '',
        name: item.name || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: ignoreDiscounts ? 0 : discountPercent,
        discountAmount: this.round(discountAmount),
        taxAmount: this.round(lineTax),
        rowTotal: this.round(lineTotal + lineTax),
      });
    }

    // Apply cart discount to subtotal after item discounts
    const afterItemDiscounts = subtotal - itemDiscountTotal;
    let cartDiscountAmount = 0;

    if (!ignoreDiscounts && cartDiscount && cartDiscount.value > 0) {
      if (cartDiscount.type === 'percent') {
        cartDiscountAmount = afterItemDiscounts * (cartDiscount.value / 100);
      } else {
        // Fixed amount discount
        cartDiscountAmount = Math.min(cartDiscount.value, afterItemDiscounts);
      }
    }

    const totalAfterDiscounts = afterItemDiscounts - cartDiscountAmount;
    const taxAmount = totalAfterDiscounts * this.taxRate;
    const grandTotal = totalAfterDiscounts + taxAmount;

    return {
      items: calculatedItems,
      subtotal: this.round(subtotal),
      itemDiscounts: this.round(itemDiscountTotal),
      cartDiscount: this.round(cartDiscountAmount),
      totalDiscount: this.round(itemDiscountTotal + cartDiscountAmount),
      taxAmount: this.round(taxAmount),
      grandTotal: this.round(grandTotal),
    };
  }

  /**
   * Calculate the effective total discount percentage
   */
  private calculateEffectiveDiscountPercent(
    items: CartItemDto[],
    cartDiscount: CartDiscountDto | undefined,
  ): number {
    const subtotal = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    if (subtotal === 0) return 0;

    const totals = this.calculateCartTotals(items, cartDiscount, false);
    return (totals.totalDiscount / subtotal) * 100;
  }

  /**
   * Round to 2 decimal places
   */
  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Log discount audit entries to database
   */
  async logDiscountAudit(
    orderId: number | null,
    userId: number,
    userRole: string,
    auditEntries: AuditEntry[],
    reason?: string,
  ): Promise<void> {
    for (const entry of auditEntries) {
      try {
        await this.auditLogRepository.save({
          orderId,
          userId,
          userRole,
          discountType: entry.type,
          discountPercent: entry.attemptedPercent,
          discountAmount: 0, // Will be filled when actual discount applied
          originalAmount: 0,
          finalAmount: 0,
          wasRejected: entry.wasRejected,
          rejectionReason: entry.rejectionReason || null,
          reason: reason || null,
        });
      } catch (error) {
        this.logger.error('Failed to log discount audit', error);
      }
    }
  }

  /**
   * Log successful discount application
   */
  async logAppliedDiscount(
    orderId: number,
    orderItemId: number | null,
    userId: number,
    userRole: string,
    discountType: DiscountType,
    discountPercent: number,
    discountAmount: number,
    originalAmount: number,
    finalAmount: number,
    isStacked: boolean = false,
    reason?: string,
  ): Promise<DiscountAuditLog> {
    return this.auditLogRepository.save({
      orderId,
      orderItemId,
      userId,
      userRole,
      discountType,
      discountPercent,
      discountAmount,
      originalAmount,
      finalAmount,
      isStacked,
      wasRejected: false,
      reason: reason || null,
    });
  }

  /**
   * Get discount audit history for an order
   */
  async getOrderDiscountHistory(orderId: number): Promise<DiscountAuditLog[]> {
    return this.auditLogRepository.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get discount report for date range
   */
  async getDiscountReport(
    dateFrom: Date,
    dateTo: Date,
  ): Promise<{
    totalDiscountAmount: number;
    discountCount: number;
    averageDiscountPercent: number;
    rejectedDiscounts: number;
    byUser: Array<{
      userId: number;
      userRole: string;
      discountCount: number;
      totalAmount: number;
      averagePercent: number;
    }>;
  }> {
    const logs = await this.auditLogRepository
      .createQueryBuilder('log')
      .where('log.createdAt BETWEEN :dateFrom AND :dateTo', {
        dateFrom,
        dateTo,
      })
      .getMany();

    const successfulLogs = logs.filter((l) => !l.wasRejected);
    const rejectedCount = logs.filter((l) => l.wasRejected).length;

    const totalDiscountAmount = successfulLogs.reduce(
      (sum, l) => sum + parseFloat(l.discountAmount.toString()),
      0,
    );

    const averageDiscountPercent =
      successfulLogs.length > 0
        ? successfulLogs.reduce(
            (sum, l) => sum + parseFloat(l.discountPercent.toString()),
            0,
          ) / successfulLogs.length
        : 0;

    // Group by user
    const byUserMap = new Map<
      number,
      {
        userId: number;
        userRole: string;
        discountCount: number;
        totalAmount: number;
        totalPercent: number;
      }
    >();

    for (const log of successfulLogs) {
      const existing = byUserMap.get(log.userId);
      if (existing) {
        existing.discountCount++;
        existing.totalAmount += parseFloat(log.discountAmount.toString());
        existing.totalPercent += parseFloat(log.discountPercent.toString());
      } else {
        byUserMap.set(log.userId, {
          userId: log.userId,
          userRole: log.userRole,
          discountCount: 1,
          totalAmount: parseFloat(log.discountAmount.toString()),
          totalPercent: parseFloat(log.discountPercent.toString()),
        });
      }
    }

    const byUser = Array.from(byUserMap.values()).map((u) => ({
      userId: u.userId,
      userRole: u.userRole,
      discountCount: u.discountCount,
      totalAmount: this.round(u.totalAmount),
      averagePercent: this.round(u.totalPercent / u.discountCount),
    }));

    return {
      totalDiscountAmount: this.round(totalDiscountAmount),
      discountCount: successfulLogs.length,
      averageDiscountPercent: this.round(averageDiscountPercent),
      rejectedDiscounts: rejectedCount,
      byUser,
    };
  }
}
