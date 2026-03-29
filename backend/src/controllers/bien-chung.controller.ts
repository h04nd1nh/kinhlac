import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BienChung } from '../models/bien-chung.model';
import { CreateBienChungDto, UpdateBienChungDto } from '../models/bien-chung.dto';

@Injectable()
export class BienChungService {
  constructor(
    @InjectRepository(BienChung)
    private readonly repo: Repository<BienChung>,
  ) {}

  findAll(): Promise<BienChung[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<BienChung> {
    const item = await this.repo.findOneBy({ id });
    if (!item) {
      throw new NotFoundException(`Biện chứng #${id} không tồn tại`);
    }
    return item;
  }

  create(dto: CreateBienChungDto): Promise<BienChung> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async update(id: number, dto: UpdateBienChungDto): Promise<BienChung> {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    await this.repo.remove(item);
  }
}
