import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';
import { Quote } from '../../quotes/entities/quote.entity';
import { Order } from '../../orders/entities/order.entity';

export enum InquiryType {
  WALK_IN = 'walk_in',
  PHONE_CALL = 'phone_call',
  EMAIL = 'email',
  OTHER = 'other',
}

export enum InquiryStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CONVERTED = 'converted',
}

@Entity('inquiries')
export class Inquiry {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'customer_id', type: 'int', unsigned: true, nullable: true })
  customerId: number | null;

  @Index()
  @Column({ name: 'user_id', type: 'int', unsigned: true })
  userId: number;

  @Index()
  @Column({ type: 'enum', enum: InquiryType })
  type: InquiryType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subject: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Contact details if no customer record
  @Column({ name: 'contact_name', type: 'varchar', length: 200, nullable: true })
  contactName: string | null;

  @Column({
    name: 'contact_phone',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  contactPhone: string | null;

  @Column({
    name: 'contact_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  contactEmail: string | null;

  @Index()
  @Column({ type: 'enum', enum: InquiryStatus, default: InquiryStatus.NEW })
  status: InquiryStatus;

  @Column({
    name: 'converted_quote_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  convertedQuoteId: number | null;

  @Column({
    name: 'converted_order_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  convertedOrderId: number | null;

  @Index()
  @Column({ name: 'follow_up_date', type: 'date', nullable: true })
  followUpDate: Date | null;

  @Column({ name: 'follow_up_notes', type: 'text', nullable: true })
  followUpNotes: string | null;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Customer, (customer) => customer.inquiries, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @ManyToOne(() => User, (user) => user.inquiries)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Quote, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'converted_quote_id' })
  convertedQuote: Quote | null;

  @ManyToOne(() => Order, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'converted_order_id' })
  convertedOrder: Order | null;
}
