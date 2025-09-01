import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { MinioService } from '../../minio/minio.service';
import { Redis } from 'ioredis';
import { PreSelectStatus } from './entities/photo.entity';
import dayjs from 'dayjs';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid'
import { EventService, ProcessingStatus } from './event.service';

export interface PhotoJobData {
  orderId: number
  orderNumber: string
  name: string
  ossKey: string
  mark: PreSelectStatus
  ossUrlMedium?: string
  ossUrlThumbnail?: string
  isRecommend?: boolean
  expiresAt?: number
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

// 定义任务名称
export enum PhotoJobName {
  PHOTO_COMPRESS = 'photo:compress', // 压缩图片
  CACHE_COMPRESS_INFO = 'photo:cache:compress:info', // 存储压缩后图片信息到 Redis
  NOTIFY_CLIENT = 'photo:notify:client', // 通知客户端
}

// 定义 photo 推送数据类型
export interface PhotoSseData {
  type: "PHOTO_DONE" | 'ORDER_DONE' // PHOTO_DONE: 照片处理完成, ORDER_DONE: 订单处理完成
  orderNumber: string // 订单号
  status: 'done' | 'error' // done: 处理完成, error: 处理失败
  uid?: string // 照片 UID
  originalUrl?: string // 原图链接
  thumbnailUrl?: string // 缩略图链接
}

@Processor('photo', { concurrency: 2 }) // 设置并发数为 4
@Injectable()
export class CompressPhotoProcessor extends WorkerHost {
  @Inject(MinioService)
  private readonly minioService: MinioService;

  @Inject('REDIS_CLIENT')
  private readonly redisClient: Redis;

  @Inject(EventService)
  private readonly eventService: EventService;

  constructor(
    @InjectQueue('photo') private photoQueue: Queue
  ) {
    super();
  }

  // 处理任务
  async process(job: Job<PhotoJobData, any, PhotoJobName>): Promise<any> {
    switch (job.name) {
      case PhotoJobName.PHOTO_COMPRESS:
        console.log('开始处理图片压缩任务', job.id);

        // 开始上传 OSS Job
        const [ossUrlMedium, ossUrlThumbnail] = await this.compressPhoto(job.data)
        await this.photoQueue.add(PhotoJobName.CACHE_COMPRESS_INFO, {
          ...job.data,
          ossUrlMedium,
          ossUrlThumbnail,
        })
        break;
      case PhotoJobName.CACHE_COMPRESS_INFO:
        console.log('开始处理缓存压缩图片信息任务', job.id);
        await this.cacheCompressInfo(job.data)

        await this.photoQueue.add(PhotoJobName.NOTIFY_CLIENT, job.data)
        break;
      case PhotoJobName.NOTIFY_CLIENT:
        console.log('开始处理通知客户端任务', job.id);

        break;
      default:
        break;
    }
  }

  // 1.异步压缩图片
  async compressPhoto(data: PhotoJobData) {
    try {
      // 把可读流读成 Buffer
      const streamToBuffer = (stream: NodeJS.ReadableStream) =>
        new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          stream.on('data', (c) => chunks.push(Buffer.from(c)));
          stream.on('end', () => resolve(Buffer.concat(chunks)));
          stream.on('error', reject);
        });

      // 下载原始文件流并转为 Buffer（确保 minioService.downloadImage 返回 Readable）
      const objectStream = await this.minioService.downloadImage(data.ossKey);
      const originalBuffer = await streamToBuffer(objectStream);

      // 用 sharp 从同一 Buffer 生成两个不同尺寸的 Buffer（不会互相影响）
      const [mediumBuffer, thumbnailBuffer] = await Promise.all([
        sharp(originalBuffer).resize({ width: 1920, fit: 'inside' }).webp({ quality: 70 }).toBuffer(),
        sharp(originalBuffer).resize({ width: 300, fit: 'inside' }).webp({ quality: 70 }).toBuffer(),
      ]);

      // 上传 Buffer 到 Minio
      await Promise.all([
        this.minioService.uploadImage(mediumBuffer, `${data.orderNumber}/medium/${data.name}.webp`),
        this.minioService.uploadImage(thumbnailBuffer, `${data.orderNumber}/thumbnail/${data.name}.webp`),
      ]);

      // 获取上传后的 OSS 链接
      const [ossUrlMedium, ossUrlThumbnail] = await Promise.all([
        this.minioService.generateGetUrl(`${data.orderNumber}/medium/${data.name}.webp`),
        this.minioService.generateGetUrl(`${data.orderNumber}/thumbnail/${data.name}.webp`),
      ]);

      return [ossUrlMedium, ossUrlThumbnail];
    } catch (err) {
      console.error('compressPhoto error', err);
      throw err;
    }
  }

  // 3. 缓存图片信息到 Redis
  async cacheCompressInfo(data: PhotoJobData) {
    console.log(data)
    try {
      // 获取 OSS 图片链接
      const { name, ossUrlMedium, ossUrlThumbnail, orderId, ossKey } = data;

      // 缓存图片信息到 Redis 中
      await this.redisClient.hset(
        `photos_url:${orderId.toString()}:${name}`,
        {
          uuid: uuidv4(),
          name,
          ossKey,
          ossUrlMedium,
          ossUrlThumbnail,
          expiresAt: dayjs().add(6, 'd').valueOf(),
          mark: PreSelectStatus.PENDING,
        },
      )

    } catch (e) {
      console.log(e);
      throw e
    }
  }

  @OnWorkerEvent('completed')
  async onActive(job: Job<PhotoJobData, any, PhotoJobName>) {
    switch (job.name) {
      case PhotoJobName.PHOTO_COMPRESS:
        // 通知客户端图片压缩完成
        this.eventService.pushMessage({
          type: ProcessingStatus.COMPRESSED,
          orderNumber: job.data.orderNumber,
          filename: job.data.name,
          message: '图片压缩完成',
        })
        break;
      case PhotoJobName.NOTIFY_CLIENT:
        // 通知客户端图片处理完成
        this.eventService.pushMessage({
          type: ProcessingStatus.DONE,
          orderNumber: job.data.orderNumber,
          filename: job.data.name,
          ossUrlMedium: job.data.ossUrlMedium,
          ossUrlThumbnail: job.data.ossUrlThumbnail,
          message: '图片处理完成',
        })
      default:
        break;
    }
  }
}
