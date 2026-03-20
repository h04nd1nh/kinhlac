import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaiThuoc } from '../models/bai-thuoc.model';
import { CreateBaiThuocDto, UpdateBaiThuocDto } from '../models/bai-thuoc.dto';

export interface PaginatedBaiThuoc {
  data: BaiThuoc[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class BaiThuocService {
  constructor(
    @InjectRepository(BaiThuoc)
    private readonly repo: Repository<BaiThuoc>
  ) {}

  findAll(): Promise<BaiThuoc[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findPaginated(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<PaginatedBaiThuoc> {
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('bt')
      .orderBy('bt.createdAt', 'DESC');

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere('bt.ten_bai_thuoc ILIKE :term', { term });
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

  async findOne(id: number): Promise<BaiThuoc> {
    const item = await this.repo.findOneBy({ id });
    if (!item) {
      throw new NotFoundException(`Bài thuốc #${id} không tồn tại`);
    }
    return item;
  }

  create(dto: CreateBaiThuocDto): Promise<BaiThuoc> {
    const item = this.repo.create(dto);
    return this.repo.save(item);
  }

  async update(id: number, dto: UpdateBaiThuocDto): Promise<BaiThuoc> {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    await this.repo.remove(item);
  }
}
