import { Module } from '@nestjs/common';
import { PhotoService } from './photo.service';
import { PhotoController } from './photo.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Photo } from './entities/photo.entity';
import { Order } from '../order/entities/order.entity';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../../redis/redis.module';
import { PhotoCountSyncService } from './photo-count-sync.service';
import { MinioModule } from '../../minio/minio.module';
import { BullModule } from '@nestjs/bullmq';
import { PhotoProcessor } from './photo.processor';
import { EventService } from './event.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Photo, Order]),
    BullModule.registerQueue({
      name: 'photo',
      defaultJobOptions: {
        removeOnComplete: true,
      },
    }),
    RedisModule,
    AuthModule,
    MinioModule,
  ],
  controllers: [PhotoController],
  providers: [PhotoService, PhotoCountSyncService, PhotoProcessor, EventService],
  exports: [PhotoService],
})
export class PhotoModule { }
