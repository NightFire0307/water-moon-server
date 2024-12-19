import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Photo } from '../../photo/entities/photo.entity';
import { OrderProduct } from './orderProduct.entity'; // 引用照片集实体

export enum OrderStatus {
  // 未开始、进行中、已提交、已过期
  NOT_STARTED = 0,
  IN_PROGRESS = 1,
  SUBMITTED = 2,
  EXPIRED = 3,
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  order_number: string;

  @Column()
  customer_name: string;

  @Column()
  customer_phone: string;

  @OneToMany(() => Photo, (photo) => photo.order)
  @JoinColumn()
  photos: Photo[];

  @OneToMany(() => OrderProduct, (orderProduct) => orderProduct.order, {
    cascade: true,
  })
  order_products: OrderProduct[];

  @Column({ default: 0 })
  total_photos: number; // 总照片数

  @Column({ default: 0 })
  max_select_photos: number; // 最多可选照片数

  @Column({ default: 0 })
  extra_photo_price: number; // 超出照片的单张价格

  @Column()
  access_link: string;

  @Column()
  access_password: string;

  @Column({ type: 'int', default: 0 })
  status: string; // 订单状态，如：未开始、进行中、已完成

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
