import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProductType } from './productType.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  // 产品名称
  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  // 限制可选照片数量
  @Column({ type: 'int', default: 1 })
  picLimit: number;

  // 产品类型
  @ManyToOne(() => ProductType)
  type: ProductType;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
