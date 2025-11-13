import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '@/common/decorators/auth.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) { }

  @Get()
  @Public()
  ping() {
    return {
      status: 'ok',
      timestamp: Date.now(),
    }
  }
}
