import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Role } from './role.entity';

@Entity('permissions')
@Unique(['roleId', 'resource', 'action'])
export class Permission {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ name: 'role_id', type: 'int', unsigned: true })
  roleId: number;

  @Column({ type: 'varchar', length: 50 })
  resource: string;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @ManyToOne(() => Role, (role) => role.permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;
}
