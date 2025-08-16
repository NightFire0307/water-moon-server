import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import * as sharp from 'sharp';
import { MinioService } from '../../minio/minio.service';
import { Subject } from 'rxjs';
import { Redis } from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Photo, PreSelectStatus } from './entities/photo.entity';
import { Repository } from 'typeorm';
import { Order } from '../order/entities/order.entity';
import * as dayjs from 'dayjs';
export interface PhotoJobData {
  id: number
  uid: string
  fileName: string
  fileBuffer: Buffer
  isRecommend: boolean
  orderNumber: string
  thumbnailBuffer?: Buffer
  mediumBuffer?: Buffer
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

// 任务名称映射

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
        const { thumbnailBuffer, mediumBuffer } = await this.compressPhoto(job.data)

        // 开始上传 OSS Job
        await this.photoQueue.add(PhotoJobName.OSS_UPLOAD, {
          ...job.data,
          thumbnailBuffer,
          mediumBuffer,
        })
        break;
      case PhotoJobName.OSS_UPLOAD:
        console.log('开始处理上传图片到OSS任务', job.id);
        await this.uploadToOss({
          ...job.data,
          thumbnailBuffer: job.data.thumbnailBuffer,
          mediumBuffer: job.data.mediumBuffer,
        })

        await this.photoQueue.add(PhotoJobName.CACHE_COMPRESS_INFO, job.data)
        break;
      case PhotoJobName.CACHE_COMPRESS_INFO:
        console.log('开始处理缓存压缩图片信息任务', job.id);
        await this.cacheCompressInfo(job.data)

        await this.photoQueue.add(PhotoJobName.NOTIFY_CLIENT, job.data)
        break;
      case PhotoJobName.NOTIFY_CLIENT:
        console.log('开始处理通知客户端任务', job.id);
        this.notifyClient(job.data)

        break;
      default:
        break;
    }
  }

  // 1.异步压缩图片
  async compressPhoto(data: PhotoJobData): Promise<{ thumbnailBuffer: Buffer; mediumBuffer: Buffer }> {
    const { fileBuffer } = data;
    const copyFileBuffer = Buffer.from(fileBuffer);

    try {
      const [thumbnailBuffer, mediumBuffer] = await Promise.all([
        sharp(copyFileBuffer).resize({ width: 300, fit: 'inside' }).webp({ quality: 80 }).toBuffer(),
        sharp(copyFileBuffer).resize({ width: 1920, fit: 'inside' }).webp({ quality: 80 }).toBuffer(),
      ])

      return {
        thumbnailBuffer,
        mediumBuffer,
      }
    } catch (e) {
      console.log(e);
      throw new Error('图片压缩失败')
    }
  }

  // 2. 上传图片到 OSS
  async uploadToOss(data: PhotoJobData & { thumbnailBuffer: Buffer; mediumBuffer: Buffer }) {
    // 注：需要拷贝一份 Buffer，否则会报错，因为 BullMQ 会将数据序列化和反序列化，所以拿到的 Buffer 不是原始的 Buffer 
    const originalBuffer = Buffer.from(data.fileBuffer);
    const thumbnailBuffer = Buffer.from(data.thumbnailBuffer);
    const mediumBuffer = Buffer.from(data.mediumBuffer);


    try {
      await Promise.all([
        this.minioService.uploadImage(
          originalBuffer,
          `${data.orderNumber}/${data.fileName}`
        ),
        this.minioService.uploadImage(
          thumbnailBuffer,
          `${data.orderNumber}/thumbnail/${data.fileName}`
        ),
        this.minioService.uploadImage(
          mediumBuffer,
          `${data.orderNumber}/medium/${data.fileName}`
        )
      ])
    } catch (err) {
      throw err
    }
  }

  // 3. 缓存图片信息到 Redis
  async cacheCompressInfo(data: PhotoJobData) {
    try {
      // 获取 OSS 图片链接
      const { id, fileName, isRecommend, orderNumber } = data;

      const [thumbnailUrl, originalUrl, mediumUrl] = await Promise.all([
        this.minioService.generateGetUrl(
          `${orderNumber}/thumbnail/${fileName}`,
          24 * 60 * 60 * 7,
        ),
        this.minioService.generateGetUrl(
          `${orderNumber}/${fileName}`,
          24 * 60 * 60 * 7,
        ),
        this.minioService.generateGetUrl(
          `${orderNumber}/medium/${fileName}`,
          24 * 60 * 60 * 7,
        ),
      ])

      // 缓存图片信息到 Redis 中
      await this.redisClient.hset(
        `photos_url:${orderNumber}`,
        String(id),
        JSON.stringify({
          fileName,
          thumbnailUrl,
          originalUrl,
          mediumUrl,
          isRecommend,
          expires: dayjs().add(6, 'd').valueOf(),
          preSelectStatus: PreSelectStatus.PENDING,
        }),
      )
    } catch (e) {
      console.log(e);
      throw e
    }
  }

  // 4. 通知客户端图片处理完成
  notifyClient(data: PhotoJobData) {
    this.imageProcessedSubject.next(data)
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
      const thumbnailUrl = await this.minioService.generateGetUrl(
        `${order.orderNumber}/thumbnail/${photo.name}`,
        expires,
      );
      const originalUrl = await this.minioService.generateGetUrl(
        `${order.orderNumber}/${photo.name}`,
        expires,
      );
      const mediumUrl = await this.minioService.generateGetUrl(
        `${order.orderNumber}/medium/${photo.name}`,
        expires,
      );

      // 更新 Redis 中照片 URL
      await this.redisClient.hset(
        `photos_url:${order.orderNumber}`,
        photo.id,
        JSON.stringify({
          fileName: photo.name,
          thumbnailUrl,
          originalUrl,
          mediumUrl,
          isRecommend: photo.isRecommended,
          expires: dayjs().add(30, 's').valueOf(),
          remark: '',
        }),
      );
    } catch (e) {
      console.log('刷新图片链接失败', e);
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
