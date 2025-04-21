import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class FileDto {
  @IsString()
  @IsNotEmpty()
  uid: string;

  @IsString()
  @IsNotEmpty()
  filename: string;
}

export class FileArrayDto {
  @IsString()
  @IsNotEmpty()
  order_number: string;

  @IsArray()
  @IsNotEmpty()
  files: FileDto[];
}
