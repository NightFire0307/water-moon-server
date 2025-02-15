import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Photo } from './entities/photo.entity';
import { In, Repository } from 'typeorm';
import { CreatePhotosDto } from './dto/create-photos.dto';
import { Order } from '../order/entities/order.entity';
import {
  DatabaseErrorType,
  DatabaseException,
} from '../common/database-exception.filter';
import { PaginationQuery } from '../common/custom.decorator';
import { DeletePhotosDto } from './dto/delete-photos.dto';
import { UpdatePhotoRecommendDto } from './dto/update-photo-recommend.dto';
import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import {
  RedisErrorType,
  RedisException,
} from '../common/redis-exception.filter';
import { MinioService } from '../minio/minio.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'node:fs/promises';
import * as process from 'node:process';

@Injectable()
export class PhotoService {
  constructor(@InjectQueue('photo') private photoQueue: Queue) {}

  @Inject(ConfigService)
  private readonly configService: ConfigService;

  @Inject(MinioService)
  private readonly minioService: MinioService;

  @InjectRepository(Order)
  private readonly orderRepository: Repository<Order>;

  @InjectRepository(Photo)
  private readonly photoRepository: Repository<Photo>;

  @Inject('MINIO_CLIENT')
  private readonly minioClient: Minio.Client;

  @Inject('REDIS_CLIENT')
  private readonly redisClient: Redis;

  // 获取订单信息
  async getOrderById(orderId: number) {
    const foundOrder = await this.orderRepository.findOne({
      where: {
        id: orderId,
      },
    });
    if (!foundOrder) {
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '订单不存在',
      );
    }

    return foundOrder;
  }

  async getPhotosByOrderId(orderId: number, pagination: PaginationQuery) {
    const order = await this.getOrderById(orderId);

    // 获取 Redis 中订单照片 OSS URL
    const oss_all_lists = await this.redisClient.hgetall(
      `photos_url:${order.order_number}`,
    );

    const total = Object.keys(oss_all_lists).length;
    const start = (pagination.current - 1) * pagination.pageSize;
    const end = pagination.current * pagination.pageSize;

    const oss_lists = Object.entries(oss_all_lists)
      .slice(start, end)
      .map(([key, value]) => ({ id: key, ...JSON.parse(value) }));

    return {
      list: oss_lists,
      total,
    };
  }

  async savePhotoOssUrl(
    orderId: number,
    createPhotosDtoList: CreatePhotosDto[],
  ) {
    const order = await this.orderRepository.findOneBy({ id: orderId });
    if (!order) {
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '订单不存在',
      );
    }

    const bucketName: string = this.configService.get('minio_bucket');
    const expires = 24 * 60 * 60 * 7;

    const photoEntities: Photo[] = [];

    for (const dto of createPhotosDtoList) {
      const ossFileKey = `${order.order_number}/${dto.file_name}`;

      photoEntities.push({
        order,
        oss_file_key: ossFileKey,
        name: dto.file_name,
        size: dto.file_size,
      } as Photo);
    }

    // 批量插入数据库
    const savedPhotos = await this.photoRepository.save(photoEntities);

    const redisData = [];
    for (const photo of savedPhotos) {
      const presignedUrl = await this.minioClient.presignedGetObject(
        bucketName,
        `${order.order_number}/${photo.name}`,
        expires,
      );

      redisData.push({
        id: photo.id,
        oss_url: presignedUrl,
        name: photo.name,
        size: photo.size,
        is_recommended: photo.is_recommended,
      });
    }

    // 批量插入 Redis
    if (redisData.length > 0) {
      const pipeline = this.redisClient.pipeline();

      redisData.forEach((photo) => {
        const redisKey = `photos_url:${order.order_number}`;

        pipeline.hset(redisKey, photo.id, JSON.stringify(photo));
      });

      // 设置过期时间
      pipeline.expire(`photos_url:${order.order_number}`, expires);
      try {
        await pipeline.exec();
      } catch (e) {
        throw new RedisException(RedisErrorType.UNKNOWN_ERROR, e);
      }
    }

    // Redis 照片计数
    this.redisClient.incrby(
      `photo_count:${order.order_number}`,
      createPhotosDtoList.length,
    );

    return redisData;
  }

  async deletePhotos(orderId: number, deletePhotosDto: DeletePhotosDto) {
    // 删除照片的批量操作，每次最多删除50张
    const batchSize = 100;
    const { photoIds } = deletePhotosDto;
    const order = await this.getOrderById(orderId);

    // 删除 Redis 中的照片 URL
    const photoUrlsRedisKey = `photos_url:${order.order_number}`;
    const photoUrlsHash = await this.redisClient.hgetall(photoUrlsRedisKey);
    const redisPipeline = this.redisClient.pipeline();
    for (const photoId in photoUrlsHash) {
      if (photoIds.includes(Number(photoId))) {
        redisPipeline.hdel(photoUrlsRedisKey, photoId);
      }
    }

    redisPipeline.incrby(`photo_count:${order.order_number}`, -photoIds.length);

    await redisPipeline.exec();

    try {
      for (let i = 0; i < photoIds.length; i += batchSize) {
        const batch = photoIds.slice(i, i + batchSize);
        await this.photoRepository.update(
          { id: In(batch), order: { id: orderId } },
          { is_deleted: true },
        );
      }
    } catch (e) {
      throw new DatabaseException(DatabaseErrorType.DEFAULT, e);
    }

    return { message: '删除照片成功', data: [] };
  }

  async updatePhotoRecommendStatus(
    orderId: number,
    updatePhotoRecommendStatusDto: UpdatePhotoRecommendDto,
  ) {
    const { photoIds, isRecommended } = updatePhotoRecommendStatusDto;
    await this.getOrderById(orderId);

    try {
      const { affected } = await this.photoRepository.update(
        { id: In(photoIds), order: { id: orderId }, is_deleted: false },
        { is_recommended: isRecommended },
      );

      if (affected === photoIds.length) {
        return { message: '更新推荐状态成功', data: [] };
      }
    } catch (e) {
      console.log(e);
      throw new DatabaseException(DatabaseErrorType.DEFAULT, e);
    }
  }

  // 服务端压缩图片并上传到 Minio
  async savePhotoToMinio(orderId: number, file: Express.Multer.File) {
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '订单不存在',
      );
    }

    // 去掉文件后缀名
    const file_name = file.originalname.split('.')[0];
    let photo = await this.photoRepository.findOneBy({
      order: { id: order.id },
      name: file_name,
    });

    // 如果图片不存在
    if (!photo) {
      const newPhoto = new Photo();
      newPhoto.name = file_name;
      newPhoto.size = file.size;
      newPhoto.order = order;
      newPhoto.oss_file_key = `${order.order_number}/${file.originalname}`;
      photo = await this.photoRepository.save(newPhoto);
    }

    // 缓存图片到本地
    const tempDir = `${process.cwd()}\\tmp\\${order.order_number}`;
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(`${tempDir}\\${file.originalname}`, file.buffer);

    // 推送压缩图片并上传任务队列
    const job = await this.photoQueue.add(
      'compressImage',
      {
        id: photo.id,
        order_number: order.order_number,
        file_name,
        file_path: `${tempDir}\\${file.originalname}`,
      },
      { delay: 100 },
    );

    return {
      id: photo.id,
      fileName: file_name,
      fileSize: file.size,
      fileType: file.mimetype,
      taskId: job.id,
    };
  }
}
