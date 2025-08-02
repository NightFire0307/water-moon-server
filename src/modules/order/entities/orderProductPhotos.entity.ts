import { Photo } from "@/modules/photo/entities/photo.entity";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { OrderProduct } from "./orderProduct.entity";

@Entity('order_product_photos')
export class OrderProductPhoto {
  @PrimaryGeneratedColumn()
  id: number

  @ManyToOne(() => OrderProduct, (op) => op.order_product_photos, { onDelete: 'CASCADE' })
  order_product: OrderProduct;

  @ManyToOne(() => Photo, (photo) => photo.order_product_photos, { onDelete: 'CASCADE' })
  photo: Photo;

  @Column({ default: '' })
  remark: string; // 照片备注
}