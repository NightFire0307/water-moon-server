import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { In, Repository } from 'typeorm';
import { Product } from '../product/entities/product.entity';
import { PaginationQuery } from '../common/custom.decorator';

@Injectable()
export class OrderService {
  @InjectRepository(Order)
  private orderRepository: Repository<Order>;

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

      const foundProduct = await this.productRepository.find({
        where: {
          id: In(order_products),
        },
      });

      if (foundProduct.length !== order_products.length) {
        await queryRunner.rollbackTransaction();
        return '查询不到产品';
      }

      order.order_products = foundProduct;
      await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();

      return '订单创建成功';
    } catch {
      await queryRunner.rollbackTransaction();
      return 'error';
    } finally {
      await queryRunner.release();
    }
  }
}
