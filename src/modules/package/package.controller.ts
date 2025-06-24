import { Body, Controller, Delete, Get, Param, Post, Put, Query, ValidationPipe } from '@nestjs/common';
import { PackageService } from './package.service';
import { CreatePackageDto } from './dto/createPackage.dto';
import { Pagination, RequireLogin, type PaginationQuery } from '@/common/custom.decorator';
import { UpdatePackageDto } from './dto/updatePackage.dto';
import { QueryPackageDto } from './dto/queryPackage.dto';

@Controller('admin/packages')
export class PackageController {
  constructor(private readonly packageService: PackageService) { }

  @Get()
  @RequireLogin()
  async getPackages(
    @Pagination() pagination: PaginationQuery,
    @Query() query: QueryPackageDto
  ) {
    console.log('query', query)
    return await this.packageService.getPackages(pagination, query);
  }

  @Get(":id")
  @RequireLogin()
  async getPackageById(
    @Param('id') id: string
  ) {
    return await this.packageService.getPackageById(Number(id));
  }

  @Post()
  @RequireLogin()
  async createPackage(
    @Body(new ValidationPipe()) dto: CreatePackageDto,
  ) {
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

  @Delete(":id")
  @RequireLogin()
  async deletePackage(
    @Param('id') id: string
  ) {
    return await this.packageService.deletePackage(Number(id));
  }
}
