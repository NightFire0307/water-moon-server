import type { Order } from '@/modules/order/entities/order.entity';

declare module 'express' {
  interface Request {
    order?: Order
    tokenPayload?: {
      orderId: number
    }
  }
}