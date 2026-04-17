import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
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
    private readonly repo: Repository<TrieuChung>,
  ) {}

  findAll(): Promise<TrieuChung[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  async findPaginated(
    page: number = 1,
    limit: number = 20,
    search?: string,
  ): Promise<PaginatedTrieuChung> {
    const skip = (page - 1) * limit;
    const keyword = String(search || '').trim();
    const where = keyword
      ? { ten_trieu_chung: ILike(`%${keyword}%`) }
      : undefined;
    const [data, total] = await this.repo.findAndCount({
      where,
      skip,
      take: limit,
      order: { id: 'ASC' },
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
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
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
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
