import { Entity, PrimaryGeneratedColumn, ManyToOne, Column } from 'typeorm';
import { Product } from '../../product/entities/product.entity';
import { Order } from './order.entity';
import { Exclude } from 'class-transformer';

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

  // 制作数量
  @Column({ type: 'int', default: 1 })
  quantity: number;

  // 可选照片数
  @Column({ type: 'int', default: 0 })
  custom_photo_limit: number;

  // 是否可以超过指定照片数量
  @Column({ type: 'boolean', default: false })
  allow_extra_photos: boolean;

  // 备注
  @Column({ type: 'text', nullable: true })
  remark: string;
}
