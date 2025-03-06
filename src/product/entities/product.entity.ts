import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { ProductType } from './productType.entity';
import { OrderProduct } from '../../order/entities/orderProduct.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  // 产品名称
  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  // 关联产品类型
  @ManyToOne(() => ProductType)
  product_type: ProductType;

  // 关联订单产品
  @OneToMany(() => OrderProduct, (orderProduct) => orderProduct.product, {
    cascade: true,
  })
  @JoinColumn({ name: 'order_products' })
  order_products: OrderProduct[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
