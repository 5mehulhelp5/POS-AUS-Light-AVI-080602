import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Order } from './order.entity';
import { User } from '../../users/entities/user.entity';
import { RefundItem } from './refund-item.entity';

export enum RefundReason {
  DAMAGED = 'damaged',
  CUSTOMER_CHANGED_MIND = 'customer_changed_mind',
  WRONG_ITEM = 'wrong_item',
  PRICING_ERROR = 'pricing_error',
  FAULTY_PRODUCT = 'faulty_product',
  OTHER = 'other',
}

@Entity('refunds')
export class Refund {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'order_id', type: 'int', unsigned: true })
  orderId: number;

  @Index()
  @Column({ name: 'user_id', type: 'int', unsigned: true })
  userId: number;

  @Column({ type: 'enum', enum: RefundReason })
  reason: RefundReason;

  @Column({ name: 'reason_text', type: 'varchar', length: 500, nullable: true })
  reasonText: string | null;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 12, scale: 4 })
  refundAmount: number;

  @Column({ name: 'is_full_refund', type: 'boolean', default: false })
  isFullRefund: boolean;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => RefundItem, (item) => item.refund, { cascade: true })
  items: RefundItem[];
}
