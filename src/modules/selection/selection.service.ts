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
  LinkErrorCode,
  OrderErrorCode,
  PhotoErrorCode,
} from '../../common/exceptions/database.exception';
import {
  AuthErrorCode,
  AuthException,
} from '../../common/exceptions/auth.exception';
import { Link } from '../link/entities/link.entity';
import * as dayjs from 'dayjs';

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

  @InjectRepository(Link)
  private readonly linkRepository: Repository<Link>;

  // 校验短链是否存在
  async verifyToken(shortUrl: string) {
    const orderId = this.decodeOrderId(shortUrl);

    // 判断链接是否过期
    const link = await this.linkRepository.findOne({
      where: {
        share_url: shortUrl,
      },
    });

    if (!link) {
      throw new DatabaseException(LinkErrorCode.LINK_ERROR, '链接无效或过期');
    }

    // 判断链接是否过期
    if (link.expired_at !== null) {
      const now = dayjs();
      const expiredTime = dayjs(link.expired_at);
      if (expiredTime.isBefore(now)) {
        throw new DatabaseException(LinkErrorCode.LINK_ERROR, '链接无效或过期');
      }
    }

    const order = await this.findOrderById(+orderId);

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

    // 检验密码
    const link = await this.linkRepository.findOne({
      where: {
        share_url: short_url,
      },
    });

    if (link.share_password !== password) {
      throw new AuthException(AuthErrorCode.PASSWORD_ERROR, '密码错误');
    }

    // 校验Redis中的链接密码
    // const sharedLink = await this.redisClient.hget(
    //   `share_link:${order.order_number}`,
    //   short_url,
    // );

    // const sharedLinkObj = JSON.parse(sharedLink);

    // if (sharedLinkObj.password !== password) {
    //   throw new AuthException(AuthErrorCode.PASSWORD_ERROR, '密码错误');
    // }

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

    const decodedUrl = bs62.decode(short_url);
    const textDecoder = new TextDecoder('utf-8');

    const [orderId] = textDecoder.decode(decodedUrl).split('_');

    return orderId;
  }

  // 获取选片订单信息
  async getOrderInfo(orderId: number) {
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
      relations: ['selected_photos', 'product'],
      select: ['id', 'selected_photos'],
    });

    if (!orderProduct) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单产品不存在');
    }

    // 确保没有重复的照片ID
    const uniquePhotoIds = new Set(photoIds);
    if (photoIds.length !== uniquePhotoIds.size) {
      throw new BadRequestException('包含重复的照片ID');
    }

    // 校验当前产品的数量是否超过限制
    if (orderProduct.product.photo_limit !== 0) {
      if (
        uniquePhotoIds.size >
        orderProduct.product.photo_limit * orderProduct.count
      ) {
        throw new DatabaseException(
          PhotoErrorCode.PHOTO_UPDATE_FAILED,
          '当前产品的照片数量已超过限制',
        );
      }
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
          orderId: order.id,
        },
        msg: '锁定成功',
      };
    }

    throw new BadRequestException('当前订单状态不允许锁定');
  }

  async updatePhotoRemark(
    orderId: number,
    { photoId, remark }: SelectionRemarkUpdateDto,
  ) {
    const order = await this.orderRepository.findOneBy({ id: orderId });

    if (!order) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '当前订单不存在');
    }

    const photo = await this.getPhotoById(photoId);
    const key = `photos_url:${order.order_number}`;
    const field = photoId.toString();

    const jsonStr = await this.redisClient.hget(key, field);

    // 判断 Redis 中是否有数据
    if (!jsonStr) {
      throw new DatabaseException(
        CommonErrorCode.NOT_FOUND,
        '照片数据不存在或已失效',
      );
    }

    let photoInfo;
    try {
      photoInfo = JSON.parse(jsonStr);
    } catch {
      throw new DatabaseException(
        CommonErrorCode.DATABASE_ERROR,
        '照片数据格式错误',
      );
    }

    photoInfo.remark = remark;

    try {
      await this.redisClient.hset(key, field, JSON.stringify(photoInfo));
      photo.remark = remark;
      await this.photoRepository.save(photo);
    } catch (err) {
      // 可以加一行日志记录一下
      throw new DatabaseException(
        CommonErrorCode.DATABASE_ERROR,
        err?.message ?? '更新失败',
      );
    }

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
