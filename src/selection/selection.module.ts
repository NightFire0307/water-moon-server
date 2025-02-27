import { Module } from '@nestjs/common';
import { SelectionService } from './selection.service';
import { SelectionController } from './selection.controller';
import { RedisModule } from '../redis/redis.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';

@Module({
  imports: [RedisModule, TypeOrmModule.forFeature([Order])],
  controllers: [SelectionController],
  providers: [SelectionService],
})
export class SelectionModule {}
