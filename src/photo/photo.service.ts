import { Body, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Photo } from './entities/photo.entity';
import { Repository } from 'typeorm';
import { CreatePhotosDto } from './dto/create-photos.dto';
import { Order } from '../order/entities/order.entity';
import { DatabaseException } from '../common/database-exception.filter';

@Injectable()
export class PhotoService {
  @InjectRepository(Order)
  private orderRepository: Repository<Order>;

  @InjectRepository(Photo)
  private photoRepository: Repository<Photo>;

  async createPhoto(orderId: number, createPhotosDto: CreatePhotosDto) {
    if (createPhotosDto.oss_urls.length === 0) {
      throw new DatabaseException('请上传至少一张图片');
    }

    const foundOrder = await this.orderRepository.findOneBy({ id: orderId });
    if (!foundOrder) {
      throw new DatabaseException('订单不存在');
    }

    const photoEntities = createPhotosDto.oss_urls.map((url) => ({
      oss_url: url,
      order: foundOrder,
    }));

    await this.photoRepository.insert(photoEntities);

    console.log(createPhotosDto);
    return 'This action adds a new photo';
  }
}
