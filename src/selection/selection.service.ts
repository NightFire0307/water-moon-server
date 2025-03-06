import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import basex from 'base-x';
import { Redis } from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Order, OrderStatus } from '../order/entities/order.entity';
import { In, Repository } from 'typeorm';
import {
  DatabaseErrorType,
  DatabaseException,
} from '../common/database-exception.filter';
import { SelectionLoginDto } from './dto/selection-login.dto';
import { JwtService } from '@nestjs/jwt';
import { Photo } from '../photo/entities/photo.entity';
import { Product } from '../product/entities/product.entity';
import { OrderProduct } from '../order/entities/orderProduct.entity';
import { ProductPhotoSelectionDto } from './dto/selection-photos-update.dto';

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
    } catch {
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

  // 批量更新产品照片
  async updateSelectedPhotos(
    orderId: number,
    selectedPhotos: ProductPhotoSelectionDto[],
  ) {
    // 验证订单存在
    await this.findOrderById(orderId);

    // 获取所有需要更新的产品ID列表
    const orderProductIds = selectedPhotos.map((item) => item.orderProductId);

    // 批量获取所有的订单产品
    const orderProducts = await this.orderProductRepository.find({
      where: {
        id: In(orderProductIds),
        order: {
          id: orderId,
        },
      },
      relations: ['product'],
    });

    if (orderProducts.length !== orderProductIds.length) {
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '部分订单产品不存在',
      );
    }

    // 创建产品ID到orderProduct的映射，方便快速查找
    const orderProductMap = new Map(
      orderProducts.map((orderProduct) => [orderProduct.id, orderProduct]),
    );

    // 收集所有照片ID用于批量查询
    const allPhotoIds = selectedPhotos.reduce((ids, item) => {
      return [...ids, ...item.photoIds];
    }, []);

    // 批量获取所有照片
    const allPhotos = await this.photoRepository.find({
      where: {
        id: In(allPhotoIds),
      },
    });

    if (allPhotos.length !== new Set(allPhotoIds).size) {
      throw new BadRequestException('部分照片ID不存在');
    }

    // 创建照片ID到照片实体的映射
    const photoMap = new Map(allPhotos.map((photo) => [photo.id, photo]));

    // 使用事务来确保数据一致性
    return this.productRepository.manager.transaction(
      async (transactionalEntityManager) => {
        // 批量更新结果
        const results = [];

        // 逐个处理每个产品的照片更新
        for (const item of selectedPhotos) {
          const orderProduct = orderProductMap.get(item.orderProductId);

          const product = await transactionalEntityManager.findOne(Product, {
            where: {
              id: orderProduct.product.id,
            },
            relations: ['select_photos'],
            select: ['id', 'name', 'select_photos'],
          });

          if (!product) {
            throw new DatabaseException(
              DatabaseErrorType.DATA_NOT_FOUND,
              `产品ID ${orderProduct.product.id} 不存在`,
            );
          }

          // 映射照片ID到照片实体
          const photos = item.photoIds.map((id) => photoMap.get(id));

          // 更新产品关联的照片
          product.select_photos = photos;

          // 保存更新后的产品
          await transactionalEntityManager.save(product);

          results.push({
            ...product,
            select_photos: product.select_photos.map((photo) => photo.id),
          });
        }

        return {
          data: results,
        };
      },
    );
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

  // 锁定选片结果
  async submitOrder(orderId: number) {
    const order = await this.findOrderById(orderId);

    if (order.status === OrderStatus.IN_PROGRESS) {
      order.status = OrderStatus.SUBMITTED;
      await this.orderRepository.save(order);
      return {
        data: {
          ...order,
        },
      };
    }

    throw new BadRequestException('当前订单状态不允许锁定');
  }
}
