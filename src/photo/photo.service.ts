import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Photo } from './entities/photo.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PhotoService {
  @InjectRepository(Photo)
  private photoRepository: Repository<Photo>;

  async initDB() {
    const photo = new Photo();
  }
}
