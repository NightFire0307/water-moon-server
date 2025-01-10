import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  MinLength,
} from 'class-validator';

export class OrderProductDto {
  @IsNotEmpty()
  id: number;

  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @IsNotEmpty()
  @IsNumber()
  custom_photo_limit: number;

  @IsNotEmpty()
  @IsBoolean()
  allow_extra_photos: boolean;
}

export class CreateOrderDto {
  @IsNotEmpty({
    message: '订单编号不能为空',
  })
  order_number: string;

  @IsNotEmpty({
    message: '客户姓名不能为空',
  })
  customer_name: string;

  @IsNotEmpty({
    message: '客户电话不能为空',
  })
  @MinLength(11, {
    message: '客户电话长度不能小于11',
  })
  customer_phone: string;

  @IsArray()
  order_products: OrderProductDto[];

  @IsBoolean()
  is_extra_allowed: boolean;

  @IsNotEmpty({
    message: '最大可选照片总数不能为空',
  })
  @IsNumber(
    {},
    {
      message: '最大可选照片总数必须是数字',
    },
  )
  max_select_photos: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  extra_photo_price?: number;
}
