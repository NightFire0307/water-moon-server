import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { PhotoService } from './photo.service';
import {
  Pagination,
  PaginationQuery,
  Public,
  RequireLogin,
  RequirePermission,
} from '../../common/custom.decorator';
import { DeletePhotosDto } from './dto/delete-photos.dto';
import { UpdatePhotoRecommendDto } from './dto/update-photo-recommend.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { FileTypeValidationPipe } from './file-type-validation.pipe';
import { map, Observable } from 'rxjs';
import { CompressPhotoProcessor } from './compress-photo.processor';

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

  @Inject(CompressPhotoProcessor)
  private readonly compressPhotoProcessor: CompressPhotoProcessor;

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
  completions(): Observable<any> {
    return this.compressPhotoProcessor.imageProcessed$.pipe(
      map((event) => {
        return {
          data: event,
        };
      }),
    );
  }

  @Post('/upload/:orderId')
  @RequireLogin()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  @HttpCode(202)
  uploadPhoto(
    @Param('orderId') orderId: string,
    @Body('uid') uid: string,
    @UploadedFile(new FileTypeValidationPipe())
    file: Express.Multer.File,
  ) {
    return this.photoService.savePhotoToMinio(+orderId, file, uid);
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
}
