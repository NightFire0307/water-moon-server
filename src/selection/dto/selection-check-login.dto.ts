import { SelectionLoginDto } from './selection-login.dto';
import { OmitType } from '@nestjs/mapped-types';

export class SelectionCheckLoginDto extends OmitType(SelectionLoginDto, [
  'password',
]) {}
