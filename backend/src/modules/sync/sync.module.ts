import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SyncLog, SyncQueue } from './entities';
import { Product } from '../products/entities/product.entity';
import { Category } from '../products/entities/category.entity';
import { Customer } from '../customers/entities/customer.entity';
import { MagentoService } from './magento.service';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([SyncLog, SyncQueue, Product, Category, Customer]),
  ],
  controllers: [SyncController],
  providers: [MagentoService, SyncService],
  exports: [MagentoService, SyncService],
})
export class SyncModule {}
