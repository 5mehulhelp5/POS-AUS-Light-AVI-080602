import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { TradeDiscountsService } from './trade-discounts.service';
import { Product, Category, ProductAttribute } from './entities';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Category, ProductAttribute]),
    SyncModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, TradeDiscountsService],
  exports: [ProductsService, TradeDiscountsService],
})
export class ProductsModule {}
