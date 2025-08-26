import { NestFactory } from '@nestjs/core';
import { SeedModule } from './seed.module';
import { SeedService } from './seed.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeedModule);
  const seedService = app.get(SeedService)

  await seedService.initialRoles();
  await seedService.initialSuperAdmin();
  await seedService.linkSuperAdminRole()

  await app.close();
  process.exit(0);
}

bootstrap();
