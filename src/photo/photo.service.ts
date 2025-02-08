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
    await this.getOrderById(orderId);

    const [photos, total] = await this.photoRepository.findAndCount({
      where: {
        order: { id: orderId },
      },
      take: pagination.pageSize,
      skip: (pagination.current - 1) * pagination.pageSize,
    });

    return {
      list: photos,
      total,
      ...pagination,
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
    const redisData = [];

    for (const dto of createPhotosDtoList) {
      const ossFileKey = `${order.order_number}/${dto.objectName}`;
      const presignedUrl = await this.minioClient.presignedGetObject(
        bucketName,
        dto.objectName,
        expires,
      );

      photoEntities.push({
        order,
        oss_file_key: ossFileKey,
        name: dto.objectName,
      } as Photo);

      redisData.push(
        JSON.stringify({
          name: dto.objectName,
          oss_url: presignedUrl,
        }),
      );
    }

    await this.photoRepository.save(photoEntities);

    // 批量插入 Redis
    if (redisData.length > 0) {
      this.redisClient.rpush(order.order_number, ...redisData);
    }

    // 设置过期时间
    this.redisClient.expire(order.order_number, expires);

    // Redis 照片计数
    this.redisClient.incrby(
      `photo_count:${order.order_number}`,
      createPhotosDtoList.length,
    );

    return redisData.map((item) => JSON.parse(item));
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
