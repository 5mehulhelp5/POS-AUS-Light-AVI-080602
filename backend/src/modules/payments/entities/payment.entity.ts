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
import { User } from '../../users/entities/user.entity';

export enum PaymentMethod {
  CASH = 'cash',
  EFTPOS = 'eftpos',
  CREDIT_CARD = 'credit_card',
  STORE_CREDIT = 'store_credit',
  OTHER = 'other',
}

export enum PaymentEntityStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'order_id', type: 'int', unsigned: true })
  orderId: number;

  @Column({ name: 'user_id', type: 'int', unsigned: true })
  userId: number;

  @Index()
  @Column({ type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  amount: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference: string | null;

  // For cash payments
  @Column({
    name: 'amount_tendered',
    type: 'decimal',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  amountTendered: number | null;

  @Column({
    name: 'change_given',
    type: 'decimal',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  changeGiven: number | null;

  @Column({
    type: 'enum',
    enum: PaymentEntityStatus,
    default: PaymentEntityStatus.COMPLETED,
  })
  status: PaymentEntityStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Order, (order) => order.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
