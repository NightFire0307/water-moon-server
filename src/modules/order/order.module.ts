import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { Product } from '../product/entities/product.entity';
import { OrderProduct } from './entities/orderProduct.entity';
import { Link } from '../link/entities/link.entity';
import { Photo } from '../photo/entities/photo.entity';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Product, OrderProduct, Link, Photo]),
    RedisModule,
  ],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule { }
