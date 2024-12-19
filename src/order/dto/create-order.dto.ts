import { IsArray, IsBoolean, IsNotEmpty, IsNumber } from 'class-validator';

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
  customer_phone: string;

  @IsArray()
  order_products: OrderProductDto[];

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

  @IsNumber(
    {},
    {
      message: '超出照片的单张价格必须是数字',
    },
  )
  extra_photo_price: number;

  access_link: string;
  access_password: string;
}
