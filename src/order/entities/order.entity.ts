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
import { OrderProduct } from './orderProduct.entity';
import { Link } from '../../link/entities/link.entity';
import { Exclude } from 'class-transformer'; // 引用照片集实体

export enum OrderStatus {
  // 未开始、选片中、已提交、已取消
  NOT_STARTED = 0,
  IN_PROGRESS = 1,
  SUBMITTED = 2,
  CANCEL = 3,
  FINISHED = 4,
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
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

  @Column({ type: 'int', default: 0 })
  select_photos: number; // 已选照片数

  @Column({ type: 'int', default: 0 })
  total_photos: number; // 总照片数

  @Column({ type: 'int', default: 0 })
  max_select_photos: number; // 最多可选照片数

  @Column({ type: 'float', default: 0 })
  extra_photo_price: number; // 超出照片的单张价格

  @Column({ type: 'int', default: 0 })
  status: number; // 订单状态，如：未开始、进行中、已完成

  // 订单外链
  @OneToMany(() => Link, (link) => link.order, {
    cascade: true,
  })
  links: Link[];

  @Column({ type: 'boolean', default: false })
  @Exclude()
  is_deleted: boolean; // 是否已删除

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
