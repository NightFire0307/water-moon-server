import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Photo, PreSelectStatus } from './entities/photo.entity';
import { In, Repository } from 'typeorm';
import { Order } from '../order/entities/order.entity';
import { PaginationQuery } from '@/common/decorators/pagination.decorator';
import { DeletePhotosDto } from './dto/delete-photos.dto';
import { UpdatePhotoRecommendDto } from './dto/update-photo-recommend.dto';
import { Redis } from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PhotoJobName } from './photo.processor';
import { MinioService } from '@/minio/minio.service';
import { ConfigService } from '@nestjs/config';
import dayjs from 'dayjs';
import {
  CommonErrorCode,
  DatabaseException,
} from '@/common/exceptions/database.exception';
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
    const existsCache = await this.redisClient.exists(`photos_url:${orderId}`);

    // 如果 Redis 中没有缓存，则从数据库中加载照片并缓存到 Redis
    if (existsCache === 0) {
      const pipeline = this.redisClient.pipeline()

      const order = await this.getOrderById(orderId);
      const photos = await this.photoRepository.find({
        where: { order: { id: order.id} },
      });


      for (const photo of photos) {
        pipeline.hset(`photos_url:${orderId}`, photo.name, JSON.stringify({
          id: photo.id,
          name: photo.name,
          ossUrlThumbnail: await this.minioService.generateGetUrl(`${order.orderNumber}/thumbnail/${photo.name}.webp`),
          ossUrlMedium: await this.minioService.generateGetUrl(`${order.orderNumber}/medium/${photo.name}.webp`),
          expiresAt: dayjs().add(6, 'd').valueOf(),
          preSelectStatus: PreSelectStatus.PENDING,
        }))
      }

      await pipeline.exec()
    }

    // 获取 Redis 中订单照片 OSS URL
    const oss_all_lists = await this.redisClient.hgetall(
      `photos_url:${orderId}`,
    );

    const total = Object.keys(oss_all_lists).length;
    const start = (pagination.current - 1) * pagination.pageSize;
    const end = pagination.current * pagination.pageSize;

    const oss_lists = Object.entries(oss_all_lists)
      .slice(start, end)
      .map(([, value]) => (JSON.parse(value)));

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
      let uid =''

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
          // 缓存照片信息到 Redis（用于入库）
          await this.redisClient.hset(
            `photos_info:${order.orderNumber}`,
            info.filename,
            JSON.stringify({
              name: info.filename.split('.')[0],
              size,
              orderId: order.id,
              ossKey: `${order.orderNumber}/${info.filename}`
            })
          )

          // 缓存照片信息到 Redis（用于前端展示）
          await this.redisClient.hset(
            `photos_url:${order.id}`,
            info.filename.split('.')[0],
            JSON.stringify({
              uid,
              name: info.filename.split('.')[0],
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
        })

        // 推送压缩图片任务
        await this.photoQueue.add(PhotoJobName.PHOTO_COMPRESS, {
          uid,
          orderId: order.id,
          orderNumber: order.orderNumber,
          name: info.filename.split('.')[0],
          ossKey: `${order.orderNumber}/${info.filename}`,
        })
      })

      bb.on('field', (fieldname, val) => {
        if (fieldname === 'uid') {
          uid = val
        }
      })

      bb.on('finish', async () => {
        resolve({
          data: {
            uid,
          },
          msg: '文件上传成功，正在处理中',
        })
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
    const insertedIds: number[] = []

    // 分批写入数据库
    for (let i = 0; i < photos.length; i += this.BATCH_INSERT_SIZE) {
      const batch = photos.slice(i, i + this.BATCH_INSERT_SIZE);
      try {
        const res = await this.photoRepository.createQueryBuilder()
          .insert()
          .into(Photo)
          .values(batch.map(p => ({
            name: p.name,
            size: p.size,
            order: { id: p.orderId },
            ossFileKey: p.ossKey,
          })))
          .execute()

        res.identifiers.forEach(i => insertedIds.push(i.id))
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          console.warn(`已有重复的ossKey: ${err.sqlMessage}`)
        }
      }
    }

    // 更新 Redis 中照片的 ID 信息
    const insertedPhotos = await this.photoRepository.findBy({ id: In(insertedIds) })
    for (const { id, name } of insertedPhotos) {
      const cachePhoto = await this.redisClient.hget(`photos_url:${orderId}`, name)
      await this.redisClient.hset(`photos_url:${orderId}`, name, JSON.stringify({
        id,
        ...JSON.parse(cachePhoto),
      }))
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
      const cachePhoto = await this.redisClient.hget(`photos_url:${order.id}`, photo.name);
      console.log(cachePhoto)

      pipeline.hset(
        `photos_url:${order.id}`,
        photo.name,
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
      const [ossUrlThumbnail, ossUrlMedium] = await Promise.all([
        this.minioService.generateGetUrl(
          `${order.orderNumber}/thumbnail/${photo.name}`,
        ),
        this.minioService.generateGetUrl(
          `${order.orderNumber}/medium/${photo.name}`,
        ),
      ])

      pipeline.hset(
        `photos_url:${order.id}`,
        photo.name,
        JSON.stringify({
          id: photo.id,
          name: photo.name,
          ossUrlMedium,
          ossUrlThumbnail,
          preSelectStatus: photo.preSelectStatus,
          expires: dayjs().add(6, 'd').valueOf(),
        }),
      );
    }

    pipeline.expire(`photos_url:${order.orderNumber}`, 3600 * 6); // 设置过期时间为 6 天
    await pipeline.exec();
  }

  // 清除订单所有照片
  async deleteAllPhotos(orderId: number) {
    const order = await this.getOrderById(orderId)

    // 删除数据库中的照片记录
    const res = await this.photoRepository.delete({ order })
    console.log(res)

    // 删除 Redis 中的照片缓存
    await this.redisClient.del(`photos_url:${order.id}`)

    return {
      data: 'success',
      msg: '删除成功'
    }
  }
}
