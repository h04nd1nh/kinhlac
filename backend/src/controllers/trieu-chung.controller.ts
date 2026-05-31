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

export interface TrieuChungWithStats {
  id: number;
  ten_trieu_chung: string;
  benhTayYList: Array<{ id: number; ten_benh: string }>;
  baiThuocList: Array<{ id: number; ten_bai_thuoc: string }>;
  theBenhList: string[];
  benhTayYCount: number;
  baiThuocCount: number;
  theBenhCount: number;
  /** Độ phổ biến = số bệnh Tây Y + số bài thuốc tham chiếu (dùng để sắp xếp giảm dần). */
  doPhoBien: number;
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

  /**
   * Danh sách triệu chứng kèm thống kê quan hệ cho tab "Triệu Chứng":
   * - thể bệnh (gộp distinct từ cột text `the_benh` của các bài thuốc liên quan)
   * - bài thuốc (bai_thuoc_trieu_chung)
   * - bệnh Tây Y (quan_he_benh_trieu_chung)
   * Sắp xếp theo độ phổ biến giảm dần = số bệnh Tây Y + số bài thuốc tham chiếu.
   */
  async findAllWithStats(): Promise<TrieuChungWithStats[]> {
    const rows: Array<{
      id: number;
      ten_trieu_chung: string;
      benhTayYList: Array<{ id: number; ten_benh: string }> | string | null;
      benhTayYCount: number;
      baiThuocList: Array<{ id: number; ten_bai_thuoc: string }> | string | null;
      baiThuocCount: number;
      the_benh_concat: string | null;
    }> = await this.repo.query(`
      SELECT
        tc.id,
        tc.ten_trieu_chung,
        COALESCE(bty.benh_list, '[]'::json) AS "benhTayYList",
        COALESCE(bty.cnt, 0)::int           AS "benhTayYCount",
        COALESCE(bt.bai_thuoc_list, '[]'::json) AS "baiThuocList",
        COALESCE(bt.cnt, 0)::int            AS "baiThuocCount",
        COALESCE(bt.the_benh_concat, '')    AS the_benh_concat
      FROM trieu_chung tc
      LEFT JOIN (
        SELECT qh.id_trieu_chung AS tcid,
               json_agg(json_build_object('id', b.id, 'ten_benh', b.ten_benh) ORDER BY b.ten_benh) AS benh_list,
               COUNT(*) AS cnt
        FROM quan_he_benh_trieu_chung qh
        JOIN benh_tay_y b ON b.id = qh.id_benh_tay_y
        GROUP BY qh.id_trieu_chung
      ) bty ON bty.tcid = tc.id
      LEFT JOIN (
        SELECT btc.id_trieu_chung AS tcid,
               json_agg(json_build_object('id', bt2.id, 'ten_bai_thuoc', bt2.ten_bai_thuoc) ORDER BY bt2.ten_bai_thuoc) AS bai_thuoc_list,
               COUNT(*) AS cnt,
               string_agg(COALESCE(bt2.the_benh, ''), '||') AS the_benh_concat
        FROM bai_thuoc_trieu_chung btc
        JOIN bai_thuoc bt2 ON bt2.id = btc.id_bai_thuoc
        GROUP BY btc.id_trieu_chung
      ) bt ON bt.tcid = tc.id
      ORDER BY (COALESCE(bty.cnt, 0) + COALESCE(bt.cnt, 0)) DESC, tc.ten_trieu_chung ASC
    `);

    const parseJson = <T>(v: T[] | string | null): T[] => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') {
        try {
          return JSON.parse(v) as T[];
        } catch {
          return [];
        }
      }
      return [];
    };

    return rows.map((r) => {
      // Gộp distinct thể bệnh từ chuỗi `the_benh` của các bài thuốc (phân tách "||" giữa bài thuốc, "," trong mỗi bài).
      const theBenhMap = new Map<string, string>();
      for (const chunk of String(r.the_benh_concat || '').split('||')) {
        for (const piece of chunk.split(',')) {
          const v = piece.trim();
          if (!v) continue;
          const key = v.toLowerCase();
          if (!theBenhMap.has(key)) theBenhMap.set(key, v);
        }
      }
      const theBenhList = [...theBenhMap.values()].sort((a, b) =>
        a.localeCompare(b, 'vi'),
      );
      const benhTayYCount = Number(r.benhTayYCount) || 0;
      const baiThuocCount = Number(r.baiThuocCount) || 0;

      return {
        id: Number(r.id),
        ten_trieu_chung: r.ten_trieu_chung,
        benhTayYList: parseJson(r.benhTayYList),
        baiThuocList: parseJson(r.baiThuocList),
        theBenhList,
        benhTayYCount,
        baiThuocCount,
        theBenhCount: theBenhList.length,
        doPhoBien: benhTayYCount + baiThuocCount,
      };
    });
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
