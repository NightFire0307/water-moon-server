import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  Sse,
} from '@nestjs/common';
import { PhotoService } from './photo.service';
import { DeletePhotosDto } from './dto/delete-photos.dto';
import { UpdatePhotoRecommendDto } from './dto/update-photo-recommend.dto';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { PhotoProcessor } from './photo.processor';
import { RequirePermission, RequireLogin, Public } from '@/common/decorators/auth.decorator';
import { Pagination, type PaginationQuery } from '@/common/decorators/pagination.decorator';

import { MinioService } from '@/minio/minio.service';
import { EventService, type SSEMessage } from './event.service';

@Controller('admin/photos')
@RequirePermission({
  code: 'photo',
  name: '照片管理',
  type: 'group',
  description: '照片管理',
})
export class PhotoController {
  @Inject(PhotoService)
  private readonly photoService: PhotoService;

  @Inject(EventService)
  private readonly eventService: EventService;

  @Get()
  @RequireLogin()
  @RequirePermission({
    code: 'photo:view',
    name: '查看照片',
    type: 'button',
    description: '查看照片',
  })
  async getPhotosByOrderId(
    @Query('orderId') orderId: string,
    @Pagination() pagination: PaginationQuery,
  ) {
    if (Number.isNaN(+orderId)) {
      throw new BadRequestException('订单ID必须是数字');
    }
    return this.photoService.getPhotosByOrderId(+orderId, pagination);
  }

  // 服务端推送照片处理进度
  @Sse('completions')
  @Public()
  completions(): Observable<SSEMessage> {
    return this.eventService.getEventStream()
  }

  // 通知服务端开始处理照片
  @Post('/upload/commit/:orderId')
  @RequireLogin()
  async commitUpload(
    @Param('orderId') orderId: string,
  ) {
    await this.photoService.bulkSavePhotos(Number(orderId))
    return 'done'
  }

  @Post('/upload/:orderId')
  @RequireLogin()
  async uploadPhoto(
    @Param('orderId') orderId: string,
    @Body('uid') uid: string,
    @Req() req: Request
  ) {
    return this.photoService.uploadPhotos(Number(orderId), req)
  }

  @Put('/recommend/:orderId')
  @RequireLogin()
  updatePhotoRecommendStatus(
    @Param('orderId') orderId: string,
    @Body() updatePhotoRecommendStatusDto: UpdatePhotoRecommendDto,
  ) {
    if (Number.isNaN(+orderId)) {
      throw new BadRequestException('订单ID必须是数字');
    }
    return this.photoService.updatePhotoRecommendStatus(
      +orderId,
      updatePhotoRecommendStatusDto,
    );
  }

  @Delete('/:orderId')
  @RequireLogin()
  deletePhotos(
    @Param('orderId') orderId: string,
    @Body() deletePhotosDto: DeletePhotosDto,
  ) {
    if (Number.isNaN(+orderId)) {
      throw new BadRequestException('订单ID必须是数字');
    }
    return this.photoService.deletePhotos(+orderId, deletePhotosDto);
  }

  // 清除指定单号所有照片
  @Delete('/all/:orderId')
  @RequireLogin()
  deleteAllPhotos(
    @Param('orderId') orderId: string
  ) {
    return this.photoService.deleteAllPhotos(Number(orderId))
  }
}
