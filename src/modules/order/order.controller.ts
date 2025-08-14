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
  Res,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { GetOrderListDto } from './dto/get-order-list.dto';
import { Response } from 'express';
import { RequirePermission, RequireLogin } from '@/common/decorators/auth.decorator';
import { UserInfo } from '@/common/decorators/context.decorator';
import { Pagination, type PaginationQuery } from '@/common/decorators/pagination.decorator';

@Controller('admin/orders')
@RequirePermission({
  code: 'order',
  name: '订单管理',
  type: 'group',
  description: '订单管理',
})
export class OrderController {
  constructor(private readonly orderService: OrderService) { }

  // 获取订单统计信息
  @Get('/summary')
  @RequireLogin()
  @RequirePermission({
    code: 'order:summary',
    name: '订单统计',
    type: 'button',
    description: '获取订单统计信息',
  })
  async getDashboardOrderSummary() {
    return await this.orderService.getOrderSummary()
  }

  // 获取订单周统计数据
  @Get('/weekly-stats')
  @RequireLogin()
  async getWeeklyOrderStats() {
    return await this.orderService.getWeeklyOrderStats();
  }

  // 获取订单列表
  @Get()
  @RequireLogin()
  @RequirePermission({
    code: 'order:view',
    name: '查看订单',
    type: 'button',
    description: '查看订单列表',
  })
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
  @RequirePermission({
    code: 'order:view',
    name: '查看订单',
    type: 'button',
    description: '查看订单详情',
  })
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
  @RequirePermission({
    code: 'order:create',
    name: '创建订单',
    type: 'button',
    description: '创建新的订单',
  })
  async createOrder(
    @Body(new ValidationPipe()) createOrderDto: CreateOrderDto,
  ) {
    return await this.orderService.createOrder(createOrderDto);
  }

  // 更新订单
  @Put('/:orderId')
  @RequireLogin()
  @RequirePermission({
    code: 'order:update',
    name: '更新订单',
    type: 'button',
    description: '更新订单信息',
  })
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
  @Post('/:orderId')
  @RequireLogin()
  @RequirePermission({
    code: 'order:reset-status',
    name: '重置订单状态',
    type: 'button',
    description: '重置订单状态',
  })
  resetOrderStatus(
    @Param('orderId') orderId: string,
    @Query() { reset = false }: { reset?: boolean }
  ) {
    if (Number.isNaN(+orderId)) {
      throw new BadRequestException('Id必须是一个数字');
    }
    return this.orderService.resetOrderStatus(+orderId, reset);
  }

  // 删除订单
  @Delete(':orderId')
  @RequireLogin()
  @RequirePermission({
    code: 'order:delete',
    name: '删除订单',
    type: 'button',
    description: '删除订单',
  })
  async deleteOrder(@Param('orderId') orderId: string) {
    if (Number.isNaN(+orderId)) {
      throw new BadRequestException('Id必须是一个数字');
    }
    return await this.orderService.deleteOrder(+orderId);
  }

  // 获取订单完成结果
  @Get('/:orderId/result')
  @RequireLogin()
  @RequirePermission({
    code: 'order-detail:view',
    name: '查看订单选片结果',
    type: 'button',
    description: '查看订单选片结果',
  })
  async getOrderResult(@Param('orderId') orderId: string) {
    if (Number.isNaN(+orderId)) {
      throw new BadRequestException('Id必须是一个数字');
    }
    return await this.orderService.getOrderResult(+orderId);
  }

  // 导出订单选片结果
  @Get('/:orderId/result/export')
  @RequireLogin()
  @RequirePermission({
    code: 'order-detail:export',
    name: '导出订单选片结果',
    type: 'button',
    description: '导出订单选片结果',
  })
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

  // 获取订单所有照片ID
  @Get('/:orderId/photo-ids')
  @RequireLogin()
  async getOrderPhotoIds(@Param('orderId') orderId: string) {
    return await this.orderService.getOrderPhotoIds(+orderId);
  }
}
