import { Type } from "class-transformer";
import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from "class-validator";

export class AssignOrderProductPhotoItemDto {
  @IsInt()
  id: number; // 照片ID

  @IsOptional()
  @IsString()
  remark?: string; // 照片备注
}

export class AssignOrderProductPhotosItemDto {
  @IsInt()
  orderProductId: number; // 订单产品ID

  @IsArray() // 验证数组
  @ValidateNested({ each: true }) // 递归验证数组中的每个项
  @Type(() => AssignOrderProductPhotoItemDto) // 使用 Type 来转换数组中的项
  photos: AssignOrderProductPhotoItemDto[];
}

export class AssignOrderProductPhotosDto {
  @IsArray() // 验证数组
  @ValidateNested({ each: true }) // 递归验证数组中的每个项
  @Type(() => AssignOrderProductPhotosItemDto) // 使用 Type 来转换数组中的项
  items: AssignOrderProductPhotosItemDto[]; // 订单产品照片列表
}