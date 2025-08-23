import {
  IsArray,
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class OrderProductDto {
  @IsNotEmpty()
  id: number;

  @IsNotEmpty()
  @IsNumber()
  count: number;

  @IsString()
  @IsOptional()
  remark: string;
}

export class CreateOrderDto {
  @IsNotEmpty({
    message: '订单编号不能为空',
  })
  orderNumber: string;

  @IsNotEmpty({
    message: '客户姓名不能为空',
  })
  customerName: string;

  @IsNotEmpty({
    message: '客户电话不能为空',
  })
  @MinLength(11, {
    message: '客户电话长度不能小于11',
  })
  customerPhone: string;

  @IsArray()
  orderProducts: OrderProductDto[];

  @IsNotEmpty({
    message: '最大可选照片总数不能为空',
  })
  @IsNumber(
    {},
    {
      message: '最大可选照片总数必须是数字',
    },
  )
  maxSelectPhotos: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsNotEmpty()
  extraPhotoPrice: number;

  @IsString()
  @IsNotEmpty()
  validUntil: string;
}
