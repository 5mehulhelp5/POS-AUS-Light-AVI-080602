import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Refund } from './refund.entity';
import { OrderItem } from './order-item.entity';

@Entity('refund_items')
export class RefundItem {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'refund_id', type: 'int', unsigned: true })
  refundId: number;

  @Index()
  @Column({ name: 'order_item_id', type: 'int', unsigned: true })
  orderItemId: number;

  @Column({ type: 'int', unsigned: true })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  amount: number;

  @Column({ type: 'boolean', default: true })
  restock: boolean;

  @ManyToOne(() => Refund, (refund) => refund.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'refund_id' })
  refund: Refund;

  @ManyToOne(() => OrderItem)
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;
}
