import { UpdateUserPasswordDto } from './update-user-password.dto';
import { OmitType } from '@nestjs/swagger';

export class ResetUserPasswordDto extends OmitType(UpdateUserPasswordDto, ['oldPassword'] as const) {
}
