import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting, SettingType } from './entities/setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {}

  async findAll(): Promise<Setting[]> {
    return this.settingRepository.find({
      order: { settingKey: 'ASC' },
    });
  }

  async findByKey(key: string): Promise<Setting | null> {
    return this.settingRepository.findOne({
      where: { settingKey: key },
    });
  }

  async getValue<T>(key: string, defaultValue?: T): Promise<T | null> {
    const setting = await this.findByKey(key);
    if (!setting) {
      return defaultValue ?? null;
    }
    return setting.getValue<T>();
  }

  async getMultiple(keys: string[]): Promise<Record<string, any>> {
    const settings = await this.settingRepository.find({
      where: keys.map((key) => ({ settingKey: key })),
    });

    const result: Record<string, any> = {};
    for (const setting of settings) {
      result[setting.settingKey] = setting.getValue();
    }
    return result;
  }

  async set(
    key: string,
    value: any,
    type: SettingType = SettingType.STRING,
    description?: string,
    userId?: number,
  ): Promise<Setting> {
    let setting = await this.findByKey(key);

    const stringValue =
      type === SettingType.JSON ? JSON.stringify(value) : String(value);

    if (setting) {
      setting.settingValue = stringValue;
      setting.settingType = type;
      if (description) setting.description = description;
      setting.updatedBy = userId ?? null;
    } else {
      setting = this.settingRepository.create({
        settingKey: key,
        settingValue: stringValue,
        settingType: type,
        description: description ?? null,
        updatedBy: userId ?? null,
      });
    }

    return this.settingRepository.save(setting);
  }

  async updateMultiple(
    settings: Array<{ key: string; value: any; type?: SettingType }>,
    userId?: number,
  ): Promise<Setting[]> {
    const results: Setting[] = [];

    for (const { key, value, type } of settings) {
      const setting = await this.set(
        key,
        value,
        type ?? SettingType.STRING,
        undefined,
        userId,
      );
      results.push(setting);
    }

    return results;
  }

  async delete(key: string): Promise<void> {
    const setting = await this.findByKey(key);
    if (!setting) {
      throw new NotFoundException(`Setting '${key}' not found`);
    }
    await this.settingRepository.remove(setting);
  }

  // Convenience methods for common settings
  async getStoreSettings(): Promise<Record<string, any>> {
    const keys = [
      'store_name',
      'store_abn',
      'store_address',
      'store_phone',
      'store_email',
      'tax_rate',
      'quote_expiry_days',
      'trading_hours',
    ];
    return this.getMultiple(keys);
  }

  async getPaymentSettings(): Promise<Record<string, any>> {
    const keys = [
      'payment_cash_enabled',
      'payment_eftpos_enabled',
      'payment_credit_card_enabled',
      'payment_store_credit_enabled',
      'default_payment_method',
    ];
    return this.getMultiple(keys);
  }

  async getSystemSettings(): Promise<Record<string, any>> {
    const keys = [
      'receipt_print_enabled',
      'receipt_logo_url',
      'receipt_footer_text',
      'default_stock_hold',
      'offline_mode_enabled',
    ];
    return this.getMultiple(keys);
  }
}
