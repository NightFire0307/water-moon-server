import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { MinioService } from '../../minio/minio.service';
import { Redis } from 'ioredis';
import { PreSelectStatus } from './entities/photo.entity';
import dayjs from 'dayjs';
import sharp from 'sharp';
import { PassThrough, pipeline } from 'stream';
import { EventService, ProcessingStatus } from './event.service';

export interface PhotoJobData {
  uid: string
  fileName: string
  orderNumber: string
  ossFileKey: string
  isRecommend?: boolean
  thumbnailUrl?: string
  mediumUrl?: string
  id?: number
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
  OSS_UPLOAD = 'photo:oss:upload', // 上传图片到 OSS
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

@Processor('photo', { concurrency: 4 }) // 设置并发数为 4
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
        const [mediumUrl, thumbnailUrl] = await this.compressPhoto(job.data)
        await this.photoQueue.add(PhotoJobName.CACHE_COMPRESS_INFO, {
          ...job.data,
          mediumUrl,
          thumbnailUrl
        })
        break;
      case PhotoJobName.CACHE_COMPRESS_INFO:
        console.log('开始处理缓存压缩图片信息任务', job.id);
        await this.cacheCompressInfo(job.data)

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
    const objectStream = await this.minioService.downloadImage(data.ossFileKey)

    const mediumStream = sharp()
      .resize({ width: 1920, fit: 'inside' })
      .webp({ quality: 70 })
    const thumbnailStream = sharp()
      .resize({ width: 300, fit: 'inside' })
      .webp({ quality: 70 })

    const compressMedium = new PassThrough();
    const compressThumbnail = new PassThrough();

    pipeline(
      objectStream,
      mediumStream,
      compressMedium,
      (err) => {
        if (err) {
          console.error('compress failed', err);
        } else {
          console.log('compress succeeded.');
        }
      }
    )

    // 生成缩略图
    pipeline(
      objectStream,
      thumbnailStream,
      compressThumbnail,
      (err) => {
        if (err) {
          console.error('thumbnail compress failed', err);
        } else {
          console.log('thumbnail compress succeeded.');
        }
      }
    )

    await Promise.all([
      this.minioService.uploadImage(
        compressMedium,
        `${data.orderNumber}/medium/${data.fileName}.webp`
      ),
      this.minioService.uploadImage(
        compressThumbnail,
        `${data.orderNumber}/thumbnail/${data.fileName}.webp`
      )
    ])

    // 获取上传后的 OSS 链接
    return await Promise.all([
      this.minioService.generateGetUrl(
        `${data.orderNumber}/medium/${data.fileName}.webp`
      ),
      this.minioService.generateGetUrl(
        `${data.orderNumber}/thumbnail/${data.fileName}.webp`
      )
    ])
  }

  // 3. 缓存图片信息到 Redis
  async cacheCompressInfo(data: PhotoJobData) {
    try {
      // 获取 OSS 图片链接
      const { id, fileName, mediumUrl, thumbnailUrl, orderNumber } = data;

      // 缓存图片信息到 Redis 中
      await this.redisClient.hset(
        `photos_url:${orderNumber}`,
        String(id),
        JSON.stringify({
          fileName,
          thumbnailUrl,
          mediumUrl,
          expires: dayjs().add(6, 'd').valueOf(),
          preSelectStatus: PreSelectStatus.PENDING,
        }),
      )

      // 通知客户端图片已处理完成
      // this.eventService.pushMessage({
      //   type: ProcessingStatus.DONE,
      //   orderNumber,
      //   filename: fileName,
      //   mediumUrl,
      //   thumbnailUrl,
      // })
    } catch (e) {
      console.log(e);
      throw e
    }
  }

  @OnWorkerEvent('completed')
  async onActive(job: Job<any, any, PhotoJobName>) {
    switch (job.name) {
      case PhotoJobName.PHOTO_COMPRESS:
        // 通知客户端图片压缩完成
        this.eventService.pushMessage({
          type: ProcessingStatus.COMPRESSED,
          orderNumber: job.data.orderNumber,
          filename: job.data.fileName,
          message: '图片压缩完成',
        })
        break;
      default:
        break;
    }
  }
}
