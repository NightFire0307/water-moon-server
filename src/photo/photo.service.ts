import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Photo } from './entities/photo.entity';
import { In, Repository } from 'typeorm';
import { CreatePhotosDto } from './dto/create-photos.dto';
import { Order } from '../order/entities/order.entity';
import { DatabaseException } from '../common/database-exception.filter';
import { PaginationQuery } from '../common/custom.decorator';
import { DeletePhotosDto } from './dto/delete-photos.dto';
import { UpdatePhotoRecommendDto } from './dto/update-photo-recommend.dto';

@Injectable()
export class PhotoService {
  @InjectRepository(Order)
  private orderRepository: Repository<Order>;

  @InjectRepository(Photo)
  private photoRepository: Repository<Photo>;

  // 获取订单信息
  async getOrderById(orderId: number) {
    const foundOrder = await this.orderRepository.findOne({
      where: {
        id: orderId,
      },
    });
    if (!foundOrder) {
      throw new DatabaseException('订单不存在');
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

  async createPhoto(orderId: number, createPhotosDto: CreatePhotosDto) {
    if (createPhotosDto.oss_urls.length === 0) {
      throw new DatabaseException('请上传至少一张图片');
    }

    const foundOrder = await this.getOrderById(orderId);

    const photoEntities = createPhotosDto.oss_urls.map((url) => ({
      oss_url: url,
      order: foundOrder,
    }));

    await this.photoRepository.insert(photoEntities);

    console.log(createPhotosDto);
    return 'This action adds a new photo';
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
    } catch {
      throw new DatabaseException('删除照片失败');
    }

    return '删除照片成功';
  }

  async updatePhotoRecommendStatus(
    orderId: number,
    updatePhotoRecommendStatusDto: UpdatePhotoRecommendDto,
  ) {
    const { photoIds, isRecommended } = updatePhotoRecommendStatusDto;
    await this.getOrderById(orderId);

    try {
      await this.photoRepository.update(
        { id: In(photoIds), order: { id: orderId }, is_deleted: false },
        { is_recommended: isRecommended },
      );
    } catch (e) {
      console.log(e);
      throw new DatabaseException('更新推荐状态失败');
    }

    return '更新推荐状态成功';
  }
}
