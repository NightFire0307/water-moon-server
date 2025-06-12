
import { PartialType } from '@nestjs/mapped-types';
import { CreatePackageDto } from './createPackage.dto';

export class UpdatePackageDto extends PartialType(CreatePackageDto) {

}