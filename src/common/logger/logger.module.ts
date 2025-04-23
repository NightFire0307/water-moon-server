import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './winston-config';

@Module({
  imports: [WinstonModule.forRoot(winstonConfig)],
})
export class LoggerModule { }
