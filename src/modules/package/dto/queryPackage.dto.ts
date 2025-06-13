import { Type } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";

export class QueryPackageDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPublished?: boolean;
}