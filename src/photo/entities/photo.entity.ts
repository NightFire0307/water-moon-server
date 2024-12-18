import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { PhotoCollection } from './photo-collection.entity';
import { ProductType } from '../../product/entities/productType.entity'; // 产品类型实体

@Entity('photos')
export class Photo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  oss_url: string; // 照片存储路径

  @ManyToOne(
    () => PhotoCollection,
    (photoCollection) => photoCollection.photos,
    {
      onDelete: 'CASCADE',
    },
  )
  photo_collection: PhotoCollection;

  @ManyToOne(() => ProductType, { nullable: true })
  marked_product: ProductType; // 标记的产品类型，可为空

  @Column({ default: false })
  is_selected: boolean; // 是否被选中

  @CreateDateColumn()
  uploaded_at: Date;
}
