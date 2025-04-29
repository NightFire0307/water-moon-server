import { IsBoolean, IsNotEmpty } from 'class-validator';

export class ResetOrderStatusDto {
  @IsNotEmpty()
  @IsBoolean()
  resetSelection: boolean;
}
