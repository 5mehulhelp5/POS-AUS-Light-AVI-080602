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
import { Order } from '../../orders/entities/order.entity';
import { QuoteItem } from './quote-item.entity';

export enum QuoteStatus {
  OPEN = 'open',
  EXPIRED = 'expired',
  CONVERTED = 'converted',
  CANCELLED = 'cancelled',
}

@Entity('quotes')
export class Quote {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ name: 'quote_number', type: 'varchar', length: 50, unique: true })
  quoteNumber: string;

  @Index()
  @Column({ name: 'customer_id', type: 'int', unsigned: true, nullable: true })
  customerId: number | null;

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

  @Index()
  @Column({ type: 'enum', enum: QuoteStatus, default: QuoteStatus.OPEN })
  status: QuoteStatus;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({
    name: 'converted_order_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  convertedOrderId: number | null;

  @Column({ name: 'hold_stock', type: 'boolean', default: false })
  holdStock: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Customer, (customer) => customer.quotes, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @ManyToOne(() => User, (user) => user.quotes)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Order, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'converted_order_id' })
  convertedOrder: Order | null;

  @OneToMany(() => QuoteItem, (item) => item.quote, { cascade: true })
  items: QuoteItem[];

  // Computed property
  get isExpired(): boolean {
    return new Date() > this.expiresAt;
  }
}
