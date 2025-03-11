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
    console.log(orderId);

    const order = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.order_products', 'order_products')
      .leftJoinAndSelect('order_products.product', 'product')
      .leftJoinAndSelect('product.product_type', 'product_type')
      .leftJoinAndSelect('order_products.selected_photos', 'select_photos')
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
        order_products: order.order_products.map((order_product) => {
          return {
            ...order_product,
            product: {
              ...order_product.product,
              product_type: order_product.product.product_type.name,
            },
            selected_photos: order_product.selected_photos.map(
              (photo) => photo.id,
            ),
          };
        }),
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
    productPhotoSelection: ProductPhotoSelectionDto,
  ) {
    const { orderProductId, photoIds } = productPhotoSelection;

    // 验证订单存在
    await this.findOrderById(orderId);

    // 获取订单产品
    const orderProduct = await this.orderProductRepository.findOne({
      where: {
        order: { id: orderId },
        id: orderProductId,
      },
      relations: ['selected_photos'],
      select: ['id', 'selected_photos'],
    });

    if (!orderProduct) {
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '订单产品不存在',
      );
    }

    // 确保没有重复的照片ID
    const uniquePhotoIds = new Set(photoIds);
    if (photoIds.length !== uniquePhotoIds.size) {
      throw new BadRequestException('包含重复的照片ID');
    }

    // 当产品不允许额外照片时，检查选择的照片数量
    if (
      !orderProduct.allow_extra_photos &&
      photoIds.length > orderProduct.quantity
    ) {
      throw new BadRequestException(
        `产品不允许选择超过 ${orderProduct.quantity} 张照片`,
      );
    }

    // 批量获取所有照片
    const photos = await this.photoRepository.find({
      where: {
        id: In([...uniquePhotoIds]),
      },
    });

    if (photos.length !== uniquePhotoIds.size) {
      throw new BadRequestException('部分照片ID不存在');
    }

    return this.orderProductRepository.manager.transaction(
      async (transactionalEntityManager) => {
        // 更新订单产品的选择照片
        orderProduct.selected_photos = photos;

        // 保存更新
        await transactionalEntityManager.save(orderProduct);

        return {
          data: {
            orderProductId: orderProduct.id,
            selected_photos: photoIds, // 直接使用原始photoIds作为结果
          },
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
