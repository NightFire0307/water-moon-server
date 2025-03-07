import { IsArray, IsInt, IsNotEmpty } from 'class-validator';

export class BatchDeleteProductType {
  @IsArray()
  @IsNotEmpty()
  @IsInt({ each: true })
  ids: number[];
}
