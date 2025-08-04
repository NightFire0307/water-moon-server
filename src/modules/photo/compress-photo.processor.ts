import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import * as sharp from 'sharp';
import { MinioService } from '../../minio/minio.service';
import { Subject } from 'rxjs';
import { Redis } from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Photo } from './entities/photo.entity';
import { In, Repository } from 'typeorm';
import { Order } from '../order/entities/order.entity';
import * as dayjs from 'dayjs';
import {
  CommonErrorCode,
  DatabaseException,
} from '../../common/exceptions/database.exception';

export interface CompressPhotoJobData {
  id: number;
  uid: string;
  file_name: string;
  file_buffer: Buffer;
  orderNumber: string;
  is_recommend: boolean;
  thumbnail_url?: string;
  original_url?: string;
  expires?: number;
  remark?: string;
}

export interface UpdatePhotoRecommendJobData {
  orderId: number;
  photoIds: number[];
  isRecommended?: boolean;
}

export interface UrlRefreshJobData {
  orderId: number;
  photoId: number;
}

export enum PhotoJobName {
  UpdateRecommend = 'update-recommend',
  CompressImage = 'compress-image',
  UrlRefresh = 'url-refresh',
}

type JobDataMap = {
  [PhotoJobName.UpdateRecommend]: UpdatePhotoRecommendJobData;
  [PhotoJobName.CompressImage]: CompressPhotoJobData;
  [PhotoJobName.UrlRefresh]: UrlRefreshJobData;
};

type JobData<Name extends PhotoJobName> = JobDataMap[Name];

@Processor('photo')
@Injectable()
export class CompressPhotoProcessor extends WorkerHost {
  @InjectRepository(Photo)
  private readonly photoRepository: Repository<Photo>;

  @InjectRepository(Order)
  private readonly orderRepository: Repository<Order>;

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
        { id: In(photoIds), order: { id: orderId }, isDeleted: false },
        { is_recommended: isRecommended },
      );
    } catch (e) {
      throw new DatabaseException(CommonErrorCode.DATABASE_ERROR, e);
    }
  }

  // 异步压缩图片
  async compressPhotoJob(data: CompressPhotoJobData) {
    const {
      id,
      uid,
      file_name,
      file_buffer,
      orderNumber,
      is_recommend,
      remark,
    } = data;

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
          `${orderNumber}/thumbnail_${file_name}`,
        ),
        this.minioService.uploadImage(
          Buffer.from(file_buffer),
          `${orderNumber}/${file_name}`,
        ),
      ]);

      // Redis 存储上传完成的图片数量
      await this.redisClient.incr(`photos_count:${orderNumber}`);

      // 设置图片过期时间
      const expires = 24 * 60 * 60 * 7;

      // 获取下载链接
      const thumbnail_url = await this.minioService.generateGetUrl(
        `${orderNumber}/thumbnail_${file_name}`,
        expires,
      );
      const original_url = await this.minioService.generateGetUrl(
        `${orderNumber}/${file_name}`,
        expires,
      );

      // 图片临时链接存入 Redis
      await this.redisClient.hset(
        `photos_url:${orderNumber}`,
        id,
        JSON.stringify({
          file_name,
          thumbnail_url,
          original_url,
          expires: dayjs().add(6, 'd').valueOf(),
          is_recommend,
          remark,
        }),
      );

      // 通知客户端图片处理完成
      this.imageProcessedSubject.next({
        id,
        uid,
        is_recommend,
        orderNumber,
        file_name,
        thumbnail_url,
        original_url,
      });
      console.log('通知完成');
    } catch (e) {
      console.log(e);
    }
  }

  // 异步刷新图片链接
  async urlRefreshJob({ orderId, photoId }: UrlRefreshJobData) {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId, isDeleted: false },
      });

      if (!order) return;

      const photo = await this.photoRepository.findOne({
        where: { id: photoId, order: { id: orderId }, isDeleted: false },
      });

      if (!photo) return;

      // 设置图片过期时间
      const expires = 24 * 60 * 60 * 7;

      // 重新创建链接
      const thumbnail_url = await this.minioService.generateGetUrl(
        `${order.orderNumber}/thumbnail_${photo.name}`,
        expires,
      );
      const original_url = await this.minioService.generateGetUrl(
        `${order.orderNumber}/${photo.name}`,
        expires,
      );

      // 更新 Redis 中照片 URL
      await this.redisClient.hset(
        `photos_url:${order.orderNumber}`,
        photo.id,
        JSON.stringify({
          file_name: photo.name,
          thumbnail_url,
          original_url,
          is_recommend: photo.is_recommended,
          expires: dayjs().add(30, 's').valueOf(),
          remark: '',
        }),
      );
    } catch (e) {
      console.log('刷新图片链接失败', e);
    }
  }

  // 处理任务
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
      case PhotoJobName.UrlRefresh:
        await this.urlRefreshJob(job.data as JobData<PhotoJobName.UrlRefresh>);
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
