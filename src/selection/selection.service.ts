import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import basex from 'base-x';
import { Redis } from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { Repository } from 'typeorm';
import {
  DatabaseErrorType,
  DatabaseException,
} from '../common/database-exception.filter';
import { SelectionDto } from './dto/selection.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class SelectionService {
  @Inject('REDIS_CLIENT')
  private readonly redisClient: Redis;

  @Inject(JwtService)
  private readonly jwtService: JwtService;

  @InjectRepository(Order)
  private readonly orderRepository: Repository<Order>;

  // 校验短链和密码
  async validateLinkAndPassword(
    orderId: number,
    { short_url, password }: SelectionDto,
  ) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order)
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '订单不存在',
      );

    // 校验Redis
    const sharedLink = await this.redisClient.hget(
      `share_link:${order.order_number}`,
      short_url,
    );

    const sharedLinkObj = JSON.parse(sharedLink);

    if (sharedLinkObj.password !== password) {
      throw new BadRequestException('密码错误');
    }

    return {
      access_token: await this.jwtService.signAsync(
        { orderId, short_url },
        { expiresIn: '2h' },
      ),
      refresh_token: await this.jwtService.signAsync(
        { orderId },
        { expiresIn: '30d' },
      ),
    };
  }

  // 解码短链获取订单ID
  decodeOrderId(short_url: string): string {
    const BASE62 =
      '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const bs62 = basex(BASE62);

    try {
      const decodedUrl = bs62.decode(short_url);
      const textDecoder = new TextDecoder('utf-8');
      return textDecoder.decode(decodedUrl).split('_')[0];
    } catch (e) {
      throw new Error('Invalid short URL');
    }
  }

  // 获取选片订单产品
  async getSelectedProducts(orderId: number) {
    const order = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.order_products', 'order_products')
      .leftJoinAndSelect('order_products.product', 'product')
      .leftJoinAndSelect('product.select_photos', 'select_photos')
      .where('order.id = :orderId', { orderId })
      .select([
        'order.id',
        'order.order_number',
        'order.customer_name',
        'order.customer_phone',
        'order.status',
        'order_products',
        'product.id',
        'product.name',
        'select_photos.id',
      ])
      .getOne();

    return {
      data: {
        ...order,
        order_products: order.order_products.map((orderProduct) => ({
          ...orderProduct,
          product: {
            ...orderProduct.product,
            select_photos: orderProduct.product.select_photos.map(
              (photo) => photo.id,
            ), // 提取 select_photos 的 id
          },
        })),
      },
    };
  }
}
