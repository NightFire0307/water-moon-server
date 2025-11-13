import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SeedService } from "./seed.service";
import * as path from 'path'
import { User } from "@/modules/user/entities/user.entity";
import { Role } from "@/modules/role/entities/role.entity";
import { Permission } from "@/modules/auth/entities/permissions.entity";
import { DatabaseModule } from "@/modules/database/database.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: path.join(__dirname, `.env.${process.env.NODE_ENV}`) }),
    DatabaseModule,
    TypeOrmModule.forFeature([User, Role, Permission])
  ],
  providers: [SeedService],
})

export class SeedModule { }