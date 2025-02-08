import { forwardRef, Module } from '@nestjs/common';
import { PhotoService } from './photo.service';
import { PhotoController } from './photo.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Photo } from './entities/photo.entity';
import { Order } from '../order/entities/order.entity';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([Photo, Order]), RedisModule, AuthModule],
  controllers: [PhotoController],
  providers: [PhotoService],
})
export class PhotoModule {}
