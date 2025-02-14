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
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { PhotoService } from './photo.service';
import {
  Pagination,
  PaginationQuery,
  RequireLogin,
} from '../common/custom.decorator';
import { CreatePhotosDto } from './dto/create-photos.dto';
import { DeletePhotosDto } from './dto/delete-photos.dto';
import { UpdatePhotoRecommendDto } from './dto/update-photo-recommend.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { FileTypeValidationPipe } from './file-type-validation.pipe';
import { interval, map, Observable } from 'rxjs';
import { CompressPhotoProcessor } from './compress-photo.processor';

@Controller('/admin/photos')
export class PhotoController {
  @Inject(PhotoService)
  private readonly photoService: PhotoService;

  @Inject(CompressPhotoProcessor)
  private readonly compressPhotoProcessor: CompressPhotoProcessor;

  @Get()
  @RequireLogin()
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
  completions(): Observable<any> {
    return this.compressPhotoProcessor.imageProcessed$.pipe(
      map((event) => {
        return { data: event };
      }),
    );
  }

  @Post('upload/:orderId')
  @RequireLogin()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  uploadPhoto(
    @Param('orderId') orderId: string,
    @UploadedFile(new FileTypeValidationPipe())
    file: Express.Multer.File,
  ) {
    console.log(file);
    return this.photoService.savePhotoToMinio(+orderId, file);
  }

  @Post(':orderId')
  @RequireLogin()
  async savePhotoOssUrl(
    @Param('orderId') orderId: string,
    @Body() createPhotosDto: CreatePhotosDto[],
  ) {
    if (Number.isNaN(+orderId)) {
      throw new BadRequestException('订单ID必须是数字');
    }
    return this.photoService.savePhotoOssUrl(+orderId, createPhotosDto);
  }

  @Put('recommend')
  @RequireLogin()
  updatePhotoRecommendStatus(
    @Query('orderId') orderId: string,
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

  @Delete(':orderId')
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
