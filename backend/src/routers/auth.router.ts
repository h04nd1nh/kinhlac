import { Controller, Post, Body, UnauthorizedException, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from '../controllers/auth.controller';

@Controller('auth')
export class AuthRouter {
  constructor(private readonly authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('admin/login')
  async login(@Body() signInDto: Record<string, any>) {
    const admin = await this.authService.validateAdmin(signInDto.username, signInDto.password);
    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(admin);
  }
}
