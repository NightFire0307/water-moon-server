import { Photo } from "@/modules/photo/entities/photo.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { OrderProduct } from "./orderProduct.entity";

@Entity('order_product_photos')
export class OrderProductPhoto {
  @PrimaryGeneratedColumn()
  id: number

  @ManyToOne(() => OrderProduct, (op) => op.orderProductPhotos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_product_id' })
  orderProduct: OrderProduct; // 关联的订单产品

  @ManyToOne(() => Photo, (photo) => photo.orderProductPhotos, { onDelete: 'CASCADE' })
  photo: Photo; // 产品关联的照片

  @Column({ default: '' })
  remark: string; // 照片备注
}