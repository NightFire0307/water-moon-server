import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import * as sharp from 'sharp';
import { MinioService } from '../minio/minio.service';
import { Subject } from 'rxjs';
import { Redis } from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Photo } from './entities/photo.entity';
import { In, Repository } from 'typeorm';
import {
  DatabaseErrorType,
  DatabaseException,
} from '../common/database-exception.filter';

export interface CompressPhotoJobData {
  id: number;
  uid: string;
  file_name: string;
  file_buffer: Buffer;
  order_number: string;
  is_recommend: boolean;
  thumbnail_url?: string;
  original_url?: string;
  expires?: number;
}

export interface UpdatePhotoRecommendJobData {
  orderId: number;
  photoIds: number[];
  isRecommended?: boolean;
}

export enum PhotoJobName {
  UpdateRecommend = 'update-recommend',
  CompressImage = 'compress-image',
}

type JobDataMap = {
  [PhotoJobName.UpdateRecommend]: UpdatePhotoRecommendJobData;
  [PhotoJobName.CompressImage]: CompressPhotoJobData;
};

type JobData<Name extends PhotoJobName> = JobDataMap[Name];

@Processor('photo')
@Injectable()
export class CompressPhotoProcessor extends WorkerHost {
  @InjectRepository(Photo)
  private readonly photoRepository: Repository<Photo>;

  @Inject(MinioService)
  private readonly minioService: MinioService;

  @Inject('REDIS_CLIENT')
  private readonly redisClient: Redis;

  private imageProcessedSubject = new Subject();

  // 异步更新图片推荐状态
  async updatePhotoRecommend(data: UpdatePhotoRecommendJobData) {
    const { orderId, photoIds, isRecommended } = data;
    try {
      await this.photoRepository.update(
        { id: In(photoIds), order: { id: orderId }, is_deleted: false },
        { is_recommended: isRecommended },
      );
    } catch (e) {
      throw new DatabaseException(DatabaseErrorType.DEFAULT, e);
    }
  }

  // 异步压缩图片
  async compressPhotoJob(data: CompressPhotoJobData) {
    const { id, uid, file_name, file_buffer, order_number, is_recommend } =
      data;

    try {
      // 拷贝图片 Buffer
      const imageBuffer = Buffer.from(file_buffer);
      // 压缩图片
      const compressImageBuffer = await sharp(imageBuffer)
        .resize({ width: 800, fit: 'inside' })
        .jpeg({ quality: 80 })
        .toBuffer();

      // 上传原图和缩略图
      await Promise.all([
        this.minioService.uploadImage(
          compressImageBuffer,
          `${order_number}/thumbnail_${file_name}`,
        ),
        this.minioService.uploadImage(
          Buffer.from(file_buffer),
          `${order_number}/${file_name}`,
        ),
      ]);

      // Redis 存储上传完成的图片数量
      await this.redisClient.incr(`photos_count:${order_number}`);

      // 设置图片过期时间
      const expires = 24 * 60 * 60 * 7;

      // 获取下载链接
      const thumbnail_url = await this.minioService.generateGetUrl(
        `${order_number}/thumbnail_${file_name}`,
        expires,
      );
      const original_url = await this.minioService.generateGetUrl(
        `${order_number}/${file_name}`,
        expires,
      );

      // 图片临时链接存入 Redis
      await this.redisClient.hset(
        `photos_url:${order_number}`,
        id,
        JSON.stringify({
          file_name,
          thumbnail_url,
          original_url,
          expires,
          is_recommend,
        }),
      );

      // 通知客户端图片处理完成
      this.imageProcessedSubject.next({
        id,
        uid,
        is_recommend,
        order_number,
        file_name,
        thumbnail_url,
        original_url,
      });
    } catch (e) {
      console.log(e);
    }
  }

  async process(job: Job<any, any, PhotoJobName>): Promise<any> {
    switch (job.name) {
      case PhotoJobName.CompressImage:
        await this.compressPhotoJob(
          job.data as JobData<PhotoJobName.CompressImage>,
        );
        break;
      case PhotoJobName.UpdateRecommend:
        await this.updatePhotoRecommend(
          job.data as JobData<PhotoJobName.UpdateRecommend>,
        );
        break;
      default:
        break;
    }
  }

  @OnWorkerEvent('completed')
  async onActive(job: Job<any, any, PhotoJobName>) {
    console.log('Job completed', job.name, job.id);
  }

  // 服务端推送照片处理进度
  get imageProcessed$() {
    return this.imageProcessedSubject.asObservable();
  }
}
