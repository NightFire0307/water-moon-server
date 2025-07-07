import { SelectionLoginDto } from './selection-login.dto';
import { OmitType } from '@nestjs/mapped-types';

export class SelectionProductDto extends OmitType(SelectionLoginDto, [
  'credential',
]) { }
