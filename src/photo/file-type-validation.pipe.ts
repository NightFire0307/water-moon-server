import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { Express } from 'express';

@Injectable()
export class FileTypeValidationPipe implements PipeTransform {
  transform(value: Express.Multer.File, metadata: ArgumentMetadata) {
    const allowedTypes = ['image/jpeg', 'image/jpg'];
    if (!value) {
      throw new BadRequestException('请上传文件');
    }

    const isValid = allowedTypes.includes(value.mimetype);
    if (!isValid) {
      throw new BadRequestException('上传文件类型错误');
    }

    return value;
  }
}
