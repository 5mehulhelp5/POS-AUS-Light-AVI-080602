import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';
import { User } from '../../users/entities/user.entity';

export enum DiscountType {
  PRODUCT = 'product',
  CART = 'cart',
  MANUAL = 'manual',
}

@Entity('discount_audit_log')
export class DiscountAuditLog {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'order_id', type: 'int', unsigned: true, nullable: true })
  orderId: number | null;

  @Column({
    name: 'order_item_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  orderItemId: number | null;

  @Column({ name: 'quote_id', type: 'int', unsigned: true, nullable: true })
  quoteId: number | null;

  @Index()
  @Column({ name: 'user_id', type: 'int', unsigned: true })
  userId: number;

  @Column({ name: 'user_role', type: 'varchar', length: 50 })
  userRole: string;

  @Column({ name: 'discount_type', type: 'enum', enum: DiscountType })
  discountType: DiscountType;

  @Column({
    name: 'discount_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
  })
  discountPercent: number;

  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 12,
    scale: 4,
  })
  discountAmount: number;

  @Column({
    name: 'original_amount',
    type: 'decimal',
    precision: 12,
    scale: 4,
  })
  originalAmount: number;

  @Column({ name: 'final_amount', type: 'decimal', precision: 12, scale: 4 })
  finalAmount: number;

  @Column({ name: 'is_stacked', type: 'boolean', default: false })
  isStacked: boolean;

  @Column({
    name: 'stacked_with_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  stackedWithId: number | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'approved_by', type: 'int', unsigned: true, nullable: true })
  approvedBy: number | null;

  @Index()
  @Column({ name: 'was_rejected', type: 'boolean', default: false })
  wasRejected: boolean;

  @Column({
    name: 'rejection_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  rejectionReason: string | null;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Order, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  @ManyToOne(() => OrderItem, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by' })
  approver: User | null;
}
