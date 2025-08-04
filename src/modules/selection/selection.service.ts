import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import basex from 'base-x';
import { Redis } from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Order, OrderStatus } from '../order/entities/order.entity';
import { In, Repository, DataSource, Not } from 'typeorm';
import { SelectionLoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { Photo, PreSelectStatus } from '../photo/entities/photo.entity';
import { Product } from '../product/entities/product.entity';
import { OrderProduct } from '../order/entities/orderProduct.entity';
import { ProductPhotoSelectionDto } from './dto/selection-photos-update.dto';
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
import type { AssignOrderProductPhotosDto } from './dto/assign-order-product-photos.dto';
import { OrderProductPhoto } from '../order/entities/orderProductPhotos.entity';

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

  constructor(private readonly dataSource: DataSource) { }

  private readonly logger = new Logger(SelectionService.name)

  // 选片常规登录(订单号和手机号)
  async selectionLogin(dto: SelectionLoginDto) {
    this.logger.log('选片登录请求');
    const { login_type, short_url, orderNumber, credential } = dto
    let order: Order;

    if (login_type === 'link') {
      // 短链登录处理
      const orderId = this.decodeOrderId(short_url)
      order = await this.findOrderById(+orderId);

      // 验证订单是否存在
      if (!order) {
        throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');
      }

      // 校验短链密码
      const link = await this.linkRepository.findOne({
        where: {
          share_url: short_url,
        },
      });

      if (link.share_password !== credential) {
        throw new AuthException(AuthErrorCode.PASSWORD_ERROR, '密码错误');
      }
    } else if (login_type === 'order') {
      // 常规登录处理
      order = await this.orderRepository.findOne({
        where: {
          orderNumber
        }
      })

      // 验证订单是否存在
      if (!order) {
        throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');
      }

      // 验证手机号
      if (order.customerPhone !== credential) {
        throw new AuthException(AuthErrorCode.PHONE_ERROR, '手机号不匹配');
      }

    } else {
      throw new BadRequestException('无效的登录类型');
    }

    // 更新订单状态
    if (order.status === OrderStatus.PENDING) {
      order.status = OrderStatus.PRE_SELECT;
      await this.orderRepository.save(order);
    }

    // 生成访问令牌和刷新令牌
    const accessToken = await this.jwtService.signAsync(
      { orderId: order.id, short_url: short_url },
      { expiresIn: '2h' })
    const refreshToken = await this.jwtService.signAsync(
      { orderId: order.id },
      { expiresIn: '30d' },)

    return {
      accessToken,
      refreshToken,
      order
    }
  }

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
    const order = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.orderProducts', 'orderProducts')
      .leftJoinAndSelect('orderProducts.product', 'product')
      .leftJoinAndSelect('product.product_type', 'product_type')
      .leftJoinAndSelect('orderProducts.orderProductPhotos', 'orderProductPhotos')
      .where('order.id = :orderId', { orderId })
      .select([
        'order.id',
        'order.extraPhotoPrice',
        'order.extraPhotoPrice',
        'order.orderNumber',
        'order.customerName',
        'order.customerPhone',
        'order.status',
        'orderProducts',
        'product.id',
        'product.name',
        'product.photo_limit',
        'product_type.name',
        'orderProductPhotos.id',
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

    console.log(order)

    return {
      ...order,
      orderProducts: order.orderProducts.map((order_product) => ({
        id: order_product.id,
        count: order_product.count,
        productId: order_product.product.id,
        productName: order_product.product.name,
        productType: order_product.product.product_type.name,
        selectedPhotos: order_product.orderProductPhotos.map(photo => ({
          id: photo.photo.id,
          remark: photo.remark,
        })),
        photoLimit: order_product.product.photo_limit,
      })),
      totalPhotos: total_photos,
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
    // 
    await this.dataSource.transaction(async (manager) => {

      // 获取订单产品
      const orderProduct = await this.orderProductRepository.findOne({
        where: {
          order: { id: orderId },
          id: orderProductId,
        },
        relations: ['orderProductPhotos', 'product'],
        select: ['id', 'orderProductPhotos'],
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


      // orderProduct.selected_photos = photos;
      await manager.save(orderProduct);
    });

    return {
      orderProductId,
      selected_photos: photoIds,
    };
  }

  // 刷新access_token
  async refreshToken(refreshToken: string) {
    console.log(refreshToken);
    try {
      const data = await this.jwtService.verifyAsync(refreshToken);
      return {
        access_token: await this.jwtService.signAsync(
          { orderId: data.orderId, short_url: data.surl },
          { expiresIn: '2h' },
        ),
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

  // 锁定选片结果
  async submitOrder(orderId: number) {
    const order = await this.findOrderById(orderId);

    if (order.status === OrderStatus.PRODUCT_SELECT) {
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

  /**
   * 重置照片预选状态
   * 注：重置照片预选需要一并清除照片的产品标记
   * @param orderId 
   */
  async resetOrderPreSelect(orderId: number) {
    await this.dataSource.transaction(async (manager) => {
      const photos = await manager.getRepository(Photo).find({
        where: {
          order: { id: orderId },
          preSelectStatus: Not(PreSelectStatus.PENDING)
        }
      })

      if (photos.length === 0) {
        throw new DatabaseException(CommonErrorCode.NOT_FOUND, '没有找到符合重置条件的预选照片');
      }

      // 清除照片的预选状态
      for (const photo of photos) {
        photo.preSelectStatus = PreSelectStatus.PENDING;
      }

      await manager.save(photos);
    })
  }

  /**
   * 重置订单产品所有的照片分配
   */
  async resetOrderProductPhotos(orderId: number) {
    // 开始事务更新
    await this.dataSource.transaction(async (manager) => {
      const orderProducts = await manager.getRepository(OrderProduct).find({
        where: {
          order: { id: orderId },
        },
        relations: ['orderProductPhotos']
      })

      if (orderProducts.length === 0) {
        throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单产品不存在');
      }

      // 清除所有订单产品照片
      await manager.getRepository(OrderProductPhoto).delete({
        orderProduct: { id: In(orderProducts.map(op => op.id)) }
      })
    })
  }

  // 批量分配照片到订单产品
  async bulkAssignPhotosToOrderProduct(orderId: number, dto: AssignOrderProductPhotosDto) {
    // 开始事务更新
    await this.dataSource.transaction(async (manager) => {
      // 验证所要更新的产品是否都存在
      const products = await manager.getRepository(OrderProduct).find({
        where: {
          id: In(dto.items.map(item => item.orderProductId)),
          order: { id: orderId }
        },
        relations: ['orderProductPhotos', 'orderProductPhotos.photo', 'product'],
      })

      if (products.length !== dto.items.length) {
        throw new DatabaseException(CommonErrorCode.NOT_FOUND, '部分订单产品不存在');
      }

      // 验证照片是否存在或者重复 并且预选状态为选中
      const photoIds = dto.items.flatMap(item => item.photos.map(photo => photo.id));

      if (photoIds.length !== new Set(photoIds).size) {
        throw new BadRequestException('包含重复的照片ID');
      }

      const photos = await manager.getRepository(Photo).find({
        where: {
          id: In(photoIds),
          order: { id: orderId },
          preSelectStatus: PreSelectStatus.SELECTED
        }
      })

      if (photos.length !== photoIds.length) {
        throw new DatabaseException(CommonErrorCode.NOT_FOUND, '部分照片不存在或未选中');
      }

      for (const item of dto.items) {
        // 获取对应的订单产品
        const orderProduct = products.find(product => product.id === item.orderProductId)

        // 插入或更新订单产品照片
        const orderProductPhotos = item.photos.map(photo => {
          const existingPhoto = orderProduct.orderProductPhotos.find(opPhoto => opPhoto.photo.id === photo.id);
          if (existingPhoto) {
            // 如果照片已经存在，则更新
            existingPhoto.remark = photo.remark
            return existingPhoto;
          } else {
            // 如果照片不存在，则创建新的订单产品照片
            const newOrderProductPhoto = new OrderProductPhoto();
            newOrderProductPhoto.photo = photos.find(p => p.id === photo.id);
            newOrderProductPhoto.remark = photo.remark;
            newOrderProductPhoto.orderProduct = orderProduct
            return newOrderProductPhoto;
          }
        });

        // 更新订单产品的照片列表
        orderProduct.orderProductPhotos = orderProductPhotos

        // 获取当前订单产品的照片ID列表
        const currentPhotoIds = item.photos.map(photo => photo.id);
        // 删除不存在前端数据的照片
        const toDelete = orderProduct.orderProductPhotos.filter(orderProductPhoto => !currentPhotoIds.includes(orderProductPhoto.photo.id));
        if (toDelete.length > 0) {
          await manager.remove(OrderProductPhoto, toDelete);
        }

        // 保存
        await manager.save(orderProduct.orderProductPhotos)
      }
    })

    return null
  }
}
