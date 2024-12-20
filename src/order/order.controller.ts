import { Body, Controller, Get, Post, ValidationPipe } from '@nestjs/common';
import { OrderService } from './order.service';
import { Pagination, PaginationQuery, RequireLogin } from '../common/custom.decorator';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('admin/orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  @RequireLogin()
  async getOrderList(@Pagination() pagination: PaginationQuery) {
    return await this.orderService.getOrderList(pagination);
  }

  @Post()
  @RequireLogin()
  async createOrder(@Body(new ValidationPipe()) createOrderDto: CreateOrderDto) {
    return await this.orderService.createOrder(createOrderDto);
  }
}
