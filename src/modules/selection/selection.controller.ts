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
import { Pagination, PaginationQuery } from '@/common/decorators/pagination.decorator';
import { BulkUpdatePhotoPreselectStatusDto } from './dto/update-photo-preselect-status.dto';
import type { AssignOrderProductPhotosDto } from './dto/assign-order-product-photos.dto';
import type { UpdateOrderStatusDto } from '../order/dto/order-status.dto';
import { OrderService } from '../order/order.service';
import { OrderFlow } from './decorators/OrderFlow';
import { OrderInfoGuard } from './guard/order-info.guard';

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

  // 获取订单信息
  @Get('order')
  @UseGuards(ClientAuthGuard)
  async getOrderInfo(@Req() req: Request) {
    const orderId = req.tokenPayload.orderId;
    return await this.selectionService.getOrderInfo(orderId);
  }

  // 获取选片照片
  @Get('photos')
  @UseGuards(ClientAuthGuard, OrderInfoGuard)
  async getPhotos(
    @Req() req: Request,
    @Pagination() pagination: PaginationQuery,
  ) {
    return await this.photoService.getPhotosByOrderId(req.order.id, pagination);
  }

  // 更新订单状态
  @Patch('order/status')
  @OrderFlow()
  @UseGuards(ClientAuthGuard)
  async updateOrderStatus(
    @Req() req: Request,
    @Body() dto: UpdateOrderStatusDto
  ) {
    return await this.orderService.updateOrderStatus(req.order.id, dto.status);
  }

  // 更新照片预选标记
  @Patch('preselected-photos')
  @OrderFlow()
  @UseGuards(ClientAuthGuard)
  async updatePhotoPreSelectStatus(
    @Req() req: Request,
    @Body() dto: BulkUpdatePhotoPreselectStatusDto) {
    return await this.photoService.updatePhotoPreSelectStatus(req.order.id, dto);
  }

  // 重置预选照片
  @Post('photos/pre-select/reset')
  @OrderFlow()
  @UseGuards(ClientAuthGuard)
  async resetOrderPreSelect(
    @Req() req: Request
  ) {
    return await this.selectionService.resetOrderPreSelect(req.order.id);
  }

  // 重置产品选片
  @Post('order-product/reset')
  @OrderFlow()
  @UseGuards(ClientAuthGuard)
  async resetOrderProductPhotos(
    @Req() req: Request,
  ) {
    return await this.selectionService.resetOrderProductPhotos(req.order.id);
  }

  // 更新产品照片
  @Post('product-photos')
  @OrderFlow()
  @UseGuards(ClientAuthGuard)
  async bulkAssignPhotosToOrderProduct(
    @Req() req: Request,
    @Body() dto: AssignOrderProductPhotosDto
  ) {
    return await this.selectionService.bulkAssignPhotosToOrderProduct(req.order.id, dto);
  }

  // 锁定选片结果
  @Post(':orderId')
  @OrderFlow()
  @UseGuards(ClientAuthGuard)
  async submitOrder(@Param('orderId') orderId: number) {
    return await this.selectionService.submitOrder(orderId);
  }
}
