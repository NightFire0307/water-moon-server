import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthController } from './admin.controller';

@Module({
  controllers: [AuthController],
  providers: [AdminService],
})
export class AdminModule {}
