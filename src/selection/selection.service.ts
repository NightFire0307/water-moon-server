import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import basex from 'base-x';
import { Redis } from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Order, OrderStatus } from '../order/entities/order.entity';
import { In, Repository } from 'typeorm';
import { SelectionLoginDto } from './dto/selection-login.dto';
import { JwtService } from '@nestjs/jwt';
import { Photo } from '../photo/entities/photo.entity';
import { Product } from '../product/entities/product.entity';
import { OrderProduct } from '../order/entities/orderProduct.entity';
import { ProductPhotoSelectionDto } from './dto/selection-photos-update.dto';
import { SelectionRemarkUpdateDto } from './dto/selection-remark-update.dto';
import {
  CommonErrorCode,
  DatabaseException,
  OrderErrorCode,
} from '../common/exceptions/database.exception';

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

  // 校验短链是否存在
  async verifyToken(shortUrl: string) {
    const decodedOrderId = this.decodeOrderId(shortUrl);

    const order = await this.findOrderById(+decodedOrderId);

    return {
      data: order.id,
    };
  }

  // 校验短链和密码
  async validateLinkAndPassword(
    orderId: number,
    { short_url, password }: SelectionLoginDto,
  ) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order)
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, { orderId });

    // 校验Redis中的链接密码
    const sharedLink = await this.redisClient.hget(
      `share_link:${order.order_number}`,
      short_url,
    );

    const sharedLinkObj = JSON.parse(sharedLink);

    if (sharedLinkObj.password !== password) {
      throw new BadRequestException('密码错误');
    }

    // 更新订单状态
    if (order.status === OrderStatus.PENDING) {
      order.status = OrderStatus.IN_PROGRESS;
      await this.orderRepository.save(order);
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
        'order.max_select_photos',
        'order.extra_photo_price',
        'order.order_number',
        'order.customer_name',
        'order.customer_phone',
        'order.status',
        'order_products',
        'product.id',
        'product.name',
        'product.photo_limit',
        'product_type.name',
        'select_photos.id',
      ])
      .cache(true)
      .getOne();

    const [, total_photos] = await this.photoRepository.findAndCount({
      where: {
        order: { id: orderId },
      },
    });

    if (!order)
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, { orderId });

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
        total_photos,
      },
    };
  }

  // 更新产品照片
  async updateSelectedPhotos(
    orderId: number,
    productPhotoSelection: ProductPhotoSelectionDto,
  ) {
    const { orderProductId, photoIds } = productPhotoSelection;

    // 验证订单存在
    const order = await this.findOrderById(orderId);

    // 验证订单是否已经提交锁定
    if (order.status === OrderStatus.SUBMITTED) {
      throw new DatabaseException(
        OrderErrorCode.ORDER_IS_SUBMIT,
        '选片结果已锁定，如需更改请联系选片师',
      );
    }

    // 获取订单产品
    const orderProduct = await this.orderProductRepository.findOne({
      where: {
        order: { id: orderId },
        id: orderProductId,
      },
      relations: ['selected_photos'],
      select: ['id', 'selected_photos', 'product'],
    });

    if (!orderProduct) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单产品不存在');
    }

    // 确保没有重复的照片ID
    const uniquePhotoIds = new Set(photoIds);
    if (photoIds.length !== uniquePhotoIds.size) {
      throw new BadRequestException('包含重复的照片ID');
    }

    // 当产品不允许额外照片时，检查选择的照片数量
    // TODO

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
  async refreshToken(refreshToken: string) {
    console.log(refreshToken);
    try {
      const data = await this.jwtService.verifyAsync(refreshToken);
      return {
        data: {
          access_token: await this.jwtService.signAsync(
            { orderId: data.orderId, short_url: data.surl },
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
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');
    return order;
  }

  // 移除照片所有的产品标记
  async removeAllTags(orderId: number, photoId: number) {
    const orderProducts = await this.orderProductRepository.find({
      where: {
        order: { id: orderId },
      },
      relations: ['selected_photos'],
    });

    if (orderProducts.length === 0) {
      throw new BadRequestException('没有找到与该照片关联的订单产品');
    }

    console.log(orderProducts[0].selected_photos);

    await this.orderProductRepository.manager.transaction(
      async (transactionalEntityManager) => {
        for (const orderProduct of orderProducts) {
          orderProduct.selected_photos = orderProduct.selected_photos.filter(
            (photo) => photo.id !== photoId,
          );
          console.log(orderProduct.selected_photos);
          await transactionalEntityManager.save(orderProduct);
        }
      },
    );

    return {
      msg: '成功移除所有与该照片关联的订单产品',
    };
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

  async updatePhotoRemark({ photoId, remark }: SelectionRemarkUpdateDto) {
    const photo = await this.getPhotoById(photoId);

    photo.remark = remark;
    await this.photoRepository.save(photo);
    return {
      data: photoId,
      msg: '更新备注成功',
    };
  }

  async getPhotoRemarkById(photoId: number) {
    const photo = await this.getPhotoById(photoId);

    return {
      data: {
        id: photo.id,
        remark: photo.remark,
      },
    };
  }

  private async getPhotoById(photoId: number) {
    const photo = await this.photoRepository.findOne({
      where: {
        id: photoId,
      },
    });

    if (!photo) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '照片不存在');
    }

    return photo;
  }
}
