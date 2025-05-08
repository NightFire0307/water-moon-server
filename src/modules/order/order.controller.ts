import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { OrderService } from './order.service';
import {
  Pagination,
  PaginationQuery,
  RequireLogin,
  UserInfo,
} from '../../common/custom.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { GetOrderListDto } from './dto/get-order-list.dto';
import { ResetOrderStatusDto } from './dto/reset-order-status.dto';
import { Response } from 'express';

@Controller('admin/orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) { }

  // 获取订单列表
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

  // 获取订单详情
  @Get('/:id')
  @RequireLogin()
  @UseInterceptors(ClassSerializerInterceptor)
  async getOrderDetail(@Param('id') id: string) {
    if (Number.isNaN(+id)) {
      throw new BadRequestException('Id必须是一个数字');
    }
    return await this.orderService.getOrderDetail(+id);
  }

  // 创建订单
  @Post()
  @RequireLogin()
  async createOrder(
    @Body(new ValidationPipe()) createOrderDto: CreateOrderDto,
  ) {
    return await this.orderService.createOrder(createOrderDto);
  }

  // 更新订单
  @Put('/:orderId')
  @RequireLogin()
  async updateOrder(
    @Param('orderId') orderId: string,
    @Body(new ValidationPipe()) updateOrderDto: UpdateOrderDto,
  ) {
    if (Number.isNaN(+orderId)) {
      throw new BadRequestException('Id必须是一个数字');
    }
    return await this.orderService.updateOrder(+orderId, updateOrderDto);
  }

  // 重置订单状态
  @Patch('/:orderId')
  @RequireLogin()
  resetOrderStatus(
    @Param('orderId') orderId: string,
    @Body() resetOrderStatusDto: ResetOrderStatusDto,
  ) {
    if (Number.isNaN(+orderId)) {
      throw new BadRequestException('Id必须是一个数字');
    }
    return this.orderService.resetOrderStatus(+orderId, resetOrderStatusDto);
  }

  // 删除订单
  @Delete(':orderId')
  @RequireLogin()
  async deleteOrder(@Param('orderId') orderId: string) {
    if (Number.isNaN(+orderId)) {
      throw new BadRequestException('Id必须是一个数字');
    }
    return await this.orderService.deleteOrder(+orderId);
  }

  // 获取订单完成结果
  @Get('/:orderId/result')
  @RequireLogin()
  async getOrderResult(@Param('orderId') orderId: string) {
    if (Number.isNaN(+orderId)) {
      throw new BadRequestException('Id必须是一个数字');
    }
    return await this.orderService.getOrderResult(+orderId);
  }

  // 导出订单选片结果
  @Get('/:orderId/result/export')
  @RequireLogin()
  async exportOrderResult(
    @Param('orderId') orderId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (Number.isNaN(+orderId)) {
      throw new BadRequestException('Id必须是一个数字');
    }

    const { orderNumber, zipStream, archive } =
      await this.orderService.exportOrderResult(+orderId);

    // 设置响应头，告诉浏览器这是一个文件下载
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${orderNumber}.zip`,
    );

    zipStream.pipe(res);
    await archive.finalize();
  }
}
