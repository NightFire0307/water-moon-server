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
import * as dayjs from 'dayjs';
import {
  CommonErrorCode,
  DatabaseException,
} from '../../common/exceptions/database.exception';
import type { BulkUpdatePhotoPreselectStatusDto } from '../selection/dto/update-photo-preselect-status.dto';

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
        photo.thumbnail_url = await this.minioService.generateGetUrl(
          `${order.orderNumber}/thumbnail_${photo.file_name}`,
        );
        photo.original_url = await this.minioService.generateGetUrl(
          `${order.orderNumber}/${photo.file_name}`,
        );

        // 更新 Redis 中照片 URL
        await this.redisClient.hset(
          `photos_url:${order.orderNumber}`,
          photo.id,
          JSON.stringify({
            file_name: photo.file_name,
            thumbnail_url: photo.thumbnail_url,
            original_url: photo.original_url,
            is_recommend: photo.is_recommend,
            expires: dayjs().add(6, 'd').valueOf(),
            remark: photo.remark,
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

    // 修改 Redis 中照片推荐状态
    const photosUrl = await this.redisClient.hgetall(
      `photos_url:${order.orderNumber}`,
    );
    const pipeline = this.redisClient.pipeline();
    for (const photoId in photosUrl) {
      if (photoIds.includes(Number(photoId))) {
        const photo = JSON.parse(photosUrl[photoId]);
        photo.is_recommend = isRecommended;
        pipeline.hset(
          `photos_url:${order.orderNumber}`,
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
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');
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
      newPhoto.oss_file_key = `${order.orderNumber}/${file.originalname}`;
      photo = await this.photoRepository.save(newPhoto);
    }

    // 推送压缩图片并上传任务队列
    const compressJob = await this.photoQueue.add(PhotoJobName.CompressImage, {
      id: photo.id,
      uid,
      file_buffer: file.buffer,
      orderNumber: order.orderNumber,
      is_recommend: photo.is_recommended,
      file_name,
      remark: '',
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

  // 更新照片预选状态
  async updatePhotoPreSelectStatus(orderId: number, dto: BulkUpdatePhotoPreselectStatusDto) {
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
        photo.pre_select_status = dtoPhoto.status;
      }
      return photo
    })


    const result = await this.photoRepository.save(updatedPhotos);
    return {
      data: result.map(photo => ({
        id: photo.id,
        status: photo.pre_select_status
      })),
      msg: '更新预选状态成功',
    }
  }
}
