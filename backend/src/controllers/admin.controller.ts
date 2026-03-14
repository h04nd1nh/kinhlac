import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from '../models/admin.model';

@Injectable()
export class AdminsService {
  constructor(
    @InjectRepository(Admin)
    private adminsRepository: Repository<Admin>,
  ) {}

  async findByUsername(username: string): Promise<Admin | null> {
    return this.adminsRepository.findOne({ where: { username } });
  }

  async create(username: string, passwordHash: string): Promise<Admin> {
    const admin = this.adminsRepository.create({ username, passwordHash });
    return this.adminsRepository.save(admin);
  }
}
