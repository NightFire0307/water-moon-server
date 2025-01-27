import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { In, Repository } from 'typeorm';
import { Product } from '../product/entities/product.entity';
import { PaginationQuery } from '../common/custom.decorator';
import { OrderProduct } from './entities/orderProduct.entity';
import {
  DatabaseErrorType,
  DatabaseException,
} from '../common/database-exception.filter';
import { UpdateOrderDto } from './dto/update-order.dto';
import { instanceToPlain } from 'class-transformer';
import { GetOrderListDto } from './dto/get-order-list.dto';
import { RedisClientType } from 'redis';

interface OrderProductCount {
  orderId: number;
  product_count: string;
  order_link_count: string;
}

@Injectable()
export class OrderService implements OnModuleInit {
  @InjectRepository(Order)
  private orderRepository: Repository<Order>;

  @InjectRepository(OrderProduct)
  private orderProductRepository: Repository<OrderProduct>;

  @InjectRepository(Product)
  private productRepository: Repository<Product>;

  @Inject('REDIS_CLIENT')
  private redisClient: RedisClientType;

  onModuleInit() {
    this.processQueue();
  }

  async processQueue() {
    while (true) {
      const task = await this.redisClient.brPop('photo:queue', 0);
      const { orderId, photoCount, operation } = JSON.parse(task.element);

      await this.updateOrderPhotoCount(orderId, photoCount, operation);
    }
  }

  async getOrderList(
    query: GetOrderListDto,
    pagination: PaginationQuery,
    is_admin: boolean = false,
  ) {
    const { order_number, customer_name, customer_phone, status } = query;

    // 构建查询条件或调用数据库查询逻辑
    const where: any = {};
    if (order_number) where.order_number = order_number;
    if (customer_name) where.customer_name = customer_name;
    if (customer_phone) where.customer_phone = customer_phone;
    if (status) where.status = status;

    if (!is_admin) where.is_deleted = false;

    const [orders, total] = await this.orderRepository.findAndCount({
      where,
      take: pagination.pageSize,
      skip: (pagination.current - 1) * pagination.pageSize,
    });

    // const order_product_counts: OrderProductCount[] = await this.orderRepository
    //   .createQueryBuilder('order')
    //   .where('order.is_deleted = :is_deleted', { is_deleted: is_admin })
    //   .leftJoinAndSelect('order.order_products', 'order_products')
    //   .select('order.id', 'orderId')
    //   .addSelect('COUNT(order_products.id)', 'product_count')
    //   .groupBy('order.id')
    //   .getRawMany();

    // const order_links: OrderProductCount[] = await this.orderRepository
    //   .createQueryBuilder('order')
    //   .where('order.is_deleted = :is_deleted', { is_deleted: is_admin })
    //   .leftJoinAndSelect('order.links', 'link')
    //   .select('order.id', 'orderId')
    //   .addSelect('COUNT(link.id)', 'order_link_count')
    //   .groupBy('order.id')
    //   .getRawMany();

    const order_counts: OrderProductCount[] = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.is_deleted = :is_deleted', { is_deleted: is_admin })
      .leftJoinAndSelect('order.order_products', 'order_products')
      .leftJoinAndSelect('order.links', 'link')
      .select('order.id', 'orderId')
      .addSelect('COUNT(DISTINCT order_products.id)', 'product_count')
      .addSelect('COUNT(DISTINCT link.id)', 'order_link_count')
      .groupBy('order.id')
      .getRawMany();

    const order_map = orders.map((order) => {
      const count_item = order_counts.find((item) => item.orderId === order.id);
      return {
        ...order,
        product_count: +count_item.product_count,
        link_status: +count_item.order_link_count > 0,
      };
    });

    return {
      list: order_map,
      total,
      ...pagination,
    };
  }

  async getOrderDetail(id: number) {
    return await this.orderRepository
      .createQueryBuilder('order')
      .where('order.id = :orderId', { orderId: id })
      .leftJoinAndSelect('order.order_products', 'order_products')
      .leftJoinAndSelect('order_products.product', 'product')
      .leftJoinAndSelect('order.links', 'links')
      .getOne();
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
      throw new DatabaseException(
        DatabaseErrorType.DATA_ALREADY_EXISTS,
        '订单号已存在',
      );
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
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '查询不到产品',
      );
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
        quantity: item.quantity,
        custom_photo_limit: item.custom_photo_limit,
        allow_extra_photos: item.allow_extra_photos,
      });
    });
    try {
      await queryRunner.manager.save(order_products_data);

      await queryRunner.commitTransaction();

      return {
        ...order,
        order_products: instanceToPlain(order_products_data),
      };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw new DatabaseException(DatabaseErrorType[e.type], e.mssage);
    } finally {
      await queryRunner.release();
    }
  }

  async updateOrder(id: number, updateOrderDto: UpdateOrderDto) {
    const foundOrder = await this.orderRepository.findOneBy({ id });

    if (!foundOrder) {
      throw new Error('订单不存在');
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
        return new DatabaseException(
          DatabaseErrorType.DATA_NOT_FOUND,
          '查询不到产品',
        );
      }

      const order_products_data = order_products.map((item) => {
        const product = foundProduct.find((product) => product.id === item.id);
        if (!product) {
          throw new Error(`查询不到产品id: ${item.id}`);
        }
        return this.orderProductRepository.create({
          order: foundOrder,
          product,
          quantity: item.quantity,
          custom_photo_limit: item.custom_photo_limit,
          allow_extra_photos: item.allow_extra_photos,
        });
      });
      await this.orderProductRepository.delete({ order: foundOrder });
      await queryRunner.manager.save(order_products_data);
    }

    try {
      await queryRunner.commitTransaction();

      return '订单更新成功';
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw new DatabaseException(DatabaseErrorType.DEFAULT, e);
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

  async updateOrderPhotoCount(
    orderId: number,
    photoCount: number,
    operation: 'add' | 'subtract',
  ) {
    const order = await this.orderRepository.findOneBy({ id: orderId });

    if (!order)
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '订单不存在',
      );

    if (operation === 'add') order.total_photos += photoCount;
    else if (operation === 'subtract') {
      if (order.total_photos < photoCount) {
        order.total_photos = 0;
      }
      order.total_photos -= photoCount;
    }
    await this.orderRepository.save(order);
  }
}
