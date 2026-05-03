import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quote, QuoteItem } from './entities';
import { Product } from '../products/entities/product.entity';
import { Category } from '../products/entities/category.entity';
import { Customer } from '../customers/entities/customer.entity';
import { QuotesService } from './quotes.service';
import { TradeDiscountsService } from './trade-discounts.service';
import { QuotesController } from './quotes.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote, QuoteItem, Product, Category, Customer]),
    OrdersModule,
  ],
  controllers: [QuotesController],
  providers: [QuotesService, TradeDiscountsService],
  exports: [QuotesService],
})
export class QuotesModule {}
