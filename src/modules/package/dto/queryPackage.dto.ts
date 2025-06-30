import { Transform } from "class-transformer";
import { IsOptional } from "class-validator";

export class QueryPackageDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  is_published?: boolean;

  @IsOptional()
  name?: string;
}