import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Order, OrderStatus } from './entities/order.entity';
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
import { ResetOrderStatusDto } from './dto/reset-order-status.dto';

interface OrderProductCount {
  orderId: number;
  product_count: string;
  order_link_count: string;
  total_photos: string;
}

@Injectable()
export class OrderService {
  @InjectRepository(Order)
  private orderRepository: Repository<Order>;

  @InjectRepository(OrderProduct)
  private orderProductRepository: Repository<OrderProduct>;

  @InjectRepository(Product)
  private productRepository: Repository<Product>;

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
    } catch (error) {
      throw new DatabaseException(
        DatabaseErrorType.DEFAULT,
        `获取订单列表失败: ${error.message}`,
      );
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
        data: {
          ...order,
          order_products: instanceToPlain(order_products_data),
        },
      };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw new DatabaseException(DatabaseErrorType[e.type], e.mssage);
    } finally {
      await queryRunner.release();
    }
  }

  async getOrderDetail(id: number) {}

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

      return {
        data: '',
        msg: '订单更新成功',
      };
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

  // async updateOrderPhotoCount(
  //   orderId: number,
  //   photoCount: number,
  //   operation: 'add' | 'subtract',
  // ) {
  //   const order = await this.orderRepository.findOneBy({ id: orderId });
  //
  //   if (!order)
  //     throw new DatabaseException(
  //       DatabaseErrorType.DATA_NOT_FOUND,
  //       '订单不存在',
  //     );
  //
  //   if (operation === 'add') order.total_photos += photoCount;
  //   else if (operation === 'subtract') {
  //     if (order.total_photos < photoCount) {
  //       order.total_photos = 0;
  //     }
  //     order.total_photos -= photoCount;
  //   }
  //   await this.orderRepository.save(order);
  // }

  // 重置订单状态
  async resetOrderStatus(
    orderId: number,
    resetOrderStatusDto: ResetOrderStatusDto,
  ) {
    if (resetOrderStatusDto.status) return '状态不正确';

    const order = await this.orderRepository.findOneBy({ id: orderId });
    if (!order)
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '订单不存在',
      );

    if (order.status === OrderStatus.SUBMITTED) {
      order.status = OrderStatus.PENDING;
      await this.orderRepository.save(order);

      // TODO 重置订单状态后，需要删除选片结果
      return {
        data: order.id,
        msg: '订单状态重置成功',
      };
    } else {
      return {
        data: order.id,
        msg: '用户必须提交选片结果之后才能重置订单状态',
      };
    }
  }
}
