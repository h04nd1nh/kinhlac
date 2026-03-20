import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrieuChung } from '../models/trieu-chung.model';
import { CreateTrieuChungDto, UpdateTrieuChungDto } from '../models/trieu-chung.dto';

export interface PaginatedTrieuChung {
  data: TrieuChung[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class TrieuChungService {
  constructor(
    @InjectRepository(TrieuChung)
    private readonly repo: Repository<TrieuChung>
  ) {}

  findAll(): Promise<TrieuChung[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findPaginated(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<PaginatedTrieuChung> {
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('tc')
      .orderBy('tc.createdAt', 'DESC');

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere('tc.ten_trieu_chung ILIKE :term', { term });
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    };
  }

  async findOne(id: number): Promise<TrieuChung> {
    const item = await this.repo.findOneBy({ id });
    if (!item) {
      throw new NotFoundException(`Triệu chứng #${id} không tồn tại`);
    }
    return item;
  }

  create(dto: CreateTrieuChungDto): Promise<TrieuChung> {
    const item = this.repo.create(dto);
    return this.repo.save(item);
  }

  async update(id: number, dto: UpdateTrieuChungDto): Promise<TrieuChung> {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    await this.repo.remove(item);
  }
}
