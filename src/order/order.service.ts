import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { In, Repository } from 'typeorm';
import { Product } from '../product/entities/product.entity';
import { PaginationQuery } from '../common/custom.decorator';
import { OrderProduct } from './entities/orderProduct.entity';

@Injectable()
export class OrderService {
  @InjectRepository(Order)
  private orderRepository: Repository<Order>;

  @InjectRepository(OrderProduct)
  private orderProductRepository: Repository<OrderProduct>;

  @InjectRepository(Product)
  private productRepository: Repository<Product>;

  async getOrderList(pagination: PaginationQuery) {
    return await this.orderRepository.find({
      relations: ['order_products'],
      take: pagination.pageSize,
      skip: (pagination.current - 1) * pagination.pageSize,
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
      access_link,
      access_password,
    } = createOrderDto;
    const queryRunner =
      this.orderRepository.manager.connection.createQueryRunner();

    await queryRunner.startTransaction();

    try {
      const order = this.orderRepository.create({
        order_number,
        customer_name,
        customer_phone,
        max_select_photos,
        extra_photo_price,
        access_link,
        access_password,
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
    } catch (e: unknown) {
      const err = e as Error;
      await queryRunner.rollbackTransaction();
      return err.message;
    } finally {
      await queryRunner.release();
    }
  }
}
