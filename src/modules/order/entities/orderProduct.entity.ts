import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Product } from '../../product/entities/product.entity';
import { Order } from './order.entity';
import { Exclude } from 'class-transformer';
import { OrderProductPhoto } from './orderProductPhotos.entity'

@Entity('orderProducts')
export class OrderProduct {
  @PrimaryGeneratedColumn()
  @Exclude()
  id: number;

  @ManyToOne(() => Order, (order) => order.orderProducts, {
    onDelete: 'CASCADE',
  })
  @Exclude()
  order: Order;

  @ManyToOne(() => Product, (product) => product.orderProducts, {
    onDelete: 'CASCADE',
  })
  product: Product;

  @OneToMany(() => OrderProductPhoto, (opp) => opp.orderProduct, { cascade: true })
  @JoinColumn({ name: 'order_product_photos' })
  orderProductPhotos: OrderProductPhoto[]; // 关联的照片

  // 数量
  @Column({ type: 'int', default: 1 })
  count: number;

  // 备注
  @Column({ type: 'text', nullable: true })
  remark: string;
}
