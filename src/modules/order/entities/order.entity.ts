import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { Photo } from '../../photo/entities/photo.entity';
import { OrderProduct } from './orderProduct.entity';
import { Link } from '../../link/entities/link.entity';
import { Exclude } from 'class-transformer'; // 引用照片集实体

export enum OrderStatus {
  PENDING = 0, // 订单已创建，等待用户选片
  PRE_SELECT = 1, // 预选阶段
  PRODUCT_SELECT = 2, // 产品选片阶段
  SUBMITTED = 3, // 已提交，订单锁定
  CANCEL = 4, // 订单取消
  FINISHED = 5, // 订单完成
}

@Entity('orders')
@Unique(['order_number'])
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  order_number: string;

  // 客户姓名
  @Column()
  customer_name: string;

  // 客户手机号
  @Column()
  customer_phone: string;

  @OneToMany(() => Photo, (photo) => photo.order, { cascade: true })
  @JoinColumn({ name: 'order_photos' })
  photos: Photo[];

  @OneToMany(() => OrderProduct, (orderProduct) => orderProduct.order, {
    cascade: true,
  })
  order_products: OrderProduct[];

  @Column({ type: 'int', default: 0 })
  max_select_photos: number; // 最多可选照片数

  @Column({ type: 'float', default: 0 })
  extra_photo_price: number; // 超出照片的单张价格

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus; // 订单状态

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
