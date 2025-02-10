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

@Injectable()
export class PhotoService {
  @Inject(ConfigService)
  private readonly configService: ConfigService;

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

    // const [photos, total] = await this.photoRepository.findAndCount({
    //   where: {
    //     order: { id: orderId },
    //   },
    //   take: pagination.pageSize,
    //   skip: (pagination.current - 1) * pagination.pageSize,
    // });

    // 获取 Redis 中订单照片 OSS URL
    const oss_all_lists = await this.redisClient.hgetall(
      `photos_url:${order.order_number}`,
    );

    const total = Object.keys(oss_all_lists).length;
    const start = (pagination.current - 1) * pagination.pageSize;
    const end = pagination.current * pagination.pageSize;

    const oss_lists = Object.values(oss_all_lists)
      .slice(start, end)
      .map((item) => JSON.parse(item));

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
        photo.name,
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
        const photoName = photo.name;

        pipeline.hset(redisKey, photoName, JSON.stringify(photo));
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
    await this.getOrderById(orderId);

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
}
