import {
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Photo } from './photo.entity';

@Entity('photo_collections')
export class PhotoCollection {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToMany(() => Photo, (photo) => photo.photo_collection, {
    cascade: true,
  })
  photos: Photo[]; // 照片列表

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
