import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Product } from '../../product/entities/product.entity';
import { Order } from './order.entity';
import { Exclude } from 'class-transformer';
import { Photo } from '../../photo/entities/photo.entity';

@Entity('order_products')
export class OrderProduct {
  @PrimaryGeneratedColumn()
  @Exclude()
  id: number;

  @ManyToOne(() => Order, (order) => order.order_products, {
    onDelete: 'CASCADE',
  })
  @Exclude()
  order: Order;

  @ManyToOne(() => Product, (product) => product.order_products, {
    onDelete: 'CASCADE',
  })
  product: Product;

  // 选择的照片
  @ManyToMany(() => Photo, (photo) => photo.order_products, {
    cascade: true,
  })
  @JoinTable({
    name: 'order_product_photos',
    joinColumn: {
      name: 'order_product_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'photo_id',
      referencedColumnName: 'id',
    },
  })
  selected_photos: Photo[];

  // 数量
  @Column({ type: 'int', default: 1 })
  count: number;

  // 备注
  @Column({ type: 'text', nullable: true })
  remark: string;
}
