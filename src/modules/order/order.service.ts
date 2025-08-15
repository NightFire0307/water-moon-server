import { Inject, Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { In, Repository, DataSource } from 'typeorm';
import { Product } from '../product/entities/product.entity';
import { PaginationQuery } from '@/common/decorators/pagination.decorator';
import { OrderProduct } from './entities/orderProduct.entity';
import { UpdateOrderDto } from './dto/update-order.dto';
import { instanceToPlain } from 'class-transformer';
import { GetOrderListDto } from './dto/get-order-list.dto';
import { ResetOrderStatusDto } from './dto/reset-order-status.dto';
import { Photo, PreSelectStatus } from '../photo/entities/photo.entity';
import {
  CommonErrorCode,
  DatabaseException,
  OrderErrorCode,
  PhotoErrorCode,
} from '../../common/exceptions/database.exception';
import type Redis from 'ioredis';
import * as archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { ConfigService } from '@nestjs/config';
import { MinioService } from '../../minio/minio.service';
import * as dayjs from 'dayjs';
import * as iosWeek from 'dayjs/plugin/isoWeek.js'
import { PhotoService } from '../photo/photo.service';
import { OrderProductPhoto } from './entities/orderProductPhotos.entity';

dayjs.extend(iosWeek);


interface OrderProductCount {
  orderId: number;
  product_count: string;
  order_link_count: string;
  total_photos: string;
}

interface OrderSummary {
  totalOrderCount: string;
  inProgressOrderCount: string;
  completedOrderCount: string;
  todayOrderCount: string;
}

@Injectable()
export class OrderService {
  @InjectRepository(Order)
  private readonly orderRepository: Repository<Order>;

  @InjectRepository(Photo)
  private readonly photoRepository: Repository<Photo>;

  @InjectRepository(OrderProduct)
  private readonly orderProductRepository: Repository<OrderProduct>;

  @InjectRepository(OrderProductPhoto)
  private readonly orderProductPhotoRepository: Repository<OrderProductPhoto>;

  @InjectRepository(Product)
  private readonly productRepository: Repository<Product>;

  @Inject('REDIS_CLIENT') private readonly redisClient: Redis;

  @Inject(ConfigService) private readonly configService: ConfigService;
  @Inject(MinioService) private readonly minioService: MinioService;
  @Inject(PhotoService) private readonly PhotoService: PhotoService;

  constructor(private readonly dataSource: DataSource) { }

  async getOrderList(
    query: GetOrderListDto,
    pagination: PaginationQuery,
    is_admin: boolean = false,
  ) {
    try {
      const { orderNumber, customerName, customerPhone, status } = query;
      const { pageSize, current, skip, take } = pagination

      // 构建查询条件
      const where: any = {};
      if (orderNumber) where.orderNumber = orderNumber;
      if (customerName) where.customerName = customerName;
      if (customerPhone) where.customerPhone = customerPhone;
      if (status !== undefined) where.status = status;
      if (!is_admin) where.isDeleted = false;

      const [orders, total] = await this.orderRepository.findAndCount({
        where,
        take,
        skip,
        order: { createdAt: 'DESC' },
      });

      // Exit early if no orders found
      if (!orders.length) {
        return {
          data: {
            list: [],
            total: 0,
            ...pagination,
          },
        };
      }

      // Get order IDs for the second query
      const orderIds = orders.map((order) => order.id);

      const orderCountsQuery = this.orderRepository
        .createQueryBuilder('order')
        .where('order.id IN (:...orderIds)', { orderIds })
        .leftJoinAndSelect('order.photos', 'photos')
        .leftJoinAndSelect('order.orderProducts', 'orderProducts')
        .leftJoinAndSelect('order.links', 'link')
        .select('order.id', 'orderId')
        .addSelect('COUNT(DISTINCT photos.id)', 'total_photos')
        .addSelect('COUNT(DISTINCT orderProducts.id)', 'product_count')
        .addSelect('COUNT(DISTINCT link.id)', 'order_link_count')
        .groupBy('order.id')
        .cache(300);

      const order_counts: OrderProductCount[] =
        await orderCountsQuery.getRawMany();

      const order_map = orders.map((order) => {
        const count_item = order_counts.find(
          (item) => item.orderId === order.id,
        ) || {
          total_photos: '0',
          product_count: '0',
          order_link_count: '0',
        };

        return {
          ...order,
          totalPhotos: +count_item.total_photos,
          productCount: +count_item.product_count,
          linkStatus: +count_item.order_link_count > 0,
        };
      });

      return {
        list: order_map,
        total,
        pageSize,
        current,
      }
    } catch {
      throw new DatabaseException(PhotoErrorCode.PHOTO_UPDATE_FAILED);
    }
  }

  async createOrder(createOrderDto: CreateOrderDto) {
    const {
      orderNumber,
      customerName,
      customerPhone,
      orderProducts,
      extraPhotoPrice,
      maxSelectPhotos,
    } = createOrderDto;

    const queryRunner =
      this.orderRepository.manager.connection.createQueryRunner();

    await queryRunner.startTransaction();

    const foundOrder = await this.orderRepository.findOne({
      where: {
        orderNumber,
        isDeleted: false,
      },
    });

    if (foundOrder) {
      throw new DatabaseException(OrderErrorCode.ORDER_NUMBER_ALREADY_EXISTS, '订单号已存在');
    }

    const order = this.orderRepository.create({
      orderNumber,
      customerName,
      customerPhone,
      extraPhotoPrice,
      maxSelectPhotos,
    });
    await queryRunner.manager.save(order);

    // 获取orderProducts中的产品id
    const productIds = [...new Set(orderProducts.map((item) => item.id))];

    const foundProduct = await this.productRepository.find({
      where: {
        id: In(productIds),
      },
    });

    if (foundProduct.length !== productIds.length) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '查询不到产品');
    }

    // 保存orderProducts
    const orderProducts_data = orderProducts.map((item) => {
      const product = foundProduct.find((product) => product.id === item.id);
      if (!product) {
        throw new Error(`查询不到产品id: ${item.id}`);
      }
      return this.orderProductRepository.create({
        order,
        product,
        count: item.count,
        remark: item.remark,
      });
    });
    try {
      await queryRunner.manager.save(orderProducts_data);

      await queryRunner.commitTransaction();

      return {
        data: {
          ...order,
          orderProducts: instanceToPlain(orderProducts_data),
        },
      };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw new DatabaseException(CommonErrorCode.DATABASE_ERROR, e);
    } finally {
      await queryRunner.release();
    }
  }

  async getOrderDetail(id: number) {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: [
        'links',
        'orderProducts',
        'orderProducts.product',
        'orderProducts.product.product_type',
      ],
    });

    if (!order)
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');

    const [, total_photos] = await this.photoRepository.findAndCount({
      where: { order: { id: order.id }, isDeleted: false },
    });

    return {
      ...order,
      orderProducts: order.orderProducts.map((item) => {
        const { product } = item;
        const { product_type, ...rest } = product;
        return {
          id: item.id,
          count: item.count,
          type: product_type.name,
          ...rest,
        };
      }),
      total_photos,
    }
  }

  async updateOrder(id: number, updateOrderDto: UpdateOrderDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const { orderProducts, ...rest } = updateOrderDto;
    try {
      const order = await queryRunner.manager.findOne(Order,
        {
          where: { id, isDeleted: false },
          relations: ['orderProducts', 'orderProducts.product']
        }
      );

      if (!order) {
        throw new Error('订单不存在');
      }

      if (order.status === OrderStatus.SUBMITTED) {
        throw new DatabaseException(
          OrderErrorCode.ORDER_IS_SUBMIT,
          '用户选片结果已提交，若需修改订单内容则需先重置订单状态',
        );
      }

      // 更新订单信息
      await queryRunner.manager.update(Order, { id }, rest);

      // 删除原先订单产品关联的照片
      for (const orderProduct of order.orderProducts) {
        // 查询所有已关联的照片ID
        const orderProductWithPhotos = await queryRunner.manager.findOne(OrderProduct, {
          where: { id: orderProduct.id },
          relations: ['selected_photos'],
        });
        const photoIds = orderProductWithPhotos.orderProductPhotos.map(photo => photo.id);

        // 如果有已关联的照片，则解除关联
        if (photoIds.length > 0) {
          await queryRunner.manager
            .createQueryBuilder()
            .relation(OrderProduct, 'selected_photos')
            .of(orderProduct.id)
            .remove(photoIds);
        }
      }
      // 清空原先所有订单产品
      await queryRunner.manager.delete(OrderProduct, { order: { id } });

      // 添加新订单产品
      for (const item of orderProducts) {
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: item.id }
        })

        if (!product) {
          throw new DatabaseException(CommonErrorCode.NOT_FOUND, '产品不存在');
        }

        const orderProduct = queryRunner.manager.create(OrderProduct, {
          order,
          product,
          count: item.count,
        })

        await queryRunner.manager.save(orderProduct);
      }

      await queryRunner.commitTransaction();
      return '订单更新成功'
    } catch (err) {
      console.log(err)
      await queryRunner.rollbackTransaction()
    } finally {
      await queryRunner.release()
    }

  }

  async deleteOrder(id: number) {
    const foundOrder = await this.orderRepository.findOneBy({ id });

    if (!foundOrder) {
      throw new Error('订单不存在');
    }

    await this.orderRepository.update({ id }, { isDeleted: true });

    return '订单删除成功';
  }

  // 重置订单状态
  async resetOrderStatus(
    orderId: number,
    reset: boolean
  ) {

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['photos', 'orderProducts', 'orderProducts.orderProductPhotos'],
    })

    if (!order)
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');

    // 只有当用户提交选片结果之后才能重置
    if (order.status === OrderStatus.SUBMITTED) {
      if (reset) {
        console.log('重置选片结果');
        // 防止重置的照片数量过大时阻塞请求
        setImmediate(async () => {
          for (const photo of order.photos) {
            await Promise.all([
              this.orderProductPhotoRepository.delete({
                photo: { id: photo.id },
              }),
              this.photoRepository.update({ id: photo.id }, { preSelectStatus: PreSelectStatus.PENDING })
            ])
          }
        });
      }

      order.status = OrderStatus.PENDING;
      await this.orderRepository.save(order);

      // 移除 Redis 中的订单照片缓存
      await this.redisClient.del(`photos_url:${order.orderNumber}`);

      // 重新刷新 Redis 照片缓存
      await this.PhotoService.refreshPhotosCache(order);

      return {
        data: orderId,
        msg: '订单状态重置成功',
      };
    } else {
      return {
        data: orderId,
        msg: '用户必须提交选片结果之后才能重置订单状态',
      };
    }
  }

  // 获取订单完成结果
  async getOrderResult(orderId: number) {
    const order = await this.orderRepository.findOne({
      where: {
        id: orderId,
      },
      relations: ['orderProducts', 'orderProducts.orderProductPhotos', 'orderProducts.product', 'orderProducts.orderProductPhotos.photo']
    })

    // 检查订单是否存在
    if (!order) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');
    }

    // 检查订单状态用户是否已提交
    if (order.status !== OrderStatus.SUBMITTED) {
      throw new DatabaseException(CommonErrorCode.DATE_ERROR, '用户选片未提交');
    }

    // 判断照片缓存是否存在 redis 中
    const existCount = await this.redisClient.exists(`photos_url:${order.orderNumber}`);
    if (existCount === 0) {
      await this.PhotoService.refreshPhotosCache(order)
    }

    // 获取 Redis 中订单所属的图片信息
    const redisOrderPhotos = await this.redisClient.hgetall(
      `photos_url:${order.orderNumber}`,
    );

    // 映射照片对应选中的订单产品
    const photoToOrderProducts = new Map<number, {
      fileName: string
      thumbnailUrl: string
      orderProducts: { id: number, name: string }[]
      remark: string
    }>()

    for (const orderProduct of order.orderProducts) {
      const { product, orderProductPhotos } = orderProduct;
      const { id, name } = product

      orderProductPhotos.forEach((orderProductPhoto) => {
        const cachePhoto = JSON.parse(redisOrderPhotos[orderProductPhoto.photo.id])
        console.log(cachePhoto)

        const m = photoToOrderProducts.get(orderProductPhoto.photo.id)
        if (m) {
          m.fileName = cachePhoto.fileName
          m.thumbnailUrl = cachePhoto.thumbnailUrl
          m.orderProducts.push({ id, name })
          m.remark = orderProductPhoto.remark ?? ''
        } else {
          photoToOrderProducts.set(orderProductPhoto.photo.id, {
            fileName: cachePhoto.fileName,
            thumbnailUrl: cachePhoto.thumbnailUrl,
            orderProducts: [{ id, name }],
            remark: orderProductPhoto.remark ?? ''
          });
        }
      })
    }

    return {
      data: {
        list: Array.from(photoToOrderProducts.entries()).map(([photoId, rest]) => ({
          id: photoId,
          ...rest,
        })),
      },
      msg: '查询成功',
    };
  }

  // 导出订单结果（打包成 ZIP 文件）
  async exportOrderResult(orderId: number) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: [
        'orderProducts',
        'orderProducts.product',
        'orderProducts.orderProductPhotos',
        'orderProducts.orderProductPhotos.photo',
      ],
    });

    if (!order) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');
    }

    if (order.status !== OrderStatus.SUBMITTED) {
      throw new DatabaseException(CommonErrorCode.DATE_ERROR, '用户选片未提交');
    }

    const archive = archiver('zip', {
      zlib: { level: 3 }, // 设置压缩级别
    });
    const passThrough = new PassThrough();

    archive.pipe(passThrough); // 建立管道连接

    // 按照产品分类照片
    const productMap = new Map<string, string[]>();

    for (const orderProduct of order.orderProducts) {
      const productName = orderProduct.product.name
      for (const opp of orderProduct.orderProductPhotos) {
        const photo = opp.photo
        if (!productMap.has(productName)) {
          productMap.set(productName, [photo.ossFileKey]);
        } else {
          productMap.get(productName)?.push(photo.ossFileKey);
        }
      }
    }

    // 下载照片并添加到 ZIP 包中
    for (const [productName, ossFileKeys] of productMap.entries()) {
      for (const ossFileKey of ossFileKeys) {
        const ossKey = ossFileKey.split('.')[0];
        const fileName = ossKey.split('/').pop();
        const downloadStream = await this.minioService.downloadImage(ossKey);
        archive.append(downloadStream, {
          name: `${productName}/${fileName}.jpg`,
        });
      }
    }

    return {
      orderNumber: order.orderNumber,
      zipStream: passThrough,
      archive,
    };
  }

  async getOrderSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);


    const result = await this.orderRepository
      .createQueryBuilder('order')
      .select([
        // 总订单数量
        'COUNT(*) AS totalOrderCount',
        // 待选片订单数量
        `SUM(CASE WHEN order.status = :isPending THEN 1 ELSE 0 END) AS inPendingOrderCount`,
        // 预选阶段订单数量
        `SUM(CASE WHEN order.status = :isPreSelect THEN 1 ELSE 0 END) AS inPreSelectOrderCount`,
        // 产品选片阶段
        `SUM(CASE WHEN order.status = :isProductSelect THEN 1 ELSE 0 END) AS inProductSelectOrderCount`,
        // 已提交订单数量
        `SUM(CASE WHEN order.status = :isSubmitted THEN 1 ELSE 0 END) AS inSubmittedOrderCount`,
        // 已完成订单数量
        `SUM(CASE WHEN order.status = :completed THEN 1 ELSE 0 END) AS completedOrderCount`,
        // 今日订单数量
        `SUM(CASE WHEN order.created_at >= :today AND order.created_at < :tomorrow THEN 1 ELSE 0 END) AS todayOrderCount`,
      ])
      .setParameters({
        isPending: OrderStatus.PENDING,
        isPreSelect: OrderStatus.PRE_SELECT,
        isProductSelect: OrderStatus.PRODUCT_SELECT,
        isSubmitted: OrderStatus.SUBMITTED,
        completed: OrderStatus.FINISHED,
        today,
        tomorrow,
        yesterday
      })
      .getRawOne();

    console.log(result)

    return {
      totalOrderCount: Number(result.totalOrderCount),
      isPendingOrderCount: Number(result.isPendingOrderCount),
      completedOrderCount: Number(result.completedOrderCount),
      todayOrderCount: Number(result.todayOrderCount),
    }
  }

  async getWeeklyOrderStats() {
    const now = dayjs()

    const lastWeekMonday = now.startOf('isoWeek').subtract(1, 'week').startOf('day');
    const lastWeekFriday = lastWeekMonday.add(6, 'day').endOf('day');

    console.log(`上周一: ${lastWeekMonday.format('YYYY-MM-DD dddd')}`);
    console.log(`上周五: ${lastWeekFriday.format('YYYY-MM-DD dddd')}`);

    const rawStats = await this.orderRepository
      .createQueryBuilder('order')
      .select("DATE_FORMAT(order.created_at, '%Y-%m-%d')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('order.created_at BETWEEN :start AND :end', {
        start: lastWeekMonday.toDate(),
        end: lastWeekFriday.toDate(),
      })
      .groupBy('date')
      .getRawMany();

    // 转换为 Map 提高查找效率
    const statMap = new Map(rawStats.map(item => [item.date, Number(item.count)]));

    // 构造完整 7 天的日期数组，并填充 count（无则为 0）
    const lastWeekOrderCounts = Array.from({ length: 7 }, (_, i) => {
      const date = lastWeekMonday.add(i, 'day').format('YYYY-MM-DD');
      return statMap.get(date) ?? 0
    });

    return {
      lastWeekOrderCounts
    }
  }

  // 获取订单所有照片ID
  async getOrderPhotoIds(orderId: number) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['photos']
    })

    if (!order) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');
    }

    return {
      photoIds: order.photos.map(photo => photo.id)
    }
  }

  // 更新订单状态
  async updateOrderStatus(orderId: number, status: OrderStatus) {
    const order = await this.orderRepository.findOne({
      where: {
        id: orderId
      }
    })

    if (!order) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');
    }

    // 检查当前订单状态是否允许更新
    if (order.status === OrderStatus.SUBMITTED) {
      throw new DatabaseException(OrderErrorCode.ORDER_IS_SUBMIT, '订单已锁定，无法更新状态');
    }

    // 判断状态流转是否符合预期
    const validTransitions: { [key in OrderStatus]?: OrderStatus[] } = {
      [OrderStatus.PENDING]: [OrderStatus.PRE_SELECT, OrderStatus.CANCEL],
      [OrderStatus.PRE_SELECT]: [OrderStatus.PRODUCT_SELECT, OrderStatus.CANCEL],
      [OrderStatus.PRODUCT_SELECT]: [OrderStatus.SUBMITTED, OrderStatus.CANCEL],
      [OrderStatus.SUBMITTED]: [OrderStatus.FINISHED, OrderStatus.CANCEL],
    };

    console.log(status)
    console.log(validTransitions[order.status].includes(status))

    if (validTransitions[order.status] && !validTransitions[order.status].includes(status)) {
      throw new DatabaseException(
        OrderErrorCode.INVALID_STATUS_TRANSITION,
      )
    }

    // 更新订单状态
    order.status = status

    await this.orderRepository.save(order);
    return {
      data: {
        orderId: order.id,
        status: order.status
      },
      msg: '订单状态更新成功',
    }
  }
}
