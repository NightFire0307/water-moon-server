import { IsArray, IsInt, IsNotEmpty } from 'class-validator';

export class ProductPhotoSelectionDto {
  @IsArray()
  @IsNotEmpty()
  @IsInt({ each: true }) // 验证每个元素都是整数
  readonly photoIds: number[];

  @IsNotEmpty()
  readonly orderProductId: number;
}
