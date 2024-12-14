import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { RequireLogin, RequirePermission, UserInfo } from './custom.decorator';
import { JwtUserData } from './login.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @RequireLogin()
  @RequirePermission('bbb')
  getHello(@UserInfo() userInfo: JwtUserData): string {
    console.log(userInfo);
    return this.appService.getHello();
  }
}
