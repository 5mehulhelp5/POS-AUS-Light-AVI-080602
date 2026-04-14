import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { StoreCredit } from './entities/store-credit.entity';
import {
  StoreCreditTransaction,
  StoreCreditTransactionType,
} from './entities/store-credit-transaction.entity';
import { Customer } from './entities/customer.entity';

@Injectable()
export class StoreCreditService {
  constructor(
    @InjectRepository(StoreCredit)
    private readonly storeCreditRepository: Repository<StoreCredit>,
    @InjectRepository(StoreCreditTransaction)
    private readonly txRepository: Repository<StoreCreditTransaction>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly dataSource: DataSource,
  ) {}

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }

  /**
   * Fetch the balance row for a customer, creating it if it doesn't exist.
   * Always called inside an active transaction manager when possible.
   */
  private async getOrCreateBalance(
    manager: EntityManager,
    customerId: number,
  ): Promise<StoreCredit> {
    let balance = await manager.findOne(StoreCredit, {
      where: { customerId },
    });
    if (!balance) {
      // Verify customer exists
      const customer = await manager.findOne(Customer, {
        where: { id: customerId },
      });
      if (!customer) throw new NotFoundException('Customer not found');
      balance = manager.create(StoreCredit, {
        customerId,
        balance: 0,
      } as Partial<StoreCredit>);
      balance = await manager.save(balance);
    }
    return balance;
  }

  async getBalance(customerId: number): Promise<number> {
    const row = await this.storeCreditRepository.findOne({
      where: { customerId },
    });
    return row ? Number(row.balance) : 0;
  }

  async getTransactions(customerId: number, limit = 50): Promise<StoreCreditTransaction[]> {
    return this.txRepository.find({
      where: { customerId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Issue store credit to a customer from a refund. Always adds to balance.
   * Called from RefundsService in the same DB transaction.
   */
  async issueFromRefund(
    manager: EntityManager,
    customerId: number,
    amount: number,
    refundId: number,
    userId: number,
  ): Promise<void> {
    if (amount <= 0) {
      throw new BadRequestException('Refund amount must be greater than 0');
    }
    const balance = await this.getOrCreateBalance(manager, customerId);
    const newBalance = this.round(Number(balance.balance) + amount);
    balance.balance = newBalance;
    await manager.save(balance);

    const tx = manager.create(StoreCreditTransaction, {
      customerId,
      type: StoreCreditTransactionType.REFUND_ISSUE,
      amount: this.round(amount),
      balanceAfter: newBalance,
      relatedRefundId: refundId,
      userId,
      note: null,
    } as Partial<StoreCreditTransaction>);
    await manager.save(tx);
  }

  /**
   * Deduct store credit for an order. Called from OrdersService in the same
   * DB transaction. Throws if insufficient balance.
   */
  async redeemForOrder(
    manager: EntityManager,
    customerId: number,
    amount: number,
    orderId: number,
    userId: number,
  ): Promise<void> {
    if (amount <= 0) {
      throw new BadRequestException('Redemption amount must be greater than 0');
    }
    const balance = await this.getOrCreateBalance(manager, customerId);
    const current = Number(balance.balance);
    if (current < amount - 0.01) {
      throw new BadRequestException(
        `Insufficient store credit: $${current.toFixed(2)} available, $${amount.toFixed(2)} requested`,
      );
    }
    const newBalance = this.round(current - amount);
    balance.balance = newBalance;
    await manager.save(balance);

    const tx = manager.create(StoreCreditTransaction, {
      customerId,
      type: StoreCreditTransactionType.REDEMPTION,
      amount: -this.round(amount),
      balanceAfter: newBalance,
      relatedOrderId: orderId,
      userId,
      note: null,
    } as Partial<StoreCreditTransaction>);
    await manager.save(tx);
  }

  /**
   * Pre-validate that the customer has enough balance before saving the order.
   * Doesn't mutate state — used to fail fast before building the order.
   */
  async assertSufficientBalance(customerId: number, amount: number): Promise<void> {
    const current = await this.getBalance(customerId);
    if (current < amount - 0.01) {
      throw new BadRequestException(
        `Insufficient store credit: $${current.toFixed(2)} available, $${amount.toFixed(2)} requested`,
      );
    }
  }

  /**
   * Manual admin adjustment. Can be positive (add credit) or negative
   * (claw back). The only path that permits a negative balance.
   */
  async manualAdjust(
    customerId: number,
    amount: number,
    userId: number,
    note: string,
  ): Promise<{ balance: number; transaction: StoreCreditTransaction }> {
    if (!note || !note.trim()) {
      throw new BadRequestException('A note is required for manual adjustments');
    }
    if (amount === 0) {
      throw new BadRequestException('Adjustment amount cannot be 0');
    }

    return this.dataSource.transaction(async (manager) => {
      const balance = await this.getOrCreateBalance(manager, customerId);
      const newBalance = this.round(Number(balance.balance) + amount);
      balance.balance = newBalance;
      await manager.save(balance);

      const tx = manager.create(StoreCreditTransaction, {
        customerId,
        type: StoreCreditTransactionType.MANUAL_ADJUSTMENT,
        amount: this.round(amount),
        balanceAfter: newBalance,
        userId,
        note: note.trim(),
      } as Partial<StoreCreditTransaction>);
      const savedTx = await manager.save(tx);

      return { balance: newBalance, transaction: savedTx };
    });
  }
}
