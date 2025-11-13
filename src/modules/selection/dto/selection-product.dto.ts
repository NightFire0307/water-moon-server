import { SelectionLoginDto } from './login.dto';
import { OmitType } from '@nestjs/mapped-types';

export class SelectionProductDto extends OmitType(SelectionLoginDto, [
  'credential',
]) { }
