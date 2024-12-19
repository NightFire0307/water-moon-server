import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { Product } from '../product/entities/product.entity';
import { OrderProduct } from './entities/orderProduct.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Product, OrderProduct])],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
