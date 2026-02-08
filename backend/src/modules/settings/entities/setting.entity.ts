import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum SettingType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
}

@Entity('settings')
export class Setting {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ name: 'setting_key', type: 'varchar', length: 100, unique: true })
  settingKey: string;

  @Column({ name: 'setting_value', type: 'text', nullable: true })
  settingValue: string | null;

  @Column({
    name: 'setting_type',
    type: 'enum',
    enum: SettingType,
    default: SettingType.STRING,
  })
  settingType: SettingType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'updated_by', type: 'int', unsigned: true, nullable: true })
  updatedBy: number | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser: User | null;

  // Helper to get typed value
  getValue<T>(): T | null {
    if (this.settingValue === null) return null;

    switch (this.settingType) {
      case SettingType.NUMBER:
        return parseFloat(this.settingValue) as T;
      case SettingType.BOOLEAN:
        return (this.settingValue === 'true') as T;
      case SettingType.JSON:
        return JSON.parse(this.settingValue) as T;
      default:
        return this.settingValue as T;
    }
  }
}
