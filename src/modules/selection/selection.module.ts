import { Module } from '@nestjs/common';
import { SelectionService } from './selection.service';
import { SelectionController } from './selection.controller';
import { RedisModule } from '../../redis/redis.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { Product } from '../product/entities/product.entity';
import { Photo } from '../photo/entities/photo.entity';
import { OrderProduct } from '../order/entities/orderProduct.entity';
import { PhotoModule } from '../photo/photo.module';

@Module({
  imports: [
    RedisModule,
    PhotoModule,
    TypeOrmModule.forFeature([Order, OrderProduct, Product, Photo]),
  ],
  controllers: [SelectionController],
  providers: [SelectionService],
})
export class SelectionModule {}
