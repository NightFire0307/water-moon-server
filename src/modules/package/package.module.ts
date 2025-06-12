import { Module } from '@nestjs/common';
import { PackageService } from './package.service';
import { PackageController } from './package.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductPackage } from './entities/product-package.entity';
import { ProductPackageItem } from './entities/product-package-item.entity';
import { Product } from '../product/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductPackage, ProductPackageItem, Product])],
  controllers: [PackageController],
  providers: [PackageService],
})
export class PackageModule { }
