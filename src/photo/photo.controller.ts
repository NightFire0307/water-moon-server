import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UploadedFiles,
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
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { FileTypeValidationPipe } from './file-type-validation.pipe';

@Controller('/admin/photos')
export class PhotoController {
  constructor(private readonly photoService: PhotoService) {}

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
