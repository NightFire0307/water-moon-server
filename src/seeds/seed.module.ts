import { Module } from "@nestjs/common";
import { UserModule } from "../modules/user/user.module";
import { UserSeed } from "./user.seed";
import { RoleSeed } from "./role.seed";

@Module({
  imports: [UserModule],
  providers: [UserSeed, RoleSeed],
  exports: [UserSeed, RoleSeed],
})

export class SeedModule { }