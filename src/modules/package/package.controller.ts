import { Body, Controller, Get, Param, Post, Put, ValidationPipe } from '@nestjs/common';
import { PackageService } from './package.service';
import { CreatePackageDto } from './dto/createPackage.dto';
import { Pagination, RequireLogin, type PaginationQuery } from '@/common/custom.decorator';
import { UpdatePackageDto } from './dto/updatePackage.dto';

@Controller('admin/packages')
export class PackageController {
  constructor(private readonly packageService: PackageService) { }

  @Get()
  @RequireLogin()
  async getPackages(
    @Pagination() pagination: PaginationQuery
  ) {
    return await this.packageService.getPackages(pagination);
  }

  @Post()
  @RequireLogin()
  async createPackage(
    @Body(new ValidationPipe()) dto: CreatePackageDto,
  ) {
    console.log('dto', dto)
    return await this.packageService.createPackage(dto);
  }

  @Put(":id")
  @RequireLogin()
  async updatePackage(
    @Param('id') id: string,
    @Body(new ValidationPipe()) dto: UpdatePackageDto
  ) {
    return await this.packageService.updatePackage(Number(id), dto);
  }
}
