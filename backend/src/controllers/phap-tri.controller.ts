import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { PhapTri } from '../models/phap-tri.model';
import { CreatePhapTriDto, UpdatePhapTriDto } from '../models/phap-tri.dto';
import { BaiThuoc } from '../models/bai-thuoc.model';
import { BaiThuocPhapTri } from '../models/bai-thuoc-phap-tri.model';
import { KinhMach } from '../models/kinh-mach.model';
import { MeridianSyndrome } from '../models/meridian-syndrome.model';
import { TrieuChung } from '../models/trieu-chung.model';

@Injectable()
export class PhapTriService {
  private static readonly RELATIONS = [
    'bai_thuoc',
    'bai_thuoc_links',
    'bai_thuoc_links.baiThuoc',
    'benh_dong_y_list',
    'kinh_mach_list',
    'trieu_chung_list',
  ] as const;

  constructor(
    @InjectRepository(PhapTri)
    private readonly repo: Repository<PhapTri>,
    @InjectRepository(BaiThuoc)
    private readonly baiThuocRepo: Repository<BaiThuoc>,
    @InjectRepository(KinhMach)
    private readonly kinhRepo: Repository<KinhMach>,
    @InjectRepository(MeridianSyndrome)
    private readonly benhDongYRepo: Repository<MeridianSyndrome>,
    @InjectRepository(BaiThuocPhapTri)
    private readonly baiPhapTriLinkRepo: Repository<BaiThuocPhapTri>,
    @InjectRepository(TrieuChung)
    private readonly trieuChungRepo: Repository<TrieuChung>,
  ) {}

  findAll(): Promise<PhapTri[]> {
    return this.repo.find({
      relations: [...PhapTriService.RELATIONS],
      order: { id: 'ASC' },
    });
  }

  /**
   * Trả full danh sách id + nhãn dùng cho dropdown picker.
   * Không relations, không pagination — dữ liệu rất nhẹ nên đủ an toàn để gọi unbounded.
   */
  findOptions(): Promise<Array<Pick<PhapTri, 'id' | 'chung_trang' | 'nguyen_tac'>>> {
    return this.repo.find({
      select: ['id', 'chung_trang', 'nguyen_tac'],
      order: { id: 'ASC' },
    });
  }

  /**
   * Lightweight, paginated list cho tab Pháp Trị.
   * - Cắt relations nặng (benh_dong_y_list); giữ kinh_mach_list/trieu_chung_list/bai_thuoc_links.
   * - Search server-side trên các text columns trong cùng bảng phap_tri.
   * - Filter category Đông Y / Tây Y dựa vào EXISTS với benh_tay_y junction tables (trực tiếp + qua bài thuốc).
   * - Trả về statsByCategory để hiển thị badge "Đông Y / Tây Y / Tất cả" trên UI.
   */
  async findLite(opts: {
    page?: number;
    limit?: number;
    q?: string;
    category?: 'all' | 'dong-y' | 'tay-y';
    chungBenhId?: number | null;
    tangPhuIds?: number[];
    tonThuongTacNhans?: string[];
    focusId?: number | null;
  }): Promise<{
    data: PhapTri[];
    total: number;
    page: number;
    limit: number;
    statsByCategory: { all: number; 'dong-y': number; 'tay-y': number };
    relatedBenhTayYByPtId: Record<number, Array<{ id: number; ten_benh: string; chungBenh: { id: number; ten_chung_benh: string } | null }>>;
    theBenhByPtId: Record<number, string[]>;
    tayYChungBenhStats: Array<{ id: number; name: string; count: number }>;
    tangPhuStats: Array<{ id: number; name: string; count: number }>;
    tonThuongStats: Array<{ id: number; name: string; count: number }>;
  }> {
    let page = Math.max(1, Math.floor(opts.page ?? 1));
    const limit = Math.max(1, Math.min(200, Math.floor(opts.limit ?? 12)));
    const q = (opts.q ?? '').trim();
    const category = opts.category ?? 'all';
    const chungBenhId = Number.isFinite(opts.chungBenhId as number) ? Number(opts.chungBenhId) : null;
    const tangPhuIds = [...new Set((opts.tangPhuIds ?? []).filter((n) => Number.isFinite(n) && n > 0))];
    const tonThuongTacNhans = [...new Set((opts.tonThuongTacNhans ?? []).map((s) => s.trim()).filter(Boolean))];
    const focusId = Number.isFinite(opts.focusId as number) && Number(opts.focusId) > 0 ? Number(opts.focusId) : null;

    // EXISTS clause cho "pháp trị có liên quan Tây Y": trực tiếp HOẶC qua bài thuốc.
    const tayYExistsClause = (cbIdParam?: string) => {
      const cbFilter = cbIdParam ? ` AND bty.id_chung_benh = :${cbIdParam}` : '';
      return `(
        EXISTS (
          SELECT 1 FROM benh_tay_y_phap_tri btypt
          JOIN benh_tay_y bty ON bty.id = btypt.id_benh_tay_y
          WHERE btypt.id_phap_tri = pt.id${cbFilter}
        )
        OR EXISTS (
          SELECT 1 FROM bai_thuoc_phap_tri btpt
          JOIN benh_tay_y_bai_thuoc btybt ON btybt.id_bai_thuoc = btpt.id_bai_thuoc
          JOIN benh_tay_y bty ON bty.id = btybt.id_benh_tay_y
          WHERE btpt.id_phap_tri = pt.id${cbFilter}
        )
      )`;
    };

    const baseQb = this.repo.createQueryBuilder('pt');
    if (q) {
      const term = `%${q}%`;
      baseQb.andWhere(
        '(pt.the_benh ILIKE :term OR pt.nguyen_tac ILIKE :term OR pt.trieu_chung_mo_ta ILIKE :term OR pt.luc_kinh ILIKE :term)',
        { term },
      );
    }
    if (category === 'tay-y') {
      if (chungBenhId != null) {
        baseQb.andWhere(tayYExistsClause('cbId'), { cbId: chungBenhId });
      } else {
        baseQb.andWhere(tayYExistsClause());
      }
    } else if (category === 'dong-y') {
      baseQb.andWhere(`NOT ${tayYExistsClause()}`);
    }
    if (category !== 'all') {
      if (tangPhuIds.length > 0) {
        baseQb.andWhere(
          `EXISTS (SELECT 1 FROM phap_tri_kinh_mach pkm WHERE pkm.id_phap_tri = pt.id AND pkm.id_kinh_mach IN (:...tangPhuIds))`,
          { tangPhuIds },
        );
      }
      if (tonThuongTacNhans.length > 0) {
        baseQb.andWhere(
          `pt.luc_kinh IS NOT NULL AND EXISTS (
            SELECT 1 FROM unnest(string_to_array(pt.luc_kinh, ',')) AS tt(name)
            WHERE LOWER(TRIM(tt.name)) IN (:...tonThuongNames)
          )`,
          { tonThuongNames: tonThuongTacNhans.map((s) => s.toLowerCase()) },
        );
      }
    }

    // Deep-link focus: nếu có focusId, nhảy tới trang chứa pháp trị đó
    // (theo đúng filter hiện tại + thứ tự pt.id ASC) để frontend scroll/highlight được.
    if (focusId != null) {
      const exists = await baseQb.clone().andWhere('pt.id = :focusId', { focusId }).getCount();
      if (exists > 0) {
        const before = await baseQb.clone().andWhere('pt.id < :focusId', { focusId }).getCount();
        page = Math.floor(before / limit) + 1;
      }
    }

    const [items, total] = await baseQb
      .orderBy('pt.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    let data: PhapTri[] = [];
    if (items.length) {
      const ids = items.map((x) => x.id);
      data = await this.repo.find({
        where: { id: In(ids) },
        relations: [
          'kinh_mach_list',
          'trieu_chung_list',
          'bai_thuoc',
          'bai_thuoc_links',
          'bai_thuoc_links.baiThuoc',
        ],
        order: { id: 'ASC' },
      });
    }

    // Counts toàn bộ (không apply search) cho 3 category.
    const totalAll = await this.repo.count();
    const totalTayY = await this.repo
      .createQueryBuilder('pt')
      .where(tayYExistsClause())
      .getCount();

    // Map pt.id → các bệnh Tây Y liên quan (trực tiếp + qua bài thuốc).
    // Chỉ load cho các pt trong page hiện tại để giảm payload.
    const relatedBenhTayYByPtId: Record<number, Array<{ id: number; ten_benh: string; chungBenh: { id: number; ten_chung_benh: string } | null }>> = {};
    if (data.length) {
      const ptIds = data.map((x) => x.id);
      const rows: Array<{ pt_id: number; bty_id: number; ten_benh: string; cb_id: number | null; cb_name: string | null }> = await this.repo.query(
        `SELECT btypt.id_phap_tri AS pt_id, bty.id AS bty_id, bty.ten_benh, bty.id_chung_benh AS cb_id, cb.ten_chung_benh AS cb_name
         FROM benh_tay_y_phap_tri btypt
         JOIN benh_tay_y bty ON bty.id = btypt.id_benh_tay_y
         LEFT JOIN chung_benh cb ON cb.id = bty.id_chung_benh
         WHERE btypt.id_phap_tri = ANY($1)
         UNION
         SELECT btpt.id_phap_tri AS pt_id, bty.id AS bty_id, bty.ten_benh, bty.id_chung_benh AS cb_id, cb.ten_chung_benh AS cb_name
         FROM bai_thuoc_phap_tri btpt
         JOIN benh_tay_y_bai_thuoc btybt ON btybt.id_bai_thuoc = btpt.id_bai_thuoc
         JOIN benh_tay_y bty ON bty.id = btybt.id_benh_tay_y
         LEFT JOIN chung_benh cb ON cb.id = bty.id_chung_benh
         WHERE btpt.id_phap_tri = ANY($1)`,
        [ptIds],
      );
      const seenByPt = new Map<number, Set<number>>();
      for (const r of rows) {
        const ptId = Number(r.pt_id);
        const btyId = Number(r.bty_id);
        let seen = seenByPt.get(ptId);
        if (!seen) {
          seen = new Set();
          seenByPt.set(ptId, seen);
          relatedBenhTayYByPtId[ptId] = [];
        }
        if (seen.has(btyId)) continue;
        seen.add(btyId);
        relatedBenhTayYByPtId[ptId].push({
          id: btyId,
          ten_benh: r.ten_benh,
          chungBenh: r.cb_id != null ? { id: Number(r.cb_id), ten_chung_benh: r.cb_name ?? '' } : null,
        });
      }
    }

    // Thể bệnh (thực thể the_benh) dẫn xuất theo pháp trị: pt → benh_dong_y_phap_tri → the_benh.id_benh.
    // Dùng cho "Thể Bệnh → Triệu Chứng" trên card; frontend fallback về chung_trang (text) nếu rỗng.
    const theBenhByPtId: Record<number, string[]> = {};
    if (data.length) {
      const ptIds = data.map((x) => x.id);
      const tbRows: Array<{ pt_id: number; ten_the_benh: string }> = await this.repo.query(
        `SELECT DISTINCT bdpt.id_phap_tri AS pt_id, tbe.ten_the_benh
         FROM benh_dong_y_phap_tri bdpt
         JOIN the_benh tbe ON tbe.id_benh = bdpt.id_benh_dong_y
         WHERE bdpt.id_phap_tri = ANY($1)
         ORDER BY tbe.ten_the_benh`,
        [ptIds],
      );
      for (const r of tbRows) {
        const k = Number(r.pt_id);
        const arr = theBenhByPtId[k] ?? [];
        arr.push(r.ten_the_benh);
        theBenhByPtId[k] = arr;
      }
    }

    // Stats theo chủng bệnh Tây Y (toàn DB, không lệ thuộc page) — để render sub-sub-tabs.
    const cbStatsRows: Array<{ cb_id: number; cb_name: string; cnt: number }> = await this.repo.query(
      `WITH related AS (
        SELECT DISTINCT btypt.id_phap_tri AS pt_id, bty.id_chung_benh AS cb_id
        FROM benh_tay_y_phap_tri btypt
        JOIN benh_tay_y bty ON bty.id = btypt.id_benh_tay_y
        WHERE bty.id_chung_benh IS NOT NULL
        UNION
        SELECT DISTINCT btpt.id_phap_tri AS pt_id, bty.id_chung_benh AS cb_id
        FROM bai_thuoc_phap_tri btpt
        JOIN benh_tay_y_bai_thuoc btybt ON btybt.id_bai_thuoc = btpt.id_bai_thuoc
        JOIN benh_tay_y bty ON bty.id = btybt.id_benh_tay_y
        WHERE bty.id_chung_benh IS NOT NULL
      )
      SELECT cb.id AS cb_id, cb.ten_chung_benh AS cb_name, COUNT(DISTINCT r.pt_id)::int AS cnt
      FROM related r
      JOIN chung_benh cb ON cb.id = r.cb_id
      GROUP BY cb.id, cb.ten_chung_benh
      HAVING COUNT(DISTINCT r.pt_id) > 0
      ORDER BY cb.ten_chung_benh`,
    );
    const tayYChungBenhStats = cbStatsRows.map((r) => ({
      id: Number(r.cb_id),
      name: r.cb_name,
      count: Number(r.cnt),
    }));

    // SQL pool filter phản ánh category (+ chungBenhId khi tay-y). Bỏ qua chính 2 filter tangPhu/tonThuong
    // để stats hiển thị tất cả lựa chọn còn lại theo pool, không tự co lại khi user click chọn.
    const tayYExistsBare = `(
      EXISTS (SELECT 1 FROM benh_tay_y_phap_tri btypt
              JOIN benh_tay_y bty ON bty.id = btypt.id_benh_tay_y
              WHERE btypt.id_phap_tri = pt.id${chungBenhId != null ? ' AND bty.id_chung_benh = $1' : ''})
      OR EXISTS (SELECT 1 FROM bai_thuoc_phap_tri btpt
                 JOIN benh_tay_y_bai_thuoc btybt ON btybt.id_bai_thuoc = btpt.id_bai_thuoc
                 JOIN benh_tay_y bty ON bty.id = btybt.id_benh_tay_y
                 WHERE btpt.id_phap_tri = pt.id${chungBenhId != null ? ' AND bty.id_chung_benh = $1' : ''})
    )`;
    let poolFilter = '';
    const statsParams: unknown[] = [];
    if (category === 'tay-y') {
      poolFilter = `AND ${tayYExistsBare}`;
      if (chungBenhId != null) statsParams.push(chungBenhId);
    } else if (category === 'dong-y') {
      poolFilter = `AND NOT ${tayYExistsBare}`;
    }

    // Stats theo Tạng phủ (kinh mạch) trên pool hiện tại — render sub-sub-tabs khi ở tab Đông Y / Tây Y.
    const tangPhuStatsRows: Array<{ id: number; name: string; cnt: number }> = await this.repo.query(
      `SELECT km.id_kinh_mach AS id,
              km.ten_kinh_mach AS name,
              COUNT(DISTINCT pkm.id_phap_tri)::int AS cnt
       FROM phap_tri_kinh_mach pkm
       JOIN phap_tri pt ON pt.id = pkm.id_phap_tri
       JOIN kinh_mach km ON km.id_kinh_mach = pkm.id_kinh_mach
       WHERE 1=1 ${poolFilter}
       GROUP BY km.id_kinh_mach, km.ten_kinh_mach
       HAVING COUNT(DISTINCT pkm.id_phap_tri) > 0
       ORDER BY km.ten_kinh_mach`,
      statsParams,
    );
    const tangPhuStats = tangPhuStatsRows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      count: Number(r.cnt),
    }));

    // Stats theo Tổn thương - Tác nhân: catalog ton_thuong_tac_nhan + đếm pháp trị có name xuất hiện trong luc_kinh.
    const tonThuongStatsRows: Array<{ id: number; name: string; cnt: number }> = await this.repo.query(
      `SELECT tt.id AS id, tt.ten AS name,
              COUNT(DISTINCT pt.id)::int AS cnt
       FROM ton_thuong_tac_nhan tt
       LEFT JOIN phap_tri pt
         ON pt.luc_kinh IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM unnest(string_to_array(pt.luc_kinh, ',')) AS u(v)
          WHERE LOWER(TRIM(u.v)) = LOWER(TRIM(tt.ten))
        )
        ${poolFilter}
       GROUP BY tt.id, tt.ten
       HAVING COUNT(DISTINCT pt.id) > 0
       ORDER BY tt.ten`,
      statsParams,
    );
    const tonThuongStats = tonThuongStatsRows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      count: Number(r.cnt),
    }));

    return {
      data,
      total,
      page,
      limit,
      statsByCategory: {
        all: totalAll,
        'dong-y': totalAll - totalTayY,
        'tay-y': totalTayY,
      },
      relatedBenhTayYByPtId,
      theBenhByPtId,
      tayYChungBenhStats,
      tangPhuStats,
      tonThuongStats,
    };
  }

  async findOne(id: number): Promise<PhapTri> {
    const item = await this.repo.findOne({
      where: { id },
      relations: [...PhapTriService.RELATIONS],
    });
    if (!item) {
      throw new NotFoundException(`Pháp trị #${id} không tồn tại`);
    }
    return item;
  }

  private static has<K extends string>(dto: object, key: K): dto is Record<K, unknown> {
    return Object.prototype.hasOwnProperty.call(dto, key);
  }

  /** Ưu tiên key mới the_benh; fallback chung_trang để tương thích client cũ. */
  private static readTheBenh(dto: CreatePhapTriDto | UpdatePhapTriDto): string | null | undefined {
    if (PhapTriService.has(dto, 'the_benh')) return dto.the_benh;
    if (PhapTriService.has(dto, 'chung_trang')) return dto.chung_trang;
    return undefined;
  }

  private async resolveKinhMach(ids?: number[] | null): Promise<KinhMach[]> {
    if (!ids?.length) return [];
    return this.kinhRepo.findBy({ idKinhMach: In(ids) });
  }

  /** PG 23505 = unique_violation (vd. id_benh_dong_y UNIQUE) */
  private static isPostgresUniqueViolation(err: unknown): boolean {
    return err instanceof QueryFailedError && (err as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505';
  }

  private async resolveBenhDongY(ids?: number[] | null): Promise<MeridianSyndrome[]> {
    if (!ids?.length) return [];
    return this.benhDongYRepo.findBy({ id: In(ids) });
  }

  /** create: thiếu key → null; update: chỉ đổi khi key có trong body */
  private async applyRefs(
    entity: PhapTri,
    dto: CreatePhapTriDto | UpdatePhapTriDto,
    mode: 'create' | 'update',
  ): Promise<void> {
    const touch = (key: keyof CreatePhapTriDto) =>
      mode === 'create' || PhapTriService.has(dto, key as string);

    const hasMany = PhapTriService.has(dto, 'id_benh_dong_y_list');
    const hasSingle = PhapTriService.has(dto, 'id_benh_dong_y');
    if (mode === 'create' || hasMany || hasSingle) {
      const ids = hasMany
        ? dto.id_benh_dong_y_list ?? []
        : hasSingle && dto.id_benh_dong_y != null
          ? [dto.id_benh_dong_y]
          : [];
      const uniq = [...new Set(ids.filter((x): x is number => Number.isFinite(Number(x))).map((x) => Number(x)))];
      entity.benh_dong_y_list = await this.resolveBenhDongY(uniq);
    }

    if (touch('id_kinh_mach_list')) {
      entity.kinh_mach_list = await this.resolveKinhMach(dto.id_kinh_mach_list);
    } else if (mode === 'create') {
      entity.kinh_mach_list = [];
    }

    await this.applyTrieuChungAndMoTa(entity, dto, mode);
  }

  private formatMoTaFromTrieuChungList(list: TrieuChung[]): string | null {
    if (!list.length) return null;
    return list
      .map((t) => t.ten_trieu_chung.trim())
      .filter(Boolean)
      .join(', ');
  }

  private async applyTrieuChungAndMoTa(
    entity: PhapTri,
    dto: CreatePhapTriDto | UpdatePhapTriDto,
    mode: 'create' | 'update',
  ): Promise<void> {
    const hasList = PhapTriService.has(dto, 'id_trieu_chung_list');
    const hasText = PhapTriService.has(dto, 'trieu_chung_mo_ta');
    if (hasText) {
      throw new BadRequestException(
        'Không hỗ trợ ghi trực tiếp trieu_chung_mo_ta dạng text. Vui lòng gửi id_trieu_chung_list.',
      );
    }

    if (mode === 'update' && !hasList) {
      return;
    }

    if (hasList) {
      const ids = [...new Set((dto.id_trieu_chung_list ?? []).filter((x): x is number => Number.isFinite(x)))];
      const found = ids.length ? await this.trieuChungRepo.findBy({ id: In(ids) }) : [];
      const byId = new Map(found.map((t) => [t.id, t]));
      entity.trieu_chung_list = ids.map((id) => byId.get(id)).filter((t): t is TrieuChung => t != null);
      entity.trieu_chung_mo_ta = this.formatMoTaFromTrieuChungList(entity.trieu_chung_list);
      return;
    }
    if (mode === 'create') {
      entity.trieu_chung_list = [];
      entity.trieu_chung_mo_ta = null;
    }
  }

  /** Chuỗi id bài thuốc; 'unchanged' = không đổi junction (chỉ PUT). */
  private planBaiThuocIds(
    dto: CreatePhapTriDto | UpdatePhapTriDto,
    mode: 'create' | 'update',
  ): number[] | 'unchanged' {
    const hasList = PhapTriService.has(dto, 'id_bai_thuoc_list');
    const hasSingle = PhapTriService.has(dto, 'id_bai_thuoc');
    if (mode === 'create') {
      if (hasList) {
        return [...new Set((dto.id_bai_thuoc_list ?? []).filter((x): x is number => Number.isFinite(x)))];
      }
      if (hasSingle) {
        const v = dto.id_bai_thuoc;
        return v != null && Number.isFinite(Number(v)) ? [Number(v)] : [];
      }
      return [];
    }
    if (hasList) {
      return [...new Set((dto.id_bai_thuoc_list ?? []).filter((x): x is number => Number.isFinite(x)))];
    }
    if (hasSingle) {
      const v = dto.id_bai_thuoc;
      return v != null && Number.isFinite(Number(v)) ? [Number(v)] : [];
    }
    return 'unchanged';
  }

  private async syncPhapTriBaiThuocLinks(
    phapTriId: number,
    dto: CreatePhapTriDto | UpdatePhapTriDto,
    mode: 'create' | 'update',
  ): Promise<void> {
    const plan = this.planBaiThuocIds(dto, mode);
    if (plan === 'unchanged') {
      return;
    }
    const ids = plan;
    await this.baiPhapTriLinkRepo.delete({ idPhapTri: phapTriId });
    let ord = 0;
    for (const idBt of ids) {
      const bt = await this.baiThuocRepo.findOneBy({ id: idBt });
      if (!bt) {
        continue;
      }
      await this.baiPhapTriLinkRepo.save(
        this.baiPhapTriLinkRepo.create({
          idBaiThuoc: idBt,
          idPhapTri: phapTriId,
          thuTu: ord,
          doanChungTrang: null,
        }),
      );
      ord += 1;
    }
    const item = await this.repo.findOne({ where: { id: phapTriId } });
    if (!item) {
      return;
    }
    const firstId = ids.length > 0 ? ids[0]! : null;
    item.bai_thuoc =
      firstId != null ? ((await this.baiThuocRepo.findOneBy({ id: firstId })) ?? null) : null;
    await this.repo.save(item);
  }

  /**
   * Sinh lại bảng cache `trieu_chung_bai_thuoc_phap_tri` (Triệu Chứng ↔ Bài Thuốc dẫn xuất QUA Pháp Trị)
   * cho tập triệu chứng bị ảnh hưởng bởi một thao tác Pháp Trị.
   *
   * Bảng cache do hàm này SỞ HỮU hoàn toàn: xoá sạch các hàng của những triệu chứng bị ảnh hưởng rồi
   * tính lại từ trạng thái HIỆN TẠI (phap_tri_trieu_chung × bài thuốc của cùng pháp trị). Phải gọi SAU khi
   * trieu_chung_list (m2m) và bai_thuoc_links đã được lưu. KHÔNG đụng tới `bai_thuoc_trieu_chung` (curated).
   */
  private async syncDerivedTrieuChungBaiThuoc(tcIds: number[]): Promise<void> {
    const ids = [...new Set(tcIds.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
    if (ids.length === 0) return;
    await this.repo.query(
      `DELETE FROM trieu_chung_bai_thuoc_phap_tri WHERE id_trieu_chung = ANY($1)`,
      [ids],
    );
    await this.repo.query(
      `INSERT INTO trieu_chung_bai_thuoc_phap_tri (id_trieu_chung, id_bai_thuoc)
       SELECT DISTINCT ptc.id_trieu_chung, src.id_bai_thuoc
       FROM phap_tri_trieu_chung ptc
       JOIN (
         SELECT id_phap_tri, id_bai_thuoc FROM bai_thuoc_phap_tri
         UNION
         SELECT id AS id_phap_tri, id_bai_thuoc FROM phap_tri WHERE id_bai_thuoc IS NOT NULL
       ) src ON src.id_phap_tri = ptc.id_phap_tri
       WHERE ptc.id_trieu_chung = ANY($1)
       ON CONFLICT DO NOTHING`,
      [ids],
    );
  }

  async create(dto: CreatePhapTriDto): Promise<PhapTri> {
    const theBenh = PhapTriService.readTheBenh(dto);
    const entity = this.repo.create({
      chung_trang: theBenh ?? null,
      nguyen_tac: dto.nguyen_tac ?? null,
      y_nghia_co_che: dto.y_nghia_co_che ?? null,
      bat_phap: dto.bat_phap ?? null,
      bat_cuong: dto.bat_cuong ?? null,
      luc_dam: dto.luc_dam ?? null,
      luc_kinh: dto.luc_kinh ?? null,
      am_duong: dto.am_duong ?? null,
      ton_thuong: dto.ton_thuong ?? null,
      tac_nhan: dto.tac_nhan ?? null,
      ban_chat: dto.ban_chat ?? null,
      vi_tri_tien_trinh: dto.vi_tri_tien_trinh ?? null,
      mach_chan: dto.mach_chan ?? null,
      chat_luoi: dto.chat_luoi ?? null,
      nguyen_nhan: dto.nguyen_nhan ?? null,
      trieu_chung_mo_ta: null,
      kinh_mach_list: [],
      trieu_chung_list: [],
    });
    await this.applyRefs(entity, dto, 'create');
    try {
      await this.repo.save(entity);
    } catch (e) {
      if (PhapTriService.isPostgresUniqueViolation(e)) throw new ConflictException('Dữ liệu pháp trị bị trùng ràng buộc UNIQUE.');
      throw e;
    }
    await this.syncPhapTriBaiThuocLinks(entity.id, dto, 'create');
    await this.syncDerivedTrieuChungBaiThuoc((entity.trieu_chung_list ?? []).map((t) => t.id));
    return this.findOne(entity.id);
  }

  async update(id: number, dto: UpdatePhapTriDto): Promise<PhapTri> {
    const item = await this.findOne(id);
    // Triệu chứng TRƯỚC khi sửa (applyRefs sẽ ghi đè item.trieu_chung_list) — để tính lại cache cho cả cũ ∪ mới.
    const oldTcIds = (item.trieu_chung_list ?? []).map((t) => t.id);
    const theBenh = PhapTriService.readTheBenh(dto);
    if (theBenh !== undefined) item.chung_trang = theBenh;
    if (dto.nguyen_tac !== undefined) item.nguyen_tac = dto.nguyen_tac;
    if (dto.y_nghia_co_che !== undefined) item.y_nghia_co_che = dto.y_nghia_co_che;
    if (dto.bat_phap !== undefined) item.bat_phap = dto.bat_phap;
    if (dto.bat_cuong !== undefined) item.bat_cuong = dto.bat_cuong;
    if (dto.luc_dam !== undefined) item.luc_dam = dto.luc_dam;
    if (dto.luc_kinh !== undefined) item.luc_kinh = dto.luc_kinh;
    if (dto.am_duong !== undefined) item.am_duong = dto.am_duong;
    if (dto.ton_thuong !== undefined) item.ton_thuong = dto.ton_thuong;
    if (dto.tac_nhan !== undefined) item.tac_nhan = dto.tac_nhan;
    if (dto.ban_chat !== undefined) item.ban_chat = dto.ban_chat;
    if (dto.vi_tri_tien_trinh !== undefined) item.vi_tri_tien_trinh = dto.vi_tri_tien_trinh;
    if (dto.mach_chan !== undefined) item.mach_chan = dto.mach_chan;
    if (dto.chat_luoi !== undefined) item.chat_luoi = dto.chat_luoi;
    if (dto.nguyen_nhan !== undefined) item.nguyen_nhan = dto.nguyen_nhan;

    await this.applyRefs(item, dto, 'update');
    try {
      await this.repo.save(item);
    } catch (e) {
      if (PhapTriService.isPostgresUniqueViolation(e)) throw new ConflictException('Dữ liệu pháp trị bị trùng ràng buộc UNIQUE.');
      throw e;
    }
    await this.syncPhapTriBaiThuocLinks(id, dto, 'update');
    const newTcIds = (item.trieu_chung_list ?? []).map((t) => t.id);
    await this.syncDerivedTrieuChungBaiThuoc([...oldTcIds, ...newTcIds]);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    const tcIds = (item.trieu_chung_list ?? []).map((t) => t.id);
    await this.repo.remove(item);
    // Pháp trị (cùng junction phap_tri_trieu_chung / bai_thuoc_phap_tri) đã bị xoá → tính lại cache cho các triệu chứng cũ.
    await this.syncDerivedTrieuChungBaiThuoc(tcIds);
  }
}
