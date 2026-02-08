import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SyncEntityType {
  CUSTOMER = 'customer',
  ORDER = 'order',
}

export enum SyncAction {
  CREATE = 'create',
  UPDATE = 'update',
}

export enum SyncQueueStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('sync_queue')
export class SyncQueue {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'entity_type', type: 'enum', enum: SyncEntityType })
  entityType: SyncEntityType;

  @Index()
  @Column({ name: 'entity_id', type: 'int', unsigned: true })
  entityId: number;

  @Column({ type: 'enum', enum: SyncAction })
  action: SyncAction;

  @Column({ type: 'json' })
  payload: Record<string, unknown>;

  @Column({ type: 'int', unsigned: true, default: 0 })
  attempts: number;

  @Column({ name: 'max_attempts', type: 'int', unsigned: true, default: 5 })
  maxAttempts: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: SyncQueueStatus,
    default: SyncQueueStatus.PENDING,
  })
  status: SyncQueueStatus;

  @Index()
  @Column({
    name: 'process_after',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  processAfter: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
