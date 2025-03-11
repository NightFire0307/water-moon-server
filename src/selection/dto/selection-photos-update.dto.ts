import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
} from 'class-validator';

export class ProductPhotoSelectionDto {
  @IsArray()
  @IsNotEmpty()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsInt({ each: true }) // 验证每个元素都是整数
  readonly photoIds: number[];

  @IsInt()
  @IsNotEmpty()
  readonly orderProductId: number;
}
