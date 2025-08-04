import { CreateOrderDto } from './create-order.dto';
import { OmitType } from '@nestjs/mapped-types';

export class UpdateOrderDto extends OmitType(CreateOrderDto, [
  'orderNumber',
  'customerName',
  'customerPhone',
]) { }
