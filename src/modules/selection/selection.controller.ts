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
import { ClientAuthGuard } from './guard/client-auth.guard';
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
import type { UpdateOrderStatusDto } from '../order/dto/order-status.dto';
import { OrderService } from '../order/order.service';
import { OrderValidGuard } from './guard/order-valid.guard';

@Controller('selection')
@Public()
export class SelectionController {
  constructor(
    private readonly selectionService: SelectionService,
    private readonly photoService: PhotoService,
    private readonly orderService: OrderService
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

  @Post('logout')
  @UseGuards(ClientAuthGuard)
  clientLogout(
    @Res({ passthrough: true }) response: Response,
  ) {
    // 清除cookie
    response.clearCookie('selection_refresh_token', {
      httpOnly: true,
    });
    return {
      msg: '登出成功',
    };
  }

  @Get('auth/validate')
  @UseGuards(ClientAuthGuard)
  validateToken() {
    return { valid: true };
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
  @UseGuards(ClientAuthGuard, OrderValidGuard)
  async getOrderInfo(@OrderInfo('orderId') orderId: number) {
    return await this.selectionService.getOrderInfo(orderId);
  }

  // 获取选片照片
  @Get('photos')
  @UseGuards(ClientAuthGuard)
  async getPhotos(
    @OrderInfo('orderId') orderId: number,
    @Pagination() pagination: PaginationQuery,
  ) {
    return await this.photoService.getPhotosByOrderId(orderId, pagination);
  }

  // 更新订单状态
  @Patch('order/status')
  @UseGuards(ClientAuthGuard)
  async updateOrderStatus(
    @OrderInfo('orderId') orderId: number,
    @Body() dto: UpdateOrderStatusDto
  ) {
    return await this.orderService.updateOrderStatus(orderId, dto.status);
  }

  // 更新照片预选标记
  @Patch('preselected-photos')
  @UseGuards(ClientAuthGuard)
  async updatePhotoPreSelectStatus(
    @OrderInfo('orderId') orderId: number,
    @Body() dto: BulkUpdatePhotoPreselectStatusDto) {
    return await this.photoService.updatePhotoPreSelectStatus(orderId, dto);
  }

  // 重置预选照片
  @Post('photos/pre-select/reset')
  @UseGuards(ClientAuthGuard)
  async resetOrderPreSelect(
    @OrderInfo('orderId') orderId: number
  ) {
    return await this.selectionService.resetOrderPreSelect(orderId);
  }

  // 重置产品选片
  @Post('order-product/reset')
  @UseGuards(ClientAuthGuard)
  async resetOrderProductPhotos(
    @OrderInfo('orderId') orderId: number,
  ) {
    return await this.selectionService.resetOrderProductPhotos(orderId);
  }

  // 更新产品照片
  @Post('product-photos')
  @UseGuards(ClientAuthGuard)
  async bulkAssignPhotosToOrderProduct(
    @OrderInfo('orderId') orderId: number,
    @Body() dto: AssignOrderProductPhotosDto
  ) {
    return await this.selectionService.bulkAssignPhotosToOrderProduct(orderId, dto);
  }

  // 锁定选片结果
  @Post(':orderId')
  @UseGuards(ClientAuthGuard)
  @HttpCode(200)
  async submitOrder(@Param('orderId') orderId: number) {
    return await this.selectionService.submitOrder(orderId);
  }
}
