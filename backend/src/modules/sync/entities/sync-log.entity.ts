import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

export enum SyncType {
  PRODUCTS = 'products',
  CATEGORIES = 'categories',
  INVENTORY = 'inventory',
  CUSTOMERS = 'customers',
  ORDERS = 'orders',
}

export enum SyncDirection {
  MAGENTO_TO_POS = 'magento_to_pos',
  POS_TO_MAGENTO = 'pos_to_magento',
}

export enum SyncLogStatus {
  STARTED = 'started',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial',
}

@Entity('sync_logs')
export class SyncLog {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'sync_type', type: 'enum', enum: SyncType })
  syncType: SyncType;

  @Column({ type: 'enum', enum: SyncDirection })
  direction: SyncDirection;

  @Index()
  @Column({ type: 'enum', enum: SyncLogStatus })
  status: SyncLogStatus;

  @Column({
    name: 'records_processed',
    type: 'int',
    unsigned: true,
    default: 0,
  })
  recordsProcessed: number;

  @Column({ name: 'records_created', type: 'int', unsigned: true, default: 0 })
  recordsCreated: number;

  @Column({ name: 'records_updated', type: 'int', unsigned: true, default: 0 })
  recordsUpdated: number;

  @Column({ name: 'records_failed', type: 'int', unsigned: true, default: 0 })
  recordsFailed: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'error_details', type: 'json', nullable: true })
  errorDetails: Record<string, unknown> | null;

  @Index()
  @Column({ name: 'started_at', type: 'timestamp' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'duration_seconds', type: 'int', unsigned: true, nullable: true })
  durationSeconds: number | null;
}
