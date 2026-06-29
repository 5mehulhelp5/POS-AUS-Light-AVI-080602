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
import { Supplier } from '../../suppliers/entities';

export enum WarrantyStatus {
  NEW = 'new',
  AWAITING_SUPPLIER = 'awaiting_supplier',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REPLACED = 'replaced',
  REFUNDED = 'refunded',
  CLOSED = 'closed',
}

@Entity('warranties')
export class Warranty {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'customer_id', type: 'int', unsigned: true, nullable: true })
  customerId: number | null;

  // Contact details when no customer record is linked.
  @Column({ name: 'contact_name', type: 'varchar', length: 200, nullable: true })
  contactName: string | null;

  @Column({
    name: 'contact_phone',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  contactPhone: string | null;

  @Index()
  @Column({ name: 'supplier_id', type: 'int', unsigned: true, nullable: true })
  supplierId: number | null;

  // Snapshot of the supplier name at claim time (in case the supplier
  // row is later renamed/deleted).
  @Column({
    name: 'supplier_name',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  supplierName: string | null;

  @Column({ name: 'product_sku', type: 'varchar', length: 100, nullable: true })
  productSku: string | null;

  @Column({ name: 'product_name', type: 'varchar', length: 255, nullable: true })
  productName: string | null;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50, nullable: true })
  invoiceNumber: string | null;

  @Column({ name: 'purchase_date', type: 'date', nullable: true })
  purchaseDate: Date | null;

  @Column({ name: 'claim_date', type: 'date', nullable: true })
  claimDate: Date | null;

  @Column({ name: 'fault_description', type: 'text', nullable: true })
  faultDescription: string | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string | null;

  @Index()
  @Column({ type: 'enum', enum: WarrantyStatus, default: WarrantyStatus.NEW })
  status: WarrantyStatus;

  @Index()
  @Column({ name: 'user_id', type: 'int', unsigned: true })
  userId: number;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Customer, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @ManyToOne(() => Supplier, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
