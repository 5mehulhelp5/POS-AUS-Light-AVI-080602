import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { Quote } from '../../quotes/entities/quote.entity';
import { Inquiry } from '../../inquiries/entities/inquiry.entity';

export enum SyncStatus {
  PENDING = 'pending',
  SYNCED = 'synced',
  FAILED = 'failed',
}

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({
    name: 'magento_id',
    type: 'int',
    unsigned: true,
    unique: true,
    nullable: true,
  })
  magentoId: number | null;

  @Index()
  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName: string;

  @Index()
  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName: string;

  @Index()
  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  mobile: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  company: string | null;

  @Column({ name: 'tax_number', type: 'varchar', length: 50, nullable: true })
  taxNumber: string | null;

  // Billing address
  @Column({ name: 'billing_street', type: 'varchar', length: 500, nullable: true })
  billingStreet: string | null;

  @Column({ name: 'billing_city', type: 'varchar', length: 100, nullable: true })
  billingCity: string | null;

  @Column({ name: 'billing_state', type: 'varchar', length: 100, nullable: true })
  billingState: string | null;

  @Column({
    name: 'billing_postcode',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  billingPostcode: string | null;

  @Column({
    name: 'billing_country',
    type: 'varchar',
    length: 2,
    default: 'AU',
  })
  billingCountry: string;

  // Shipping address
  @Column({
    name: 'shipping_street',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  shippingStreet: string | null;

  @Column({
    name: 'shipping_city',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  shippingCity: string | null;

  @Column({
    name: 'shipping_state',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  shippingState: string | null;

  @Column({
    name: 'shipping_postcode',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  shippingPostcode: string | null;

  @Column({
    name: 'shipping_country',
    type: 'varchar',
    length: 2,
    default: 'AU',
  })
  shippingCountry: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'is_guest', type: 'boolean', default: false })
  isGuest: boolean;

  @Index()
  @Column({ name: 'is_trade', type: 'boolean', default: false })
  isTrade: boolean;

  @Index()
  @Column({
    name: 'sync_status',
    type: 'enum',
    enum: SyncStatus,
    default: SyncStatus.PENDING,
  })
  syncStatus: SyncStatus;

  @Column({ name: 'synced_at', type: 'timestamp', nullable: true })
  syncedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Order, (order) => order.customer)
  orders: Order[];

  @OneToMany(() => Quote, (quote) => quote.customer)
  quotes: Quote[];

  @OneToMany(() => Inquiry, (inquiry) => inquiry.customer)
  inquiries: Inquiry[];

  // Virtual property
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  get primaryPhone(): string | null {
    return this.mobile || this.phone;
  }
}
