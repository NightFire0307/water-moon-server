import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from "class-validator";

export class CreatePackageDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;


  @IsArray()
  items: {
    productId: number;
    count: number;
  }[];


  @IsInt()
  price: number;

  @IsBoolean()
  isPublished: boolean;
}