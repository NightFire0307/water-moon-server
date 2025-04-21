import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class SelectionRemarkUpdateDto {
  @IsNumber()
  @IsNotEmpty()
  photoId: number;

  @IsString()
  @IsNotEmpty()
  remark: string;
}
