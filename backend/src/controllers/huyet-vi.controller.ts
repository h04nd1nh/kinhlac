import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HuyetVi } from '../models/huyet-vi.model';
import { CreateHuyetViDto, UpdateHuyetViDto } from '../models/huyet-vi.dto';

@Injectable()
export class HuyetViService {
  constructor(
    @InjectRepository(HuyetVi)
    private readonly repo: Repository<HuyetVi>,
  ) {}

  findAll(): Promise<HuyetVi[]> {
    return this.repo.find({
      relations: ['kinhMach'],
      order: { idHuyet: 'ASC' },
    });
  }

  async findOne(id: number): Promise<HuyetVi> {
    const item = await this.repo.findOne({
      where: { idHuyet: id },
      relations: ['kinhMach'],
    });
    if (!item) throw new NotFoundException(`Huyệt vị #${id} không tồn tại`);
    return item;
  }

  async findByKinhMach(idKinhMach: number): Promise<HuyetVi[]> {
    return this.repo.find({
      where: { idKinhMach },
      relations: ['kinhMach'],
      order: { idHuyet: 'ASC' },
    });
  }

  create(dto: CreateHuyetViDto): Promise<HuyetVi> {
    const entity = this.repo.create({
      ten_huyet: dto.ten_huyet,
      idKinhMach: dto.id_kinh_mach,
      ma_huyet: dto.ma_huyet,
      vi_tri_giai_phau: dto.vi_tri_giai_phau,
      loai_huyet: dto.loai_huyet,
      chong_chi_dinh: dto.chong_chi_dinh,
    });
    return this.repo.save(entity);
  }

  async update(id: number, dto: UpdateHuyetViDto): Promise<HuyetVi> {
    const item = await this.findOne(id);
    if (dto.ten_huyet !== undefined) item.ten_huyet = dto.ten_huyet;
    if (dto.id_kinh_mach !== undefined) item.idKinhMach = dto.id_kinh_mach;
    if (dto.ma_huyet !== undefined) item.ma_huyet = dto.ma_huyet;
    if (dto.vi_tri_giai_phau !== undefined) item.vi_tri_giai_phau = dto.vi_tri_giai_phau;
    if (dto.loai_huyet !== undefined) item.loai_huyet = dto.loai_huyet;
    if (dto.chong_chi_dinh !== undefined) item.chong_chi_dinh = dto.chong_chi_dinh;
    return this.repo.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    await this.repo.remove(item);
  }
}
