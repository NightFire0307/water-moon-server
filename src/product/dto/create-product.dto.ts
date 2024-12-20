import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateProductDto {
  @IsNotEmpty({
    message: '产品名称不能为空',
  })
  @IsString()
  name: string;

  @IsNotEmpty({
    message: '产品类型不能为空',
  })
  @IsNumber()
  type: number;
}
