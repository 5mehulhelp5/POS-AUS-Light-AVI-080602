import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from './customer.entity';

@Entity('store_credits')
export class StoreCredit {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Index({ unique: true })
  @Column({ name: 'customer_id', type: 'int', unsigned: true })
  customerId: number;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  balance: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;
}
