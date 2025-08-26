import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SeedService } from "./seed.service";
import * as path from 'path'
import { appDataSource } from 'data-source'
import { User } from "@/modules/user/entities/user.entity";
import { Role } from "@/modules/role/entities/role.entity";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: path.join(__dirname, `.env.${process.env.NODE_ENV}`) }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...appDataSource.options,
        autoLoadEntities: true,
      })
    }),
    TypeOrmModule.forFeature([User, Role])
  ],
  providers: [SeedService],
})

export class SeedModule { }