import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { FormatResponseInterceptor } from './common/interceptors/format-response.interceptor';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { WinstonModule } from 'nest-winston';
import { winstonLoggerOptions } from './common/logger/winston.logger';
import { AllExceptionFilter } from './common/filters/all-exception.filter';
import { RequestIdMiddleware } from './common/middleware/requestId.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonLoggerOptions)
  });
  app.use(cookieParser());
  app.use(RequestIdMiddleware);
  app.enableCors({
    origin: 'http://192.168.26.117:3780',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      exceptionFactory: (errors) => {
        const result = errors.map(err => ({
          field: err.property,
          message: Object.values(err.constraints || {}).join(', '),
        }));
        return new BadRequestException(result);
      }
    }),
  );
  app.useGlobalInterceptors(new FormatResponseInterceptor());
  app.useGlobalFilters(new AllExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Water_Moon_Server')
    .setDescription('The NestJS API description')
    .setVersion('0.1')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  const configService = app.get(ConfigService);
  await app.listen(configService.get('NEST_PORT'));
}
bootstrap();
