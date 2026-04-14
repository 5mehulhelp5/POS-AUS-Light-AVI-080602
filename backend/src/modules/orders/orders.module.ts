import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { RefundsService } from './refunds.service';
import { Order, OrderItem, Refund, RefundItem } from './entities';
import { ProductsModule } from '../products/products.module';
import { DiscountsModule } from '../discounts/discounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Refund, RefundItem]),
    ProductsModule,
    DiscountsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, RefundsService],
  exports: [OrdersService, RefundsService],
})
export class OrdersModule {}
