import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, ILike, EntityManager } from 'typeorm';
import { BaiThuoc } from '../models/bai-thuoc.model';
import { BaiThuocChiTiet } from '../models/bai-thuoc-chi-tiet.model';
import { BaiThuocPhapTri } from '../models/bai-thuoc-phap-tri.model';
import { PhapTri } from '../models/phap-tri.model';
import { ViThuoc } from '../models/vi-thuoc.model';
import { TrieuChung } from '../models/trieu-chung.model';
import { CreateBaiThuocDto, UpdateBaiThuocDto } from '../models/dongy-thuoc.dto';

@Injectable()
export class BaiThuocService {
  constructor(
    @InjectRepository(BaiThuoc)
    private repo: Repository<BaiThuoc>,
    @InjectRepository(BaiThuocChiTiet)
    private detailRepo: Repository<BaiThuocChiTiet>,
    @InjectRepository(ViThuoc)
    private viThuocRepo: Repository<ViThuoc>,
    private dataSource: DataSource,
  ) {}

  private static readonly BT_VI_RELATIONS = [
    'chiTietViThuoc',
    'chiTietViThuoc.viThuoc',
    'chiTietViThuoc.viThuoc.congDungLinks',
    'chiTietViThuoc.viThuoc.congDungLinks.congDung',
    'chiTietViThuoc.viThuoc.chuTriLinks',
    'chiTietViThuoc.viThuoc.chuTriLinks.chuTri',
    'chiTietViThuoc.viThuoc.kiengKyLinks',
    'chiTietViThuoc.viThuoc.kiengKyLinks.kiengKy',
    'chiTietViThuoc.viThuoc.tenGoiKhacList',
    'phapTriLinks',
    'phapTriLinks.phapTri',
    'phapTriLinks.phapTri.trieu_chung_list',
    'trieuChungList',
  ] as const;

  private static dtoHasPhapTriIds(dto: object): dto is { phap_tri_ids: number[] | undefined } {
    return Object.prototype.hasOwnProperty.call(dto, 'phap_tri_ids');
  }

  private static dtoHasTrieuChungIds(dto: object): dto is { trieu_chung_ids: number[] | undefined } {
    return Object.prototype.hasOwnProperty.call(dto, 'trieu_chung_ids');
  }

  private formatTrieuChungText(list: TrieuChung[]): string {
    return list.map((x) => x.ten_trieu_chung.trim()).filter(Boolean).join(', ');
  }

  private async applyTrieuChung(
    manager: EntityManager,
    bt: BaiThuoc,
    dto: CreateBaiThuocDto | UpdateBaiThuocDto,
    mode: 'create' | 'update',
  ): Promise<void> {
    const hasIds = BaiThuocService.dtoHasTrieuChungIds(dto);
    const hasText = Object.prototype.hasOwnProperty.call(dto, 'trieu_chung');
    if (mode === 'update' && !hasIds && !hasText) return;
    if (hasText) {
      throw new BadRequestException('Không hỗ trợ ghi trực tiếp trieu_chung dạng text. Vui lòng gửi trieu_chung_ids.');
    }
    if (!hasIds) {
      throw new BadRequestException('Thiếu trieu_chung_ids.');
    }

    let list: TrieuChung[] = [];
    const ids = [...new Set((dto.trieu_chung_ids ?? []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
    list = ids.length ? await manager.findBy(TrieuChung, { id: In(ids) }) : [];

    bt.trieuChungList = list;
    bt.trieu_chung = this.formatTrieuChungText(list);
    await manager.save(bt);
  }

  /** Cập nhật bảng bai_thuoc_phap_tri; update chỉ khi body có key phap_tri_ids. */
  private async applyPhapTriLinks(
    manager: EntityManager,
    idBaiThuoc: number,
    dto: CreateBaiThuocDto | UpdateBaiThuocDto,
    mode: 'create' | 'update',
  ): Promise<void> {
    if (mode === 'update' && !BaiThuocService.dtoHasPhapTriIds(dto)) return;
    const raw = BaiThuocService.dtoHasPhapTriIds(dto) ? dto.phap_tri_ids : undefined;
    if (mode === 'create' && raw === undefined) return;

    if (mode === 'update') {
      await manager.delete(BaiThuocPhapTri, { idBaiThuoc });
    }

    const ids = (raw ?? []).filter((x): x is number => Number.isFinite(x));
    if (!ids.length) return;

    const uniq: number[] = [...new Set(ids)];
    const found = await manager.find(PhapTri, { where: { id: In(uniq) }, select: ['id'] });
    const allowed = new Set(found.map((e) => e.id));
    let ord = 0;
    for (const ptId of uniq) {
      if (!allowed.has(ptId)) continue;
      await manager.save(
        manager.create(BaiThuocPhapTri, {
          idBaiThuoc,
          idPhapTri: ptId,
          thuTu: ord,
          doanChungTrang: null,
        }),
      );
      ord += 1;
    }
  }

  findAll(): Promise<BaiThuoc[]> {
    return this.repo.find({
      relations: [...BaiThuocService.BT_VI_RELATIONS],
      order: { ten_bai_thuoc: 'ASC' },
    });
  }

  /**
   * Trả full danh sách id + tên dùng cho dropdown picker.
   * Không relations, không pagination — dữ liệu rất nhẹ nên đủ an toàn để gọi unbounded.
   */
  findOptions(): Promise<Array<Pick<BaiThuoc, 'id' | 'ten_bai_thuoc'>>> {
    return this.repo.find({
      select: ['id', 'ten_bai_thuoc'],
      order: { ten_bai_thuoc: 'ASC' },
    });
  }

  /**
   * Lightweight, paginated list for the medicines tab.
   * - Cắt 4 cấp relations nặng (congDungLinks/chuTriLinks/kiengKyLinks/tenGoiKhacList) để query nhanh.
   * - Hỗ trợ search server-side trên các cột text + category filter (đông y / tây y).
   * - Hai-query pattern: count IDs trước, sau đó load lại với relations qua `In(ids)`
   *   để tránh `LIMIT` bị méo do JOIN.
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
    data: BaiThuoc[];
    total: number;
    page: number;
    limit: number;
    statsByCategory: { all: number; 'dong-y': number; 'tay-y': number };
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

    const baseQb = this.repo.createQueryBuilder('bt');
    if (q) {
      const term = `%${q}%`;
      baseQb.andWhere(
        '(bt.ten_bai_thuoc ILIKE :term OR bt.nguon_goc ILIKE :term OR bt.cach_dung ILIKE :term OR bt.trieu_chung ILIKE :term OR bt.the_benh ILIKE :term OR bt.chung_trang ILIKE :term)',
        { term },
      );
    }

    // EXISTS / NOT EXISTS dựa trên bảng nối benh_tay_y_bai_thuoc.
    const tayYExists = '(SELECT 1 FROM benh_tay_y_bai_thuoc bty_bt';
    if (category === 'tay-y') {
      if (chungBenhId != null) {
        baseQb.andWhere(
          `EXISTS ${tayYExists} JOIN benh_tay_y bty ON bty.id = bty_bt.id_benh_tay_y WHERE bty_bt.id_bai_thuoc = bt.id AND bty.id_chung_benh = :cbId)`,
          { cbId: chungBenhId },
        );
      } else {
        baseQb.andWhere(`EXISTS ${tayYExists} WHERE bty_bt.id_bai_thuoc = bt.id)`);
      }
    } else if (category === 'dong-y') {
      baseQb.andWhere(`NOT EXISTS ${tayYExists} WHERE bty_bt.id_bai_thuoc = bt.id)`);
    }
    if (category !== 'all') {
      if (tangPhuIds.length > 0) {
        baseQb.andWhere(
          `EXISTS (
             SELECT 1 FROM bai_thuoc_phap_tri btpt
             JOIN phap_tri_kinh_mach pkm ON pkm.id_phap_tri = btpt.id_phap_tri
             WHERE btpt.id_bai_thuoc = bt.id AND pkm.id_kinh_mach IN (:...tangPhuIds)
           )`,
          { tangPhuIds },
        );
      }
      if (tonThuongTacNhans.length > 0) {
        baseQb.andWhere(
          `EXISTS (
             SELECT 1 FROM bai_thuoc_phap_tri btpt
             JOIN phap_tri pt2 ON pt2.id = btpt.id_phap_tri
             WHERE btpt.id_bai_thuoc = bt.id
               AND pt2.luc_kinh IS NOT NULL
               AND EXISTS (
                 SELECT 1 FROM unnest(string_to_array(pt2.luc_kinh, ',')) AS tt(name)
                 WHERE LOWER(TRIM(tt.name)) IN (:...tonThuongNames)
               )
           )`,
          { tonThuongNames: tonThuongTacNhans.map((s) => s.toLowerCase()) },
        );
      }
    }

    // Deep-link focus: nếu có focusId, nhảy tới trang chứa bài thuốc đó
    // (theo đúng filter hiện tại + thứ tự ten_bai_thuoc ASC, id ASC) để frontend scroll/highlight được.
    if (focusId != null) {
      const target = await this.repo.findOne({
        where: { id: focusId },
        select: { id: true, ten_bai_thuoc: true },
      });
      if (target) {
        const exists = await baseQb.clone().andWhere('bt.id = :fid', { fid: focusId }).getCount();
        if (exists > 0) {
          const before = await baseQb
            .clone()
            .andWhere(
              '(bt.ten_bai_thuoc < :ften OR (bt.ten_bai_thuoc = :ften AND bt.id < :fid))',
              { ften: target.ten_bai_thuoc, fid: focusId },
            )
            .getCount();
          page = Math.floor(before / limit) + 1;
        }
      }
    }

    const [items, total] = await baseQb
      .orderBy('bt.ten_bai_thuoc', 'ASC')
      .addOrderBy('bt.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    let data: BaiThuoc[] = [];
    if (items.length) {
      const ids = items.map((x) => x.id);
      data = await this.repo.find({
        where: { id: In(ids) },
        relations: [
          'chiTietViThuoc',
          'chiTietViThuoc.viThuoc',
          'phapTriLinks',
          'phapTriLinks.phapTri',
          'phapTriLinks.phapTri.trieu_chung_list',
          'trieuChungList',
        ],
        order: { ten_bai_thuoc: 'ASC', id: 'ASC' },
      });
    }

    // Counts toàn bộ (không apply search) để hiển thị badge "Đông Y / Tây Y / Tất cả".
    const totalAll = await this.repo.count();
    const totalTayY = await this.repo
      .createQueryBuilder('bt')
      .where(`EXISTS ${tayYExists} WHERE bty_bt.id_bai_thuoc = bt.id)`)
      .getCount();

    // Pool filter dùng cho stats: phản ánh category (+ chungBenhId khi tay-y), bỏ qua filter tangPhu/tonThuong
    // để các option luôn hiển thị đầy đủ theo pool.
    const tayYExistsBare = chungBenhId != null
      ? `EXISTS (SELECT 1 FROM benh_tay_y_bai_thuoc bty_bt
                JOIN benh_tay_y bty ON bty.id = bty_bt.id_benh_tay_y
                WHERE bty_bt.id_bai_thuoc = bt.id AND bty.id_chung_benh = $1)`
      : `EXISTS (SELECT 1 FROM benh_tay_y_bai_thuoc bty_bt WHERE bty_bt.id_bai_thuoc = bt.id)`;
    let poolFilter = '';
    const statsParams: unknown[] = [];
    if (category === 'tay-y') {
      poolFilter = `AND ${tayYExistsBare}`;
      if (chungBenhId != null) statsParams.push(chungBenhId);
    } else if (category === 'dong-y') {
      poolFilter = `AND NOT EXISTS (SELECT 1 FROM benh_tay_y_bai_thuoc bty_bt WHERE bty_bt.id_bai_thuoc = bt.id)`;
    }

    // Stats theo Tạng phủ (kinh mạch) trên pool hiện tại — đi qua phap_tri.
    const tangPhuStatsRows: Array<{ id: number; name: string; cnt: number }> = await this.repo.query(
      `SELECT km.id_kinh_mach AS id,
              km.ten_kinh_mach AS name,
              COUNT(DISTINCT bt.id)::int AS cnt
       FROM bai_thuoc bt
       JOIN bai_thuoc_phap_tri btpt ON btpt.id_bai_thuoc = bt.id
       JOIN phap_tri_kinh_mach pkm ON pkm.id_phap_tri = btpt.id_phap_tri
       JOIN kinh_mach km ON km.id_kinh_mach = pkm.id_kinh_mach
       WHERE 1=1 ${poolFilter}
       GROUP BY km.id_kinh_mach, km.ten_kinh_mach
       HAVING COUNT(DISTINCT bt.id) > 0
       ORDER BY km.ten_kinh_mach`,
      statsParams,
    );
    const tangPhuStats = tangPhuStatsRows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      count: Number(r.cnt),
    }));

    // Stats theo Tổn thương - Tác nhân trên pool hiện tại.
    const tonThuongStatsRows: Array<{ id: number; name: string; cnt: number }> = await this.repo.query(
      `SELECT tt.id AS id, tt.ten AS name,
              COUNT(DISTINCT bt.id)::int AS cnt
       FROM ton_thuong_tac_nhan tt
       LEFT JOIN bai_thuoc bt
         ON EXISTS (
           SELECT 1 FROM bai_thuoc_phap_tri btpt
           JOIN phap_tri pt ON pt.id = btpt.id_phap_tri
           WHERE btpt.id_bai_thuoc = bt.id
             AND pt.luc_kinh IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM unnest(string_to_array(pt.luc_kinh, ',')) AS u(v)
               WHERE LOWER(TRIM(u.v)) = LOWER(TRIM(tt.ten))
             )
         )
         ${poolFilter}
       GROUP BY tt.id, tt.ten
       HAVING COUNT(DISTINCT bt.id) > 0
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
      tangPhuStats,
      tonThuongStats,
    };
  }

  findOne(id: number): Promise<BaiThuoc | null> {
    return this.repo.findOne({
      where: { id },
      relations: [...BaiThuocService.BT_VI_RELATIONS],
    });
  }

  /** Cache bài thuốc + phân tích cho trang DEMO công khai (tính 1 lần/đời tiến trình). */
  private demoFormulaCache: { baiThuoc: BaiThuoc; analysis: any } | null = null;
  /** Cache danh sách bài thuốc cho slider DEMO (nhiều bài) — quét 1 lần rồi giữ lại. */
  private demoFormulasCache: BaiThuoc[] | null = null;

  /**
   * Chọn 1 bài thuốc kinh điển để DEMO công khai (khách chưa đăng nhập xem thử
   * phân tích tính vị quy kinh + Quân–Thần–Tá–Sứ).
   * - Có thể chỉ định cứng qua biến môi trường DEMO_BAI_THUOC_ID.
   * - Mặc định: ưu tiên vài bài thuốc nổi tiếng, dễ nhận biết; nếu không có thì lấy
   *   bài thuốc đầu tiên có đủ ≥ 3 vị thuốc.
   */
  async findDemoFormula(): Promise<{ baiThuoc: BaiThuoc; analysis: any }> {
    if (this.demoFormulaCache) return this.demoFormulaCache;

    let id: number | null = process.env.DEMO_BAI_THUOC_ID
      ? Number(process.env.DEMO_BAI_THUOC_ID)
      : null;

    if (!id || !Number.isFinite(id)) {
      const preferred = ['Lục Vị Địa Hoàng Hoàn', 'Bổ Trung Ích Khí Thang', 'Tiêu Dao Tán'];
      for (const name of preferred) {
        const found = await this.repo.findOne({
          where: { ten_bai_thuoc: ILike(`%${name}%`) },
          relations: ['chiTietViThuoc'],
        });
        // Chỉ chọn nếu bài thuốc có đủ vị thuốc để phân tích cho sinh động.
        if (found && (found.chiTietViThuoc?.length ?? 0) >= 3) {
          id = found.id;
          break;
        }
      }
    }

    if (!id) {
      const candidates = await this.repo.find({
        relations: ['chiTietViThuoc'],
        order: { ten_bai_thuoc: 'ASC' },
        take: 100,
      });
      const good = candidates.find((b) => (b.chiTietViThuoc?.length ?? 0) >= 3);
      id = (good ?? candidates[0])?.id ?? null;
    }

    if (!id) {
      throw new NotFoundException('Chưa có bài thuốc nào để demo');
    }

    const baiThuoc = await this.findOne(id);
    if (!baiThuoc) {
      throw new NotFoundException('Không tìm thấy bài thuốc demo');
    }
    const analysis = await this.analyzeBaiThuoc(id);
    this.demoFormulaCache = { baiThuoc, analysis };
    return this.demoFormulaCache;
  }

  /**
   * Chọn VÀI bài thuốc kinh điển cho slider DEMO công khai (khách lướt xem nhiều bài).
   * Ưu tiên các bài nổi tiếng, đủ ≥ 3 vị để phân tích sinh động; thiếu thì bù bằng bài khác.
   * Trả về mỗi bài đã có đủ chi tiết (findOne) — KHÔNG kèm analysis (frontend tự tính).
   */
  async findDemoFormulas(count = 5): Promise<BaiThuoc[]> {
    const want = Math.max(1, Math.min(count, 12));
    if (this.demoFormulasCache) return this.demoFormulasCache.slice(0, want);

    const preferred = [
      'Bổ Trung Ích Khí Thang',
      'Lục Vị Địa Hoàng Hoàn',
      'Tiêu Dao Tán',
      'Tứ Quân Tử Thang',
      'Tứ Vật Thang',
      'Bát Trân Thang',
      'Quy Tỳ Thang',
      'Sài Hồ Sơ Can Tán',
      'Ngọc Bình Phong Tán',
      'Lý Trung Thang',
      'Thập Toàn Đại Bổ Thang',
      'Bán Hạ Tả Tâm Thang',
    ];

    const ids: number[] = [];
    const seen = new Set<number>();
    const pushIf = (b?: BaiThuoc | null) => {
      if (b && (b.chiTietViThuoc?.length ?? 0) >= 3 && !seen.has(b.id)) {
        seen.add(b.id);
        ids.push(b.id);
      }
    };

    for (const name of preferred) {
      if (ids.length >= want) break;
      const found = await this.repo.findOne({
        where: { ten_bai_thuoc: ILike(`%${name}%`) },
        relations: ['chiTietViThuoc'],
      });
      pushIf(found);
    }

    // Bù thêm nếu chưa đủ: lấy bài thuốc khác có đủ ≥ 3 vị.
    if (ids.length < want) {
      const candidates = await this.repo.find({
        relations: ['chiTietViThuoc'],
        order: { ten_bai_thuoc: 'ASC' },
        take: 200,
      });
      for (const b of candidates) {
        if (ids.length >= want) break;
        pushIf(b);
      }
    }

    if (!ids.length) {
      throw new NotFoundException('Chưa có bài thuốc nào để demo');
    }

    const list: BaiThuoc[] = [];
    for (const id of ids) {
      const full = await this.findOne(id);
      if (full) list.push(full);
    }
    this.demoFormulasCache = list;
    return list;
  }

  async create(dto: CreateBaiThuocDto): Promise<BaiThuoc> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { chi_tiet, phap_tri_ids: _pt, trieu_chung_ids: _tcIds, ...rest } = dto;
      const bt = this.repo.create(rest);
      const savedBt = await queryRunner.manager.save(bt);

      if (chi_tiet && chi_tiet.length > 0) {
        const details = chi_tiet.map((d) =>
          this.detailRepo.create({
            idBaiThuoc: savedBt.id,
            idViThuoc: d.id_vi_thuoc,
            lieu_luong: d.lieu_luong,
            vai_tro: d.vai_tro,
            ghi_chu: d.ghi_chu,
            tinh_vi: d.tinh_vi,
            quy_kinh: d.quy_kinh,
          }),
        );
        await queryRunner.manager.save(details);
      }
      await this.applyPhapTriLinks(queryRunner.manager, savedBt.id, dto, 'create');
      await this.applyTrieuChung(queryRunner.manager, savedBt, dto, 'create');
      await queryRunner.commitTransaction();
      return this.findOne(savedBt.id) as Promise<BaiThuoc>;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: number, dto: UpdateBaiThuocDto): Promise<BaiThuoc | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { chi_tiet, phap_tri_ids: _pt, trieu_chung_ids: _tcIds, ...rest } = dto;
      await queryRunner.manager.update(BaiThuoc, id, rest);
      const savedBt = await queryRunner.manager.findOneByOrFail(BaiThuoc, { id });

      if (chi_tiet) {
        await queryRunner.manager.delete(BaiThuocChiTiet, { idBaiThuoc: id });
        const details = chi_tiet.map((d) =>
          this.detailRepo.create({
            idBaiThuoc: id,
            idViThuoc: d.id_vi_thuoc,
            lieu_luong: d.lieu_luong,
            vai_tro: d.vai_tro,
            ghi_chu: d.ghi_chu,
            tinh_vi: d.tinh_vi,
            quy_kinh: d.quy_kinh,
          }),
        );
        await queryRunner.manager.save(details);
      }
      await this.applyPhapTriLinks(queryRunner.manager, id, dto, 'update');
      await this.applyTrieuChung(queryRunner.manager, savedBt, dto, 'update');
      await queryRunner.commitTransaction();
      return this.findOne(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: number): Promise<void> {
    await this.repo.delete(id);
  }

  // ─── PHÂN TÍCH BÀI THUỐC (Radar Chart Algorithm) ────────────────────────────
  async analyzeBaiThuoc(id: number): Promise<any> {
    const baiThuoc = await this.findOne(id);
    if (!baiThuoc || !baiThuoc.chiTietViThuoc || baiThuoc.chiTietViThuoc.length === 0) {
      return { success: false, error: 'Không tìm thấy bài thuốc hoặc bài thuốc chưa có vị thuốc.' };
    }

    const details = baiThuoc.chiTietViThuoc;

    // Bước 1: Chuẩn hóa liều lượng sang gram (số thực)
    const parseLieu = (lieu: string | null | undefined): number => {
      if (!lieu) return 9; // default 9g
      const s = (lieu || '').trim().toLowerCase();
      if (s === '*') return 2.25;  // 1.5g - 3g avg
      if (s === '#') return 22.5;  // 15g - 30g avg
      // Xử lý "X tiền" -> gram (1 tiền ≈ 3g)
      const tienMatch = s.match(/^([\d.]+)\s*tiền?$/);
      if (tienMatch) return parseFloat(tienMatch[1]) * 3;
      // Xử lý "X lượng" -> gram (1 lượng ≈ 30g)
      const luongMatch = s.match(/^([\d.]+)\s*lư?ợng?$/);
      if (luongMatch) return parseFloat(luongMatch[1]) * 30;
      // Xử lý "Xg"
      const gMatch = s.match(/^([\d.]+)\s*g?$/);
      if (gMatch) return parseFloat(gMatch[1]);
      return 9; // fallback
    };

    // Lấy dữ liệu vị thuốc đầy đủ
    const items = await Promise.all(details.map(async (d) => {
      const vt = d.viThuoc || await this.viThuocRepo.findOneBy({ id: d.idViThuoc });
      const gram = parseLieu(d.lieu_luong);
      return { d, vt, gram };
    }));

    const validItems = items.filter(x => x.vt != null);
    if (validItems.length === 0) {
      return { success: false, error: 'Không có dữ liệu vị thuốc để phân tích.' };
    }

    const totalWeight = validItems.reduce((sum, x) => sum + x.gram, 0);
    if (totalWeight === 0) return { success: false, error: 'Tổng liều lượng = 0, không thể tính.' };

    // Quy Kinh tổng (tích lũy liều lượng)
    const quyKinhRadar: Record<string, number> = {};
    for (const { d, vt, gram } of validItems) {
      // Ưu tiên quy_kinh của vị thuốc; nếu không có thì dùng quy_kinh trong chi tiết
      const qkStr = vt.quy_kinh || d.quy_kinh || '';
      const kinhList = qkStr.split(/[,;，、]/).map(k => k.trim()).filter(Boolean);
      for (const k of kinhList) {
        quyKinhRadar[k] = (quyKinhRadar[k] || 0) + gram;
      }
    }

    // Normalize Quy Kinh về 0-100
    const maxQK = Math.max(...Object.values(quyKinhRadar), 1);
    const quyKinhNormalized: Record<string, number> = {};
    for (const k in quyKinhRadar) {
      quyKinhNormalized[k] = Math.round((quyKinhRadar[k] / maxQK) * 100);
    }

    // Bước 3: Phân loại Quân - Thần - Tá - Sứ
    const sortedByGram = [...validItems].sort((a, b) => b.gram - a.gram);
    let quanItem = sortedByGram[0];
    const quanQuyKinh = quanItem?.vt?.quy_kinh?.split(/[,;，、]/).map(k => k.trim()) || [];

    const roleMap: Record<number, string> = {};
    for (const item of sortedByGram) {
      const vithuocId = item.vt.id;
      const ten = (item.vt.ten_vi_thuoc || '').toLowerCase();
      const phanTramLieu = item.gram / totalWeight;
      const vtQuyKinh = (item.vt.quy_kinh || '').split(/[,;，、]/).map(k => k.trim());

      if (item === quanItem) {
        roleMap[vithuocId] = 'Quân';
      } else if ((ten === 'cam thảo' || ten === 'đại táo' || ten.includes('cam thảo')) && phanTramLieu < 0.1) {
        roleMap[vithuocId] = 'Sứ';
      } else if (phanTramLieu > 0.15 && vtQuyKinh.some(k => quanQuyKinh.includes(k))) {
        roleMap[vithuocId] = 'Thần';
      } else {
        roleMap[vithuocId] = 'Tá';
      }
    }

    const viThuocList = validItems.map(({ d, vt, gram }) => ({
      id: vt.id,
      ten: vt.ten_vi_thuoc,
      lieu_luong_text: d.lieu_luong,
      lieu_gram: gram,
      quy_kinh: vt.quy_kinh || '',
      vai_tro_phan_tich: roleMap[vt.id] || 'Tá',
      vai_tro_nhap: d.vai_tro || '',
      phan_tram: Math.round((gram / totalWeight) * 100),
    }));

    return {
      success: true,
      ten_bai_thuoc: baiThuoc.ten_bai_thuoc,
      tong_lieu_luong: totalWeight,
      quy_kinh_radar: quyKinhNormalized,
      quy_kinh_raw: quyKinhRadar,
      vi_thuoc_list: viThuocList,
    };
  }
}
