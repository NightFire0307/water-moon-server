import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UserSeed } from './user.seed';
import { ConfigService } from '@nestjs/config';
import { RoleSeed } from './role.seed';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const configService = app.get(ConfigService)

  const userSeed = app.get(UserSeed)
  const roleSeed = app.get(RoleSeed)

  await roleSeed.run(app)
  await userSeed.run(app, configService);
  await app.close();
  process.exit(0);
}

bootstrap();
