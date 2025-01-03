import { Module } from '@nestjs/common';
import { LinkService } from './link.service';
import { LinkController } from './link.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { Link } from './entities/link.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Link])],
  controllers: [LinkController],
  providers: [LinkService],
})
export class LinkModule {}
