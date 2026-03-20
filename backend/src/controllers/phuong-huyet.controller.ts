import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PhuongHuyet } from '../models/phuong-huyet.model';
import { CreatePhuongHuyetDto, UpdatePhuongHuyetDto } from '../models/phuong-huyet.dto';

export interface PaginatedPhuongHuyet {
  data: PhuongHuyet[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class PhuongHuyetService {
  constructor(
    @InjectRepository(PhuongHuyet)
    private readonly repo: Repository<PhuongHuyet>
  ) {}

  findAll(): Promise<PhuongHuyet[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findPaginated(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<PaginatedPhuongHuyet> {
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('ph')
      .orderBy('ph.createdAt', 'DESC');

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere('ph.phuong_huyet ILIKE :term', { term });
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

  async findOne(id: number): Promise<PhuongHuyet> {
    const item = await this.repo.findOneBy({ id });
    if (!item) {
      throw new NotFoundException(`Phương huyệt #${id} không tồn tại`);
    }
    return item;
  }

  create(dto: CreatePhuongHuyetDto): Promise<PhuongHuyet> {
    const item = this.repo.create(dto);
    return this.repo.save(item);
  }

  async update(id: number, dto: UpdatePhuongHuyetDto): Promise<PhuongHuyet> {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    await this.repo.remove(item);
  }
}
