import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Photo } from './entities/photo.entity';
import { In, Repository } from 'typeorm';
import { Order } from '../order/entities/order.entity';
import {
  DatabaseErrorType,
  DatabaseException,
} from '../common/database-exception.filter';
import { PaginationQuery } from '../common/custom.decorator';
import { DeletePhotosDto } from './dto/delete-photos.dto';
import { UpdatePhotoRecommendDto } from './dto/update-photo-recommend.dto';
import { Redis } from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PhotoJobName } from './compress-photo.processor';
import { MinioService } from '../minio/minio.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PhotoService {
  constructor(
    @InjectQueue('photo') private readonly photoQueue: Queue,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Photo)
    private readonly photoRepository: Repository<Photo>,
    @Inject(MinioService) private readonly minioService: MinioService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

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

  // 获取订单照片
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
      .map(([key, value]) => ({
        id: Number(key),
        ...JSON.parse(value),
      }));

    // 判断链接是否过期，如果过期则重新生成链接
    const now = Math.floor(Date.now() / 1000);
    for (const photo of oss_lists) {
      if (photo.expires < now) {
        photo.thumbnail_url = await this.minioService.generateGetUrl(
          `${order.order_number}/thumbnail_${photo.file_name}`,
        );
        photo.original_url = await this.minioService.generateGetUrl(
          `${order.order_number}/${photo.file_name}`,
        );

        // 更新 Redis 中照片 URL
        await this.redisClient.hset(
          `photos_url:${order.order_number}`,
          photo.id,
          JSON.stringify({
            file_name: photo.file_name,
            thumbnail_url: photo.thumbnail_url,
            original_url: photo.original_url,
            is_recommend: photo.is_recommend,
            expires: photo.expires,
          }),
        );
      }
    }

    return {
      data: {
        list: oss_lists,
        total,
      },
    };
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
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '订单不存在',
      );
    }

    // 修改 Redis 中照片推荐状态
    const photosUrl = await this.redisClient.hgetall(
      `photos_url:${order.order_number}`,
    );
    const pipeline = this.redisClient.pipeline();
    for (const photoId in photosUrl) {
      if (photoIds.includes(Number(photoId))) {
        const photo = JSON.parse(photosUrl[photoId]);
        photo.is_recommend = isRecommended;
        pipeline.hset(
          `photos_url:${order.order_number}`,
          photoId,
          JSON.stringify(photo),
        );
      }
    }
    await pipeline.exec();

    // 推送修改数据库中照片推荐状态任务队列
    await this.photoQueue.add(PhotoJobName.UpdateRecommend, {
      orderId,
      photoIds,
      isRecommended,
    });

    return {
      data: photoIds,
      msg: '修改成功',
    };
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

    // 推送压缩图片并上传任务队列
    const compressJob = await this.photoQueue.add(PhotoJobName.CompressImage, {
      id: photo.id,
      uid,
      file_buffer: file.buffer,
      order_number: order.order_number,
      is_recommend: photo.is_recommended,
      file_name,
    });

    // 推送刷新 OSS URL 任务队列
    await this.photoQueue.add(
      PhotoJobName.UrlRefresh,
      {
        photoId: photo.id,
        orderId: order.id,
      },
      { delay: (Number(delay) - 1) * 24 * 3600 * 1000 },
    );

    return {
      data: {
        id: photo.id,
        fileName: file_name,
        fileSize: file.size,
        fileType: file.mimetype,
        taskId: compressJob.id,
      },
    };
  }
}
