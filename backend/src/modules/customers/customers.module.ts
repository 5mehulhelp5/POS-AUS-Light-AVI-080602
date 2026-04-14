import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { Customer } from './entities';
import { Order } from '../orders/entities/order.entity';
import { Refund } from '../orders/entities/refund.entity';
import { Quote } from '../quotes/entities/quote.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, Order, Refund, Quote])],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
