import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
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
@Unique(['orderNumber'])
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_number' })
  orderNumber: string;

  // 客户姓名
  @Column({ name: 'customer_name' })
  customerName: string;

  // 客户手机号
  @Column({ name: 'customer_phone' })
  customerPhone: string;

  @OneToMany(() => Photo, (photo) => photo.order, { cascade: true })
  photos: Photo[];

  @OneToMany(() => OrderProduct, (orderProduct) => orderProduct.order, {
    cascade: true,
  })
  orderProducts: OrderProduct[];

  @Column({ name: 'max_select_photos', type: 'int', default: 0 })
  maxSelectPhotos: number; // 最多可选照片数

  @Column({ name: 'extra_photo_price', type: 'float', default: 0 })
  extraPhotoPrice: number; // 超出照片的单张价格

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus; // 订单状态

  // 订单外链
  @OneToMany(() => Link, (link) => link.order, {
    cascade: true,
  })
  links: Link[];

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  @Exclude()
  isDeleted: boolean; // 是否已删除

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
