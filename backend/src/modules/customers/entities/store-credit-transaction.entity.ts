import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from './customer.entity';
import { User } from '../../users/entities/user.entity';

export enum StoreCreditTransactionType {
  REFUND_ISSUE = 'refund_issue',
  REDEMPTION = 'redemption',
  MANUAL_ADJUSTMENT = 'manual_adjustment',
}

@Entity('store_credit_transactions')
export class StoreCreditTransaction {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'customer_id', type: 'int', unsigned: true })
  customerId: number;

  @Index()
  @Column({ type: 'enum', enum: StoreCreditTransactionType })
  type: StoreCreditTransactionType;

  // Signed: positive for additions, negative for deductions
  @Column({ type: 'decimal', precision: 12, scale: 4 })
  amount: number;

  @Column({ name: 'balance_after', type: 'decimal', precision: 12, scale: 4 })
  balanceAfter: number;

  @Column({ name: 'related_order_id', type: 'int', unsigned: true, nullable: true })
  relatedOrderId: number | null;

  @Column({ name: 'related_refund_id', type: 'int', unsigned: true, nullable: true })
  relatedRefundId: number | null;

  @Column({ name: 'user_id', type: 'int', unsigned: true })
  userId: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
