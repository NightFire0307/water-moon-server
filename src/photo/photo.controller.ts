import { Controller } from '@nestjs/common';
import { PhotoService } from './photo.service';

@Controller('photo')
export class PhotoController {
  constructor(private readonly photoService: PhotoService) {}
}
