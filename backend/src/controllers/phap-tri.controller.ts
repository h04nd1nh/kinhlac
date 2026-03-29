import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PhapTri } from '../models/phap-tri.model';
import { CreatePhapTriDto, UpdatePhapTriDto } from '../models/phap-tri.dto';

@Injectable()
export class PhapTriService {
  constructor(
    @InjectRepository(PhapTri)
    private readonly repo: Repository<PhapTri>,
  ) {}

  findAll(): Promise<PhapTri[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<PhapTri> {
    const item = await this.repo.findOneBy({ id });
    if (!item) {
      throw new NotFoundException(`Pháp trị #${id} không tồn tại`);
    }
    return item;
  }

  create(dto: CreatePhapTriDto): Promise<PhapTri> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async update(id: number, dto: UpdatePhapTriDto): Promise<PhapTri> {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    await this.repo.remove(item);
  }
}
