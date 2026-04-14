import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';
import { OrderItem } from './order-item.entity';
import { Payment } from '../../payments/entities/payment.entity';

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETE = 'complete',
  CANCELLED = 'cancelled',
  REFUND_IN_PROCESS = 'refund_in_process',
  REFUNDED = 'refunded',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  REFUNDED = 'refunded',
}

export enum OrderSyncStatus {
  PENDING = 'pending',
  SYNCED = 'synced',
  FAILED = 'failed',
}

export enum OrderSource {
  POS = 'pos',
  MAGENTO = 'magento',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ name: 'order_number', type: 'varchar', length: 50, unique: true })
  orderNumber: string;

  @Index()
  @Column({
    name: 'magento_order_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  magentoOrderId: string | null;

  @Column({
    name: 'magento_increment_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  magentoIncrementId: string | null;

  @Index()
  @Column({ name: 'customer_id', type: 'int', unsigned: true, nullable: true })
  customerId: number | null;

  @Index()
  @Column({ name: 'user_id', type: 'int', unsigned: true })
  userId: number;

  // Totals
  @Column({ type: 'decimal', precision: 12, scale: 4 })
  subtotal: number;

  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 12,
    scale: 4,
    default: 0,
  })
  discountAmount: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 12, scale: 4 })
  taxAmount: number;

  @Column({ name: 'grand_total', type: 'decimal', precision: 12, scale: 4 })
  grandTotal: number;

  // Tax details
  @Column({
    name: 'tax_rate',
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0.1,
  })
  taxRate: number;

  @Index()
  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  // Sync tracking
  @Index()
  @Column({
    name: 'sync_status',
    type: 'enum',
    enum: OrderSyncStatus,
    default: OrderSyncStatus.PENDING,
  })
  syncStatus: OrderSyncStatus;

  @Column({ name: 'sync_attempts', type: 'int', unsigned: true, default: 0 })
  syncAttempts: number;

  @Column({ name: 'sync_error', type: 'text', nullable: true })
  syncError: string | null;

  @Column({ name: 'synced_at', type: 'timestamp', nullable: true })
  syncedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: OrderSource,
    default: OrderSource.POS,
  })
  source: OrderSource;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Customer, (customer) => customer.orders, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @OneToMany(() => Payment, (payment) => payment.order, { cascade: true })
  payments: Payment[];
}
