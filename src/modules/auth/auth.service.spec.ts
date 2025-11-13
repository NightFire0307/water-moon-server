import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { Test } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt';


describe('AuthController', () => {
  let authService: AuthService

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AuthService, ConfigService, JwtService]
    }).compile()

    authService = moduleRef.get(AuthService);
  })

  describe('login', () => {
    it('测试 login 方法', async () => {
      const result = await authService.login({ username: 'admin', password: '123456' })

      expect(result.username).toBe('admin')
    })
  })
})