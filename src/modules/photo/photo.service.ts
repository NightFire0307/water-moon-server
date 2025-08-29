import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Photo } from './entities/photo.entity';
import { In, Repository } from 'typeorm';
import { Order } from '../order/entities/order.entity';
import { PaginationQuery } from '@/common/decorators/pagination.decorator';
import { DeletePhotosDto } from './dto/delete-photos.dto';
import { UpdatePhotoRecommendDto } from './dto/update-photo-recommend.dto';
import { Redis } from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PhotoJobName } from './compress-photo.processor';
import { MinioService } from '../../minio/minio.service';
import { ConfigService } from '@nestjs/config';
import dayjs from 'dayjs';
import {
  CommonErrorCode,
  DatabaseException,
} from '../../common/exceptions/database.exception';
import type { BulkUpdatePhotoPreselectStatusDto } from '../selection/dto/update-photo-preselect-status.dto';
import Busboy from 'busboy'
import { Request } from 'express';
import { PassThrough } from 'stream';
import { EventService, ProcessingStatus } from './event.service';

@Injectable()
export class PhotoService {
  private readonly BATCH_INSERT_SIZE = 100; // 批量插入大小
  private readonly REDIS_PHOTO_INFO_EXPIRE = 3600 * 6; // 照片信息缓存过期时间 6小时

  constructor(
    @InjectQueue('photo') private readonly photoQueue: Queue,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Photo)
    private readonly photoRepository: Repository<Photo>,
    @Inject(MinioService) private readonly minioService: MinioService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(EventService) private readonly eventService: EventService,
  ) { }

  // 获取订单信息
  async getOrderById(orderId: number) {
    const foundOrder = await this.orderRepository.findOne({
      where: {
        id: orderId,
      },
    });
    if (!foundOrder) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');
    }

    return foundOrder;
  }

  // 获取订单照片
  async getPhotosByOrderId(orderId: number, pagination: PaginationQuery) {
    const order = await this.getOrderById(orderId);

    const existCount = await this.redisClient.exists(`photos_url:${order.orderNumber}`);

    // 判断 redis 中是否有缓存，如果没有则从数据库中查询并缓存到 redis
    if (existCount === 0) {
      await this.refreshPhotosCache(order)
    }


    // 获取 Redis 中订单照片 OSS URL
    const oss_all_lists = await this.redisClient.hgetall(
      `photos_url:${order.orderNumber}`,
    );

    const total = Object.keys(oss_all_lists).length;
    const start = (pagination.current - 1) * pagination.pageSize;
    const end = pagination.current * pagination.pageSize;

    const oss_lists = Object.entries(oss_all_lists)
      .slice(start, end)
      .map(([key, value]) => ({
        id: Number(key),
        ...JSON.parse(value),
      }));

    // 判断链接是否过期，如果过期则重新生成链接
    for (const photo of oss_lists) {
      const now = dayjs();
      const expireAt = dayjs(photo.expires);
      if (expireAt.diff(now, 's') <= 10) {
        console.log('链接过期，重新生成链接');
        photo.thumbnailUrl = await this.minioService.generateGetUrl(
          `${order.orderNumber}/thumbnail/${photo.fileName}`,
        );
        photo.originalUrl = await this.minioService.generateGetUrl(
          `${order.orderNumber}/${photo.fileName}`,
        );
        photo.mediumUrl = await this.minioService.generateGetUrl(
          `${order.orderNumber}/medium/${photo.fileName}`,
        );

        // 更新 Redis 中照片 URL
        await this.redisClient.hset(
          `photos_url:${order.orderNumber}`,
          photo.id,
          JSON.stringify({
            fileName: photo.fileName,
            thumbnailUrl: photo.thumbnailUrl,
            originalUrl: photo.originalUrl,
            mediumUrl: photo.mediumUrl,
            isRecommend: photo.isRecommend,
            preSelectStatus: photo.preSelectStatus,
            expires: dayjs().add(6, 'd').valueOf(),
          }),
        );
      }
    }

    return {
      list: oss_lists,
      current: pagination.current,
      pageSize: pagination.pageSize,
      total,
    };
  }

  async deletePhotos(orderId: number, deletePhotosDto: DeletePhotosDto) {
    // 删除照片的批量操作，每次最多删除100张
    const batchSize = 100;
    const { photoIds } = deletePhotosDto;
    const order = await this.getOrderById(orderId);

    // 删除 Redis 中的照片 URL
    const photoUrlsRedisKey = `photos_url:${order.orderNumber}`;
    const photoUrlsHash = await this.redisClient.hgetall(photoUrlsRedisKey);
    const redisPipeline = this.redisClient.pipeline();
    for (const photoId in photoUrlsHash) {
      if (photoIds.includes(Number(photoId))) {
        redisPipeline.hdel(photoUrlsRedisKey, photoId);
      }
    }

    await redisPipeline.exec();

    try {
      for (let i = 0; i < photoIds.length; i += batchSize) {
        const batch = photoIds.slice(i, i + batchSize);
        await this.photoRepository.update(
          { id: In(batch), order: { id: orderId } },
          { isDeleted: true },
        );
      }
    } catch (e) {
      throw new DatabaseException(CommonErrorCode.DATABASE_ERROR, e);
    }

    return { message: '删除照片成功', data: [] };
  }

  async updatePhotoRecommendStatus(
    orderId: number,
    updatePhotoRecommendStatusDto: UpdatePhotoRecommendDto,
  ) {
    const { photoIds, isRecommended } = updatePhotoRecommendStatusDto;
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');
    }

    // 更新照片推荐状态
    await this.photoRepository.update(
      {
        id: In(photoIds),
        order: { id: orderId }
      },
      {
        isRecommended,
      }
    )

    // 修改 Redis 中照片推荐状态
    const photosUrl = await this.redisClient.hgetall(
      `photos_url:${order.orderNumber}`,
    );
    const pipeline = this.redisClient.pipeline();
    for (const photoId in photosUrl) {
      if (photoIds.includes(Number(photoId))) {
        const photo = JSON.parse(photosUrl[photoId]);
        photo.isRecommend = isRecommended;
        pipeline.hset(
          `photos_url:${order.orderNumber}`,
          photoId,
          JSON.stringify(photo),
        );
      }
    }
    await pipeline.exec();

    return {
      data: photoIds,
      msg: '修改成功',
    };
  }

  // 
  async uploadPhotos(orderId: number, req: Request) {
    // 获取订单数据
    const order = await this.getOrderById(orderId);

    return new Promise(async (resolve, reject) => {
      const bb = Busboy({ headers: req.headers });
      let uid = '';

      bb.on('file', async (fieldname, file, info) => {
        let size = 0;

        const passForSize = new PassThrough()
        const passForUpload = new PassThrough()

        file.pipe(passForSize) // 计算文件大小
        file.pipe(passForUpload) // 上传文件

        passForSize.on('data', (chunk) => {
          size += chunk.length;
        })

        passForSize.on('end', async () => {
          // 缓存照片信息到 Redis
          await this.redisClient.hset(
            `photos_info:${order.orderNumber}`,
            info.filename,
            JSON.stringify({
              name: info.filename.split('.')[0],
              size,
              orderId: order.id,
              ossFileKey: `${order.orderNumber}/${info.filename}`
            })
          )

          // 设置照片信息缓存过期时间
          await this.redisClient.expire(`photos_info:${order.orderNumber}`, this.REDIS_PHOTO_INFO_EXPIRE)
        })

        // 原图直接上传
        await this.minioService.uploadImage(passForUpload, `${order.orderNumber}/${info.filename}`)

        // 推送上传完成通知
        await this.eventService.pushMessage({
          type: ProcessingStatus.UPLOADED,
          orderNumber: order.orderNumber,
          filename: info.filename,
          message: '上传OSS完成',
          progress: 100,
        })

        // 推送压缩图片任务
        await this.photoQueue.add(PhotoJobName.PHOTO_COMPRESS, {
          uid,
          orderNumber: order.orderNumber,
          fileName: info.filename.split('.')[0],
          ossFileKey: `${order.orderNumber}/${info.filename}`,
        })
      })

      bb.on('field', (fieldname, val) => {
        if (fieldname === 'uid') uid = val
      })

      bb.on('finish', async () => {
        resolve('ok')
      })

      bb.on('error', (err) => {
        reject(err)
      })

      req.pipe(bb);
    })
  }

  /**
   * 批量存储照片信息
   * @param orderId 订单ID
   * @returns Promise<void>
   */
  async bulkSavePhotos(orderId: number) {
    const order = await this.getOrderById(orderId);
    const photoList = await this.redisClient.hgetall(`photos_info:${order.orderNumber}`)
    const photos = Object.values(photoList).map(photo => JSON.parse(photo))

    // 分批写入数据库
    for (let i = 0; i < photos.length; i += this.BATCH_INSERT_SIZE) {
      const batch = photos.slice(i, i + this.BATCH_INSERT_SIZE);
      await this.photoRepository.createQueryBuilder()
        .insert()
        .into(Photo)
        .values(batch.map(p => ({
          name: p.name,
          size: p.size,
          order: { id: p.orderId },
          ossFileKey: p.ossFileKey,
        })))
        .orIgnore() // 忽略重复插入
        .execute()
    }

    // 清空 Redis 中的照片信息缓存
    await this.redisClient.del(`photos_info:${order.orderNumber}`)
  }

  // 服务端压缩图片并上传到 Minio
  async savePhotoToMinio(
    orderId: number,
    file: Express.Multer.File,
    uid: string,
  ) {
    const delay: string = this.configService.get('minio_expire_time');
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');
    }

    // 去掉文件后缀名
    const fileName = file.originalname.split('.')[0];
    let photo = await this.photoRepository.findOneBy({
      order: { id: order.id },
      name: fileName,
    });

    // 如果存在则不重复创建
    if (photo) return

    const newPhoto = new Photo();
    newPhoto.name = fileName;
    newPhoto.size = file.size;
    newPhoto.order = order;
    newPhoto.ossFileKey = `${order.orderNumber}/${file.originalname}`;
    photo = await this.photoRepository.save(newPhoto);


    // 推送压缩图片并上传任务队列
    const compressJob = await this.photoQueue.add(PhotoJobName.PHOTO_COMPRESS, {
      id: photo.id,
      uid,
      fileName,
      fileBuffer: file.buffer,
      isRecommend: photo.isRecommended,
      orderNumber: order.orderNumber,
    });

    // 推送刷新 OSS URL 任务队列
    // await this.photoQueue.add(
    //   PhotoJobName.UrlRefresh,
    //   {
    //     photoId: photo.id,
    //     orderId: order.id,
    //   },
    //   { delay: (Number(delay) - 1) * 24 * 3600 * 1000 },
    // );

    return {
      data: {
        id: photo.id,
        fileName,
        fileSize: file.size,
        fileType: file.mimetype,
        taskId: compressJob.id,
      },
    };
  }

  // 更新照片预选状态
  async updatePhotoPreSelectStatus(orderId: number, dto: BulkUpdatePhotoPreselectStatusDto) {
    const order = await this.getOrderById(orderId)
    // 查找订单下匹配的照片
    const matchedPhotos = await this.photoRepository.find({
      where: {
        id: In(dto.photos.map(photo => photo.id)),
        order: { id: orderId },
      },
    });

    // 判断是否有不存在的照片
    if (matchedPhotos.length !== dto.photos.length) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '部分照片不存在或不属于该订单');
    }

    // 更新照片预选状态
    const updatedPhotos = matchedPhotos.map(photo => {
      const dtoPhoto = dto.photos.find(p => p.id === photo.id);
      if (dtoPhoto) {
        photo.preSelectStatus = dtoPhoto.status;
      }
      return photo
    })

    const result = await this.photoRepository.save(updatedPhotos);

    // 更新 Redis 中照片预选状态
    const pipeline = this.redisClient.pipeline()
    for (const photo of matchedPhotos) {
      const cachePhoto = await this.redisClient.hget(`photos_url:${order.orderNumber}`, photo.id.toString());
      console.log(cachePhoto)

      pipeline.hset(
        `photos_url:${order.orderNumber}`,
        photo.id,
        JSON.stringify({
          ...JSON.parse(cachePhoto),
          preSelectStatus: photo.preSelectStatus,
        })
      )
    }

    await pipeline.exec()

    return {
      data: result.map(photo => ({
        id: photo.id,
        status: photo.preSelectStatus
      })),
      msg: '更新预选状态成功',
    }
  }

  // 刷新 Redis 中的缓存数据(没有清除旧数据)
  async refreshPhotosCache(order: Order) {
    const photos = await this.photoRepository.find({
      where: { order: { id: order.id }, isDeleted: false },
    })

    const pipeline = this.redisClient.pipeline();

    for (const photo of photos) {
      const [thumbnailUrl, originalUrl, mediumUrl] = await Promise.all([
        this.minioService.generateGetUrl(
          `${order.orderNumber}/thumbnail/${photo.name}`,
        ),
        this.minioService.generateGetUrl(
          `${order.orderNumber}/${photo.name}`,
        ),
        this.minioService.generateGetUrl(
          `${order.orderNumber}/medium/${photo.name}`,
        ),
      ])

      pipeline.hset(
        `photos_url:${order.orderNumber}`,
        photo.id,
        JSON.stringify({
          fileName: photo.name,
          thumbnailUrl,
          originalUrl,
          mediumUrl,
          isRecommend: photo.isRecommended,
          preSelectStatus: photo.preSelectStatus,
          expires: dayjs().add(6, 'd').valueOf(),
        }),
      );
    }

    pipeline.expire(`photos_url:${order.orderNumber}`, 3600 * 6); // 设置过期时间为 6 天
    await pipeline.exec();
  }
}
