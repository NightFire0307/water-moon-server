import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  OneToMany,
} from 'typeorm';
import { Product } from '../../product/entities/product.entity';
import { Order } from './order.entity';
import { Exclude } from 'class-transformer';
import { OrderProductPhoto } from './orderProductPhotos.entity'

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

  @OneToMany(() => OrderProductPhoto, (opp) => opp.order_product, { cascade: true })
  order_product_photos: OrderProductPhoto[]; // 关联的照片

  // 数量
  @Column({ type: 'int', default: 1 })
  count: number;

  // 备注
  @Column({ type: 'text', nullable: true })
  remark: string;
}
