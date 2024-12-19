import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
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

  // 产品类型
  @ManyToOne(() => ProductType)
  type: ProductType;

  @OneToMany(() => OrderProduct, (orderProduct) => orderProduct.product, {
    cascade: true,
  })
  order_products: OrderProduct[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
