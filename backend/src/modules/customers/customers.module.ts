import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { StoreCreditService } from './store-credit.service';
import {
  Customer,
  StoreCredit,
  StoreCreditTransaction,
} from './entities';
import { Order } from '../orders/entities/order.entity';
import { Refund } from '../orders/entities/refund.entity';
import { Quote } from '../quotes/entities/quote.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      StoreCredit,
      StoreCreditTransaction,
      Order,
      Refund,
      Quote,
    ]),
  ],
  controllers: [CustomersController],
  providers: [CustomersService, StoreCreditService],
  exports: [CustomersService, StoreCreditService],
})
export class CustomersModule {}
