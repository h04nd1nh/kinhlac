import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ViThuoc } from '../models/vi-thuoc.model';
import { ViThuocCongDung } from '../models/vi-thuoc-cong-dung.model';
import { ViThuocChuTri } from '../models/vi-thuoc-chu-tri.model';
import { ViThuocKiengKy } from '../models/vi-thuoc-kieng-ky.model';
import { ViThuocTenGoiKhac } from '../models/vi-thuoc-ten-goi-khac.model';
import { CreateViThuocDto, UpdateViThuocDto } from '../models/dongy-thuoc.dto';

const VI_THUOC_RELATIONS = {
  nhomLinks: { nhomNho: { nhomLon: true } },
  congDungLinks: { congDung: true },
  chuTriLinks: { chuTri: true },
  kiengKyLinks: { kiengKy: true },
  tenGoiKhacList: true,
} as const;

@Injectable()
export class ViThuocService {
  constructor(
    @InjectRepository(ViThuoc)
    private repo: Repository<ViThuoc>,
  ) {}

  findAll(): Promise<ViThuoc[]> {
    return this.repo.find({
      relations: VI_THUOC_RELATIONS,
      order: { ten_vi_thuoc: 'ASC' },
    });
  }

  findOne(id: number): Promise<ViThuoc | null> {
    return this.repo.findOne({
      where: { id },
      relations: VI_THUOC_RELATIONS,
    });
  }

  private pickScalar(dto: Partial<CreateViThuocDto>): Partial<ViThuoc> {
    const o: Partial<ViThuoc> = {};
    if (dto.ten_vi_thuoc !== undefined) o.ten_vi_thuoc = dto.ten_vi_thuoc;
    if (dto.tinh !== undefined) o.tinh = dto.tinh;
    if (dto.vi !== undefined) o.vi = dto.vi;
    if (dto.quy_kinh !== undefined) o.quy_kinh = dto.quy_kinh;
    if (dto.lieu_dung !== undefined) o.lieu_dung = dto.lieu_dung;
    return o;
  }

  private async syncLinkedRows(
    mgr: EntityManager,
    viId: number,
    dto: Partial<CreateViThuocDto>,
    isCreate: boolean,
  ): Promise<void> {
    const patchCd = dto.cong_dung_links;
    if (patchCd !== undefined || isCreate) {
      await mgr.delete(ViThuocCongDung, { id_vi_thuoc: viId });
      for (const row of patchCd ?? []) {
        const idCd = Number(row.id_cong_dung);
        if (!Number.isFinite(idCd)) continue;
        await mgr.insert(ViThuocCongDung, {
          id_vi_thuoc: viId,
          id_cong_dung: idCd,
          ghi_chu: row.ghi_chu?.trim() ? row.ghi_chu.trim() : null,
        });
      }
    }

    const patchCt = dto.chu_tri_links;
    if (patchCt !== undefined || isCreate) {
      await mgr.delete(ViThuocChuTri, { id_vi_thuoc: viId });
      for (const row of patchCt ?? []) {
        const idCt = Number(row.id_chu_tri);
        if (!Number.isFinite(idCt)) continue;
        await mgr.insert(ViThuocChuTri, {
          id_vi_thuoc: viId,
          id_chu_tri: idCt,
          ghi_chu: row.ghi_chu?.trim() ? row.ghi_chu.trim() : null,
        });
      }
    }

    const patchKk = dto.kieng_ky_links;
    if (patchKk !== undefined || isCreate) {
      await mgr.delete(ViThuocKiengKy, { id_vi_thuoc: viId });
      for (const row of patchKk ?? []) {
        const idKk = Number(row.id_kieng_ky);
        if (!Number.isFinite(idKk)) continue;
        await mgr.insert(ViThuocKiengKy, {
          id_vi_thuoc: viId,
          id_kieng_ky: idKk,
          ghi_chu: row.ghi_chu?.trim() ? row.ghi_chu.trim() : null,
        });
      }
    }

    const patchAliases = dto.ten_goi_khac_list;
    if (patchAliases !== undefined || isCreate) {
      await mgr.delete(ViThuocTenGoiKhac, { id_vi_thuoc: viId });
      const seen = new Set<string>();
      for (const raw of patchAliases ?? []) {
        const t = String(raw || '').trim();
        if (!t) continue;
        const k = t.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        await mgr.insert(ViThuocTenGoiKhac, {
          id_vi_thuoc: viId,
          ten_goi_khac: t,
        });
      }
    }
  }

  async create(dto: CreateViThuocDto): Promise<ViThuoc> {
    return this.repo.manager.transaction(async (mgr) => {
      const item = mgr.create(ViThuoc, this.pickScalar(dto) as ViThuoc);
      const saved = await mgr.save(item);
      await this.syncLinkedRows(mgr, saved.id, dto, true);
      return (await mgr.findOne(ViThuoc, {
        where: { id: saved.id },
        relations: VI_THUOC_RELATIONS,
      })) as ViThuoc;
    });
  }

  async update(id: number, dto: UpdateViThuocDto): Promise<ViThuoc | null> {
    const patch = this.pickScalar(dto);
    if (Object.keys(patch).length > 0) {
      await this.repo.update(id, patch);
    }
    await this.repo.manager.transaction(async (mgr) => {
      await this.syncLinkedRows(mgr, id, dto, false);
    });
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
