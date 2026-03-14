import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminsService } from './admin.controller';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private adminsService: AdminsService,
    private jwtService: JwtService,
  ) {}

  async validateAdmin(username: string, pass: string): Promise<any> {
    const admin = await this.adminsService.findByUsername(username);
    if (admin && (await bcrypt.compare(pass, admin.passwordHash))) {
      const { passwordHash, ...result } = admin;
      return result;
    }
    return null;
  }

  async login(admin: any) {
    const payload = { username: admin.username, sub: admin.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
