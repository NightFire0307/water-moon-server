import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { OrderService } from './order.service';
import {
  Pagination,
  PaginationQuery,
  RequireLogin,
  UserInfo,
} from '../common/custom.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { GetOrderListDto } from './dto/get-order-list.dto';

@Controller('admin/orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  @RequireLogin()
  async getOrderList(
    @Query() query: GetOrderListDto,
    @Pagination() pagination: PaginationQuery,
    @UserInfo('is_admin') is_admin: boolean,
  ) {
    console.log(query);
    return await this.orderService.getOrderList(query, pagination, is_admin);
  }

  @Get(':id')
  @RequireLogin()
  @UseInterceptors(ClassSerializerInterceptor)
  async getOrderDetail(@Param('id') id: string) {
    if (Number.isNaN(+id)) {
      throw new BadRequestException('Id必须是一个数字');
    }
    return await this.orderService.getOrderDetail(+id);
  }

  @Post()
  @RequireLogin()
  async createOrder(
    @Body(new ValidationPipe()) createOrderDto: CreateOrderDto,
  ) {
    return await this.orderService.createOrder(createOrderDto);
  }

  @Put(':id')
  @RequireLogin()
  async updateOrder(
    @Param('id') id: string,
    @Body(new ValidationPipe()) updateOrderDto: UpdateOrderDto,
  ) {
    if (Number.isNaN(+id)) {
      throw new BadRequestException('Id必须是一个数字');
    }
    return await this.orderService.updateOrder(+id, updateOrderDto);
  }

  @Delete(':id')
  @RequireLogin()
  async deleteOrder(@Param('id') id: string) {
    if (Number.isNaN(+id)) {
      throw new BadRequestException('Id必须是一个数字');
    }
    return await this.orderService.deleteOrder(+id);
  }
}
