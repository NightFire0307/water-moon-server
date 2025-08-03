import { PreSelectStatus } from "@/modules/photo/entities/photo.entity"
import { IsEnum, IsInt } from "class-validator";

export class UpdatePhotoPreselectStatusDto {
  @IsInt()
  id: number;

  @IsEnum(PreSelectStatus)
  status: PreSelectStatus;
}

export class BulkUpdatePhotoPreselectStatusDto {
  photos: UpdatePhotoPreselectStatusDto[]
}