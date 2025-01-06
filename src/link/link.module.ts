import { forwardRef, Module } from '@nestjs/common';
import { LinkService } from './link.service';
import { LinkController } from './link.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { Link } from './entities/link.entity';
import { AppModule } from '../app.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Link]),
    forwardRef(() => AppModule),
  ],
  controllers: [LinkController],
  providers: [LinkService],
})
export class LinkModule {}
