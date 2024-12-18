import { IsNotEmpty } from 'class-validator';

export class CreateProductTypeDto {
  @IsNotEmpty({
    message: '产品类型名称不能为空',
  })
  name: string;
}
