import { UpdateUserPasswordDto } from './update-user-password.dto';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class ResetUserPasswordDto extends UpdateUserPasswordDto {
  @IsNumber()
  @IsNotEmpty()
  userId: number;
}
