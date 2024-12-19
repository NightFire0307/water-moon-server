import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
} from 'typeorm';
import { ProductType } from './productType.entity';
import { Order } from '../../order/entities/order.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  // 产品名称
  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  // 限制可选照片数量
  @Column({ type: 'int', default: -1 })
  photo_limit: number;

  // 产品类型
  @ManyToOne(() => ProductType)
  type: ProductType;

  @ManyToMany(() => Order, (order) => order.order_products, {
    cascade: true,
  })
  order: Order[];

  // 标识是否可以超过指定照片数量
  @Column({ type: 'boolean', default: false })
  allow_extra_photos: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
