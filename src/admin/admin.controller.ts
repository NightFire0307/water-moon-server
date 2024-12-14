import { Controller } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AdminService) {}
}
