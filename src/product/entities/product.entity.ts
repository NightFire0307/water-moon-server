import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
} from 'typeorm';
import { ProductType } from './productType.entity';
import { OrderProduct } from '../../order/entities/orderProduct.entity';
import { Photo } from '../../photo/entities/photo.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  // 产品名称
  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  // 关联产品类型
  @ManyToOne(() => ProductType)
  type: ProductType;

  // 关联订单产品
  @OneToMany(() => OrderProduct, (orderProduct) => orderProduct.product, {
    cascade: true,
  })
  order_products: OrderProduct[];

  // 关联照片
  @ManyToMany(() => Photo, (photo) => photo.marked_products)
  photos: Photo[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
