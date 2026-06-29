import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Warranty } from './entities';
import { Supplier } from '../suppliers/entities';
import { WarrantiesService } from './warranties.service';
import { WarrantiesController } from './warranties.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Warranty, Supplier])],
  controllers: [WarrantiesController],
  providers: [WarrantiesService],
  exports: [WarrantiesService],
})
export class WarrantiesModule {}
