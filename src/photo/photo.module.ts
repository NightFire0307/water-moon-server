import { Module } from '@nestjs/common';
import { PhotoService } from './photo.service';
import { PhotoController } from './photo.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Photo } from './entities/photo.entity';
import { Order } from '../order/entities/order.entity';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { PhotoCountSyncService } from './photo-count-sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([Photo, Order]), RedisModule, AuthModule],
  controllers: [PhotoController],
  providers: [PhotoService, PhotoCountSyncService],
})
export class PhotoModule {}
