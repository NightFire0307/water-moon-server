import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import basex from 'base-x';
import { Redis } from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { In, Repository } from 'typeorm';
import {
  DatabaseErrorType,
  DatabaseException,
} from '../common/database-exception.filter';
import { SelectionLoginDto } from './dto/selection-login.dto';
import { JwtService } from '@nestjs/jwt';
import { SelectionPhotosUpdate } from './dto/selection-photos-update.dto';
import { Photo } from '../photo/entities/photo.entity';
import { Product } from '../product/entities/product.entity';
import { OrderProduct } from '../order/entities/orderProduct.entity';

@Injectable()
export class SelectionService {
  @Inject('REDIS_CLIENT')
  private readonly redisClient: Redis;

  @Inject(JwtService)
  private readonly jwtService: JwtService;

  @InjectRepository(Order)
  private readonly orderRepository: Repository<Order>;

  @InjectRepository(OrderProduct)
  private readonly orderProductRepository: Repository<OrderProduct>;

  @InjectRepository(Product)
  private readonly productRepository: Repository<Product>;

  @InjectRepository(Photo)
  private readonly photoRepository: Repository<Photo>;

  // 校验短链和密码
  async validateLinkAndPassword(
    orderId: number,
    { short_url, password }: SelectionLoginDto,
  ) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order)
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '订单不存在',
      );

    // 校验Redis中的链接密码
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

  /**
   * 解码短链
   * @param short_url
   * @return 订单号
   */
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
      .leftJoinAndSelect('product.product_type', 'product_type')
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
        'product_type.name',
        'select_photos.id',
      ])
      .cache(true)
      .getOne();

    if (!order)
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '订单不存在',
      );

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

  // 获取选片订单所有照片
  async getSelectedPhotos(orderId: number) {
    const order = await this.findOrderById(orderId);
    const result = [];

    const photos = await this.redisClient.hgetall(
      `photos_url:${order.order_number}`,
    );

    for (const key in photos) {
      const value = photos[key];
      result.push({
        id: Number(key),
        ...JSON.parse(value),
      });
    }

    return {
      data: result,
    };
  }

  // 更新产品照片
  async updateSelectedPhotos(
    orderId: number,
    selectedPhotos: SelectionPhotosUpdate,
  ) {
    const { orderProductId, photoIds } = selectedPhotos;

    const orderProduct = await this.orderProductRepository.findOne({
      where: {
        id: orderProductId,
        order: {
          id: orderId,
        },
      },
      relations: ['product'],
    });

    if (!orderProduct)
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '订单产品不存在',
      );

    const product = await this.productRepository.findOne({
      where: {
        id: orderProduct.product.id,
      },
      relations: ['select_photos'],
      select: ['id', 'name', 'select_photos'],
    });

    if (!product)
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '产品不存在',
      );

    const photos = await this.photoRepository.find({
      where: {
        id: In(photoIds),
      },
    });

    if (photos.length !== photoIds.length) {
      throw new BadRequestException('部分照片ID无');
    }

    product.select_photos = photos;

    await this.productRepository.save(product);

    return {
      data: {
        ...product,
        select_photos: product.select_photos.map((photo) => photo.id),
      },
    };
  }

  // 刷新access_token
  async refreshToken(refreshToken: string, surl: string) {
    console.log(refreshToken);
    try {
      const data = await this.jwtService.verifyAsync(refreshToken);
      return {
        data: {
          access_token: await this.jwtService.signAsync(
            { orderId: data.orderId, short_url: surl },
            { expiresIn: '2h' },
          ),
        },
      };
    } catch {
      throw new BadRequestException('无效的 refresh token');
    }
  }

  // 查找订单
  private async findOrderById(id: number) {
    const order = await this.orderRepository.findOneBy({ id });
    if (!order)
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '订单不存在',
      );
    return order;
  }
}
