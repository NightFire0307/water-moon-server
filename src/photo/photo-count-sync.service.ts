import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../order/entities/order.entity';

@Injectable()
export class PhotoCountSyncService {
  @Inject('REDIS_CLIENT')
  private readonly redisClient: Redis;

  @InjectRepository(Order)
  private orderRepository: Repository<Order>;

  // 定时任务，每30秒同步一次照片数量
  @Cron('*/30 * * * * *')
  async syncPhotoCount() {
    // 获取所有照片数量
    const keys = await this.redisClient.keys('photos_count:*');
    for (const key of keys) {
      const order_number = key.split(':')[1];
      const count = await this.redisClient.get(key);

      const order = await this.orderRepository.findOne({
        where: { order_number },
      });
      // if (order) {
      //   await this.orderRepository.update(
      //     { order_number },
      //     { total_photos: order.total_photos + Number(count) },
      //   );
      // }

      await this.redisClient.del(key);
      console.log('同步订单号为', order_number, '的照片数量为', count);
    }
  }
}
