import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SelectionService } from './selection.service';
import { SelectionLoginDto } from './dto/login.dto';
import { Request, Response } from 'express';
import { CustomLogin } from './guard/custom-login.guard';
import { PhotoService } from '../photo/photo.service';
import {
  AuthErrorCode,
} from '@/common/exceptions/auth.exception';
import { Public } from '@/common/decorators/auth.decorator';
import { OrderInfo } from '@/common/decorators/context.decorator';
import { Pagination, PaginationQuery } from '@/common/decorators/pagination.decorator';
import { BulkUpdatePhotoPreselectStatusDto } from './dto/update-photo-preselect-status.dto';
import type { AssignOrderProductPhotosDto } from './dto/assign-order-product-photos.dto';
import type { OrderStatus } from '../order/entities/order.entity';
import type { UpdateOrderStatusDto } from './dto/order-status.dto';

@Controller('selection')
@Public()
export class SelectionController {
  constructor(
    private readonly selectionService: SelectionService,
    private readonly photoService: PhotoService,
  ) { }

  // 订单号和手机号登录
  @Post('login')
  async clientLogin(
    @Body() dto: SelectionLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken } = await this.selectionService.selectionLogin(dto)

    // 设置cookie
    response.cookie('selection_refresh_token', refreshToken, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
    });

    return {
      data: {
        accessToken,
      },
      msg: '登录成功',
    }
  }

  @Post('auth/verify/:short_url')
  @HttpCode(200)
  async verifyToken(@Param('short_url') shortUrl: string) {
    return this.selectionService.verifyToken(shortUrl);
  }

  // 刷新 access_token
  @Post('auth/refresh')
  async refreshToken(@Req() request: Request) {
    const refreshToken: string | undefined =
      request.cookies['selection_refresh_token'];
    if (!refreshToken) throw new ForbiddenException(AuthErrorCode.INVALID_TOKEN);
    return await this.selectionService.refreshToken(refreshToken);
  }

  @Get('order')
  @UseGuards(CustomLogin)
  async getOrderInfo(@OrderInfo('orderId') orderId: number) {
    return await this.selectionService.getOrderInfo(orderId);
  }

  // 获取选片照片
  @Get('photos')
  @UseGuards(CustomLogin)
  async getPhotos(
    @OrderInfo('orderId') orderId: number,
    @Pagination() pagination: PaginationQuery,
  ) {
    return await this.photoService.getPhotosByOrderId(orderId, pagination);
  }

  // 更新订单状态
  @Patch('order/status')
  @UseGuards(CustomLogin)
  async updateOrderStatus(
    @OrderInfo('orderId') orderId: number,
    @Body() dto: UpdateOrderStatusDto
  ) {
    return await this.selectionService.updateOrderStatus(orderId, dto.status);
  }

  // 更新照片预选标记
  @Patch('preselected-photos')
  @UseGuards(CustomLogin)
  async updatePhotoPreSelectStatus(
    @OrderInfo('orderId') orderId: number,
    @Body() dto: BulkUpdatePhotoPreselectStatusDto) {
    return await this.photoService.updatePhotoPreSelectStatus(orderId, dto);
  }

  // 重置预选照片
  @Post('photos/pre-select/reset')
  @UseGuards(CustomLogin)
  async resetOrderPreSelect(
    @OrderInfo('orderId') orderId: number
  ) {
    return await this.selectionService.resetOrderPreSelect(orderId);
  }

  // 重置产品选片
  @Post('order-product/reset')
  @UseGuards(CustomLogin)
  async resetOrderProductPhotos(
    @OrderInfo('orderId') orderId: number,
  ) {
    return await this.selectionService.resetOrderProductPhotos(orderId);
  }

  // 更新产品照片
  @Post('product-photos')
  @UseGuards(CustomLogin)
  async bulkAssignPhotosToOrderProduct(
    @OrderInfo('orderId') orderId: number,
    @Body() dto: AssignOrderProductPhotosDto
  ) {
    return await this.selectionService.bulkAssignPhotosToOrderProduct(orderId, dto);
  }

  // 锁定选片结果
  @Post(':orderId')
  @UseGuards(CustomLogin)
  @HttpCode(200)
  async submitOrder(@Param('orderId') orderId: number) {
    return await this.selectionService.submitOrder(orderId);
  }
}
