import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { In, Repository } from 'typeorm';
import { Product } from '../product/entities/product.entity';
import { PaginationQuery } from '../common/custom.decorator';
import { OrderProduct } from './entities/orderProduct.entity';
import { DatabaseException } from '../common/database-exception.filter';
import { UpdateOrderDto } from './dto/update-order.dto';

interface OrderProductCount {
  orderId: number;
  product_count: string;
}

@Injectable()
export class OrderService {
  @InjectRepository(Order)
  private orderRepository: Repository<Order>;

  @InjectRepository(OrderProduct)
  private orderProductRepository: Repository<OrderProduct>;

  @InjectRepository(Product)
  private productRepository: Repository<Product>;

  async getOrderList(pagination: PaginationQuery, is_admin: boolean = false) {
    const [orders, total] = await this.orderRepository.findAndCount({
      where: {
        is_deleted: is_admin,
      },
      take: pagination.pageSize,
      skip: (pagination.current - 1) * pagination.pageSize,
    });

    const order_product_counts: OrderProductCount[] = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.is_deleted = :is_deleted', { is_deleted: is_admin })
      .leftJoinAndSelect('order.order_products', 'order_products')
      .select('order.id', 'orderId')
      .addSelect('COUNT(order_products.id)', 'product_count')
      .groupBy('order.id')
      .getRawMany();

    const order_product_map = orders.map((order) => {
      const count_item = order_product_counts.find(
        (item) => item.orderId === order.id,
      );
      console.log(count_item);
      return {
        ...order,
        product_count: +count_item.product_count || 0,
      };
    });

    return {
      list: order_product_map,
      total,
      ...pagination,
    };
  }

  async getOrderDetail(id: number) {
    return await this.orderRepository.findOne({
      where: {
        id,
      },
      relations: ['order_products'],
    });
  }

  async createOrder(createOrderDto: CreateOrderDto) {
    const {
      order_number,
      customer_name,
      customer_phone,
      order_products,
      max_select_photos,
      extra_photo_price,
      is_extra_allowed,
    } = createOrderDto;

    const queryRunner =
      this.orderRepository.manager.connection.createQueryRunner();

    await queryRunner.startTransaction();

    try {
      const foundOrder = await this.orderRepository.findOne({
        where: {
          order_number,
          is_deleted: false,
        },
      });

      if (foundOrder) {
        throw new Error('订单号已存在');
      }

      const order = this.orderRepository.create({
        order_number,
        customer_name,
        customer_phone,
        max_select_photos,
        extra_photo_price,
        is_extra_allowed,
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
        throw new Error('查询不到产品');
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
      await queryRunner.manager.save(order_products_data);

      await queryRunner.commitTransaction();

      return '订单创建成功';
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw new DatabaseException(e);
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

    try {
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
          throw new Error('查询不到产品');
        }

        const order_products_data = order_products.map((item) => {
          const product = foundProduct.find(
            (product) => product.id === item.id,
          );
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

      await queryRunner.commitTransaction();

      return '订单更新成功';
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw new DatabaseException(e);
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
}
