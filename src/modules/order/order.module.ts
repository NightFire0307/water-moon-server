import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { Product } from '../product/entities/product.entity';
import { OrderProduct } from './entities/orderProduct.entity';
import { Photo } from '../photo/entities/photo.entity';
import { RedisModule } from '@/modules/redis/redis.module';
import { MinioModule } from '@/modules/minio/minio.module';
import { OrderProductPhoto } from './entities/orderProductPhotos.entity';
import { PhotoModule } from '../photo/photo.module';
import { DatabaseModule } from '../database/database.module';
import { ProductPackage } from '../package/entities/product-package.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Product, OrderProduct, Photo, OrderProductPhoto, ProductPackage]),
    RedisModule,
    MinioModule,
    PhotoModule,
    DatabaseModule,
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService]
})
export class OrderModule { }
