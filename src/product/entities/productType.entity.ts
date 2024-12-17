import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity({ name: 'product_types' })
export class ProductType {
  @PrimaryGeneratedColumn()
  id: number;

  // 产品类型名称
  @Column({ unique: true, length: 150 })
  name: string;

  // 产品类型下的产品
  @OneToMany(() => Product, (product) => product.type, {
    cascade: true,
  })
  products: Product[];

  @CreateDateColumn()
  createTime: Date;

  @UpdateDateColumn()
  updateTime: Date;
}
