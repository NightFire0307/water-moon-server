import { Inject, Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { In, Repository } from 'typeorm';
import { Product } from '../product/entities/product.entity';
import { PaginationQuery } from '../../common/custom.decorator';
import { OrderProduct } from './entities/orderProduct.entity';
import { UpdateOrderDto } from './dto/update-order.dto';
import { instanceToPlain } from 'class-transformer';
import { GetOrderListDto } from './dto/get-order-list.dto';
import { ResetOrderStatusDto } from './dto/reset-order-status.dto';
import { Photo } from '../photo/entities/photo.entity';
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

interface OrderProductCount {
  orderId: number;
  product_count: string;
  order_link_count: string;
  total_photos: string;
}

@Injectable()
export class OrderService {
  @InjectRepository(Order)
  private readonly orderRepository: Repository<Order>;

  @InjectRepository(Photo)
  private readonly photoRepository: Repository<Photo>;

  @InjectRepository(OrderProduct)
  private readonly orderProductRepository: Repository<OrderProduct>;

  @InjectRepository(Product)
  private readonly productRepository: Repository<Product>;

  @Inject('REDIS_CLIENT') private readonly redisClient: Redis;

  @Inject(ConfigService) private readonly configService: ConfigService;
  @Inject(MinioService) private readonly minioService: MinioService;

  async getOrderList(
    query: GetOrderListDto,
    pagination: PaginationQuery,
    is_admin: boolean = false,
  ) {
    try {
      const { order_number, customer_name, customer_phone, status } = query;

      // 构建查询条件
      const where: any = {};
      if (order_number) where.order_number = order_number;
      if (customer_name) where.customer_name = customer_name;
      if (customer_phone) where.customer_phone = customer_phone;
      if (status !== undefined) where.status = status;
      if (!is_admin) where.is_deleted = false;

      const [orders, total] = await this.orderRepository.findAndCount({
        where,
        take: pagination.pageSize,
        skip: (pagination.current - 1) * pagination.pageSize,
        order: { created_at: 'DESC' },
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
        .leftJoinAndSelect('order.order_products', 'order_products')
        .leftJoinAndSelect('order.links', 'link')
        .select('order.id', 'orderId')
        .addSelect('COUNT(DISTINCT photos.id)', 'total_photos')
        .addSelect('COUNT(DISTINCT order_products.id)', 'product_count')
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
          total_photos: +count_item.total_photos,
          product_count: +count_item.product_count,
          link_status: +count_item.order_link_count > 0,
        };
      });

      return {
        data: {
          list: order_map,
          total,
          ...pagination,
        },
      };
    } catch {
      throw new DatabaseException(PhotoErrorCode.PHOTO_UPDATE_FAILED);
    }
  }

  async createOrder(createOrderDto: CreateOrderDto) {
    const {
      order_number,
      customer_name,
      customer_phone,
      order_products,
      max_select_photos,
      extra_photo_price,
    } = createOrderDto;

    const queryRunner =
      this.orderRepository.manager.connection.createQueryRunner();

    await queryRunner.startTransaction();

    const foundOrder = await this.orderRepository.findOne({
      where: {
        order_number,
        is_deleted: false,
      },
    });

    if (foundOrder) {
      throw new DatabaseException(OrderErrorCode.ORDER_NUMBER_ALREADY_EXISTS);
    }

    const order = this.orderRepository.create({
      order_number,
      customer_name,
      customer_phone,
      max_select_photos,
      extra_photo_price,
    });
    await queryRunner.manager.save(order);

    // 获取order_products中的产品id
    const productIds = [...new Set(order_products.map((item) => item.id))];

    const foundProduct = await this.productRepository.find({
      where: {
        id: In(productIds),
      },
    });

    if (foundProduct.length !== productIds.length) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '查询不到产品');
    }

    // 保存order_products
    const order_products_data = order_products.map((item) => {
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
      await queryRunner.manager.save(order_products_data);

      await queryRunner.commitTransaction();

      return {
        data: {
          ...order,
          order_products: instanceToPlain(order_products_data),
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
        'order_products',
        'order_products.product',
        'order_products.product.product_type',
      ],
    });

    if (!order)
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');

    const [, total_photos] = await this.photoRepository.findAndCount({
      where: { order: { id: order.id }, is_deleted: false },
    });

    return {
      data: {
        ...order,
        order_products: order.order_products.map((item) => {
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
      },
    };
  }

  async updateOrder(id: number, updateOrderDto: UpdateOrderDto) {
    const foundOrder = await this.orderRepository.findOneBy({ id });

    if (!foundOrder) {
      throw new Error('订单不存在');
    }

    if (foundOrder.status === OrderStatus.SUBMITTED) {
      throw new DatabaseException(
        OrderErrorCode.ORDER_IS_SUBMIT,
        '用户选片结果已提交，若需修改订单内容则需先重置订单状态',
      );
    }

    const queryRunner =
      this.orderRepository.manager.connection.createQueryRunner();
    await queryRunner.startTransaction();

    const { order_products, ...rest } = updateOrderDto;
    await this.orderRepository.update({ id }, rest);

    if (order_products) {
      const productIds = [...new Set(order_products.map((item) => item.id))];
      const foundProduct = await this.productRepository.find({
        where: {
          id: In(productIds),
        },
      });

      if (foundProduct.length !== productIds.length) {
        return new DatabaseException(CommonErrorCode.NOT_FOUND, '查询不到产品');
      }

      const order_products_data = order_products.map((item) => {
        const product = foundProduct.find((product) => product.id === item.id);
        if (!product) {
          throw new Error(`查询不到产品id: ${item.id}`);
        }
        return this.orderProductRepository.create({
          order: foundOrder,
          product,
          count: item.count,
          remark: item.remark,
        });
      });
      await this.orderProductRepository.delete({ order: foundOrder });
      await queryRunner.manager.save(order_products_data);
    }

    try {
      await queryRunner.commitTransaction();

      return {
        data: id,
        msg: '订单更新成功',
      };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw new DatabaseException(CommonErrorCode.DATABASE_ERROR, e);
    } finally {
      await queryRunner.release();
    }
  }

  async deleteOrder(id: number) {
    const foundOrder = await this.orderRepository.findOneBy({ id });

    if (!foundOrder) {
      throw new Error('订单不存在');
    }

    await this.orderRepository.update({ id }, { is_deleted: true });

    return '订单删除成功';
  }

  // 重置订单状态
  async resetOrderStatus(
    orderId: number,
    resetOrderStatusDto: ResetOrderStatusDto,
  ) {
    const { resetSelection } = resetOrderStatusDto;

    const order = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.id = :id', { id: orderId })
      .leftJoinAndSelect('order.photos', 'photo')
      .leftJoinAndSelect('photo.order_products', 'photo_order_product')
      .getOne();

    if (!order)
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');

    // 只有当用户提交选片结果之后才能重置
    if (order.status === OrderStatus.SUBMITTED) {
      if (resetSelection) {
        // 防止重置的照片数量过大时阻塞请求
        setImmediate(async () => {
          for (const photo of order.photos) {
            await this.photoRepository
              .createQueryBuilder()
              .relation(Photo, 'order_products')
              .of(photo.id)
              .remove(photo.order_products);
          }
        });
      }

      order.status = OrderStatus.PENDING;
      await this.orderRepository.save(order);

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
    const order = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.id = :id', { id: orderId })
      .leftJoinAndSelect('order.photos', 'photo')
      .leftJoinAndSelect('photo.order_products', 'photo_order_product')
      .leftJoinAndSelect('photo_order_product.product', 'product')
      .select([
        'order.id',
        'order.order_number',
        'order.max_select_photos',
        'order.extra_photo_price',
        'order.status',
        'photo.id',
        'photo.remark',
        'photo.name',
        'photo_order_product',
        'product.name',
      ])
      .getOne();

    // 检查订单是否存在
    if (!order) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');
    }

    // 检查订单状态用户是否已提交
    if (order.status !== OrderStatus.SUBMITTED) {
      throw new DatabaseException(CommonErrorCode.DATE_ERROR, '用户选片未提交');
    }

    // 获取 Redis 中订单所属的图片信息
    const redisOrderPhotos = await this.redisClient.hgetall(
      `photos_url:${order.order_number}`,
    );

    // 转换照片链接信息
    function transformPhoto(photo: Photo, redisData: object) {
      const raw = redisData[photo.id.toString()];
      let thumbnail_url = null;

      if (raw) {
        try {
          thumbnail_url = JSON.parse(raw).thumbnail_url;
        } catch {
          console.error(`Error parsing JSON for photo ${photo.id}`);
        }
      }

      return {
        ...photo,
        thumbnail_url,
        status: photo.order_products.length > 0 ? 'selected' : 'unSelected',
        order_products: photo.order_products.map((orderProduct) => {
          return {
            id: orderProduct.id,
            name: orderProduct.product.name,
          };
        }),
      };
    }

    return {
      data: {
        list: {
          ...order,
          photos: order.photos.map((photo) =>
            transformPhoto(photo, redisOrderPhotos),
          ),
        },
      },
      msg: '查询成功',
    };
  }

  async exportOrderResult(orderId: number) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: [
        'photos',
        'photos.order_products',
        'photos.order_products.product',
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

    for (const photo of order.photos) {
      if (photo.order_products.length > 0) {
        for (const orderProduct of photo.order_products) {
          if (!productMap.has(orderProduct.product.name)) {
            productMap.set(orderProduct.product.name, [photo.oss_file_key]);
          } else {
            productMap.get(orderProduct.product.name)?.push(photo.oss_file_key);
          }
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
      orderNumber: order.order_number,
      zipStream: passThrough,
      archive,
    };
  }
}
