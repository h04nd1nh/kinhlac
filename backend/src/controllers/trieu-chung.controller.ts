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

/** Một triệu chứng khớp trong kết quả chẩn đoán. */
export interface DiagnosisMatchedSymptom {
  id: number;
  ten_trieu_chung: string;
}

/** Một ứng viên (thể bệnh/pháp trị hoặc bệnh Tây Y) trong kết quả chẩn đoán. */
export interface DiagnosisCandidate {
  /** id của pháp trị hoặc bệnh Tây Y. */
  id: number;
  /** Nhãn chính: tên thể bệnh (pháp trị) hoặc tên bệnh (Tây Y). */
  label: string;
  /** Nhãn phụ: pháp trị/nguyên tắc (Đông Y) — null với Tây Y. */
  subLabel: string | null;
  /** Nhóm: tên chủng bệnh (Tây Y) — null với pháp trị. */
  groupLabel: string | null;
  groupId: number | null;
  /** Điểm tương đồng cosine (IDF-weighted) trong khoảng 0..1. */
  score: number;
  /** Phần trăm hiển thị = round(score * 100). */
  percent: number;
  /** Số triệu chứng khớp với đầu vào. */
  matchedCount: number;
  /** Tổng số triệu chứng của ứng viên. */
  total: number;
  matched: DiagnosisMatchedSymptom[];
}

export interface DiagnosisResult {
  /** Các triệu chứng đầu vào hợp lệ (đã có trong DB). */
  input: DiagnosisMatchedSymptom[];
  /** Xếp hạng pháp trị theo thể bệnh (Đông Y) — đã cắt còn tối đa TOP_N. */
  phapTri: DiagnosisCandidate[];
  /** Tổng số pháp trị khớp ≥1 triệu chứng (trước khi cắt TOP_N) — để báo "đang hiển thị X/total". */
  phapTriTotal: number;
  /** Xếp hạng bệnh Tây Y — đã cắt còn tối đa TOP_N. */
  benhTayY: DiagnosisCandidate[];
  /** Tổng số bệnh Tây Y khớp ≥1 triệu chứng (trước khi cắt TOP_N). */
  benhTayYTotal: number;
}

/** Cấu hình tĩnh cho một "kho tri thức" (pháp trị hoặc bệnh Tây Y) khi chấm điểm.
 *  Mọi chuỗi ở đây là hằng số trong mã nguồn — KHÔNG nhận dữ liệu người dùng (an toàn nội suy SQL). */
interface ScoreCorpusConfig {
  junction: string;
  entityIdCol: string;
  entityTable: string;
  labelExpr: string;
  subLabelExpr: string;
  groupIdExpr: string;
  groupLabelExpr: string;
  joinClause: string;
  groupBy: string;
  nameFallback: string;
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

  /**
   * Suy luận chẩn đoán từ một tập triệu chứng đầu vào.
   *
   * Thuật toán: độ tương đồng cosine có trọng số IDF giữa vector triệu chứng
   * bệnh nhân và vector triệu chứng của từng ứng viên.
   *  - Trọng số mỗi triệu chứng w(t) = ln(1 + N / df(t)) với df(t) = số ứng viên
   *    (cùng loại) chứa t, N = tổng ứng viên có ≥1 triệu chứng. Triệu chứng hiếm
   *    (df nhỏ) mang tính đặc hiệu cao → trọng số lớn; triệu chứng phổ biến → nhỏ.
   *  - cosine = (Σ_{t∈S∩Sc} w²) / (‖S‖ · ‖Sc‖) ∈ [0,1]; tự chuẩn hóa theo số triệu
   *    chứng mỗi bên nên không thiên vị ứng viên nhiều/ít triệu chứng.
   *  - Hệ số độ phủ coverage = m/(m+1) với m = số triệu chứng khớp: phạt ứng viên chỉ
   *    khớp rất ít (1 triệu chứng đơn lẻ không vọt lên 100%), thưởng ứng viên được nhiều
   *    triệu chứng cùng củng cố → score = cosine · coverage. Đây mới là độ tin cậy hiển thị.
   *  - Tính độc lập cho 2 kho tri thức: pháp trị (gắn nhãn theo thể bệnh) và bệnh Tây Y.
   *
   * Trả tối đa TOP_N ứng viên mỗi loại (kèm tổng số khớp), chỉ gồm ứng viên khớp ≥1 triệu chứng.
   */
  async diagnose(rawIds: number[]): Promise<DiagnosisResult> {
    const ids = Array.from(
      new Set(
        (Array.isArray(rawIds) ? rawIds : [])
          .map((x) => Number(x))
          .filter((n) => Number.isInteger(n) && n > 0),
      ),
    );
    const empty: DiagnosisResult = {
      input: [],
      phapTri: [],
      phapTriTotal: 0,
      benhTayY: [],
      benhTayYTotal: 0,
    };
    if (ids.length === 0) return empty;

    // Chỉ giữ những triệu chứng thực sự tồn tại (echo lại kèm tên).
    const inputRows: DiagnosisMatchedSymptom[] = await this.repo.query(
      `SELECT id, ten_trieu_chung FROM trieu_chung WHERE id = ANY($1) ORDER BY ten_trieu_chung`,
      [ids],
    );
    if (inputRows.length === 0) return empty;
    const inputIds = inputRows.map((r) => Number(r.id));

    const [phapTri, benhTayY] = await Promise.all([
      this.scoreCandidates(inputIds, {
        junction: 'phap_tri_trieu_chung',
        entityIdCol: 'id_phap_tri',
        entityTable: 'phap_tri',
        labelExpr: 'e.the_benh',
        subLabelExpr: 'e.nguyen_tac',
        groupIdExpr: 'NULL::int',
        groupLabelExpr: 'NULL::text',
        joinClause: '',
        groupBy: 'GROUP BY e.id',
        nameFallback: 'Pháp trị',
      }),
      this.scoreCandidates(inputIds, {
        junction: 'quan_he_benh_trieu_chung',
        entityIdCol: 'id_benh_tay_y',
        entityTable: 'benh_tay_y',
        labelExpr: 'e.ten_benh',
        subLabelExpr: 'NULL::text',
        groupIdExpr: 'cb.id',
        groupLabelExpr: 'cb.ten_chung_benh',
        joinClause: 'LEFT JOIN chung_benh cb ON cb.id = e.id_chung_benh',
        groupBy: 'GROUP BY e.id, cb.id',
        nameFallback: 'Bệnh',
      }),
    ]);

    return {
      input: inputRows,
      phapTri: phapTri.items,
      phapTriTotal: phapTri.total,
      benhTayY: benhTayY.items,
      benhTayYTotal: benhTayY.total,
    };
  }

  /** Số ứng viên tối đa trả về mỗi loại. */
  private static readonly DIAGNOSIS_TOP_N = 20;

  /**
   * Chấm điểm & xếp hạng một kho tri thức cho tập triệu chứng đầu vào.
   * cfg chỉ chứa hằng số trong mã nguồn — inputIds truyền qua tham số hóa ($1).
   */
  private async scoreCandidates(
    inputIds: number[],
    cfg: ScoreCorpusConfig,
  ): Promise<{ items: DiagnosisCandidate[]; total: number }> {
    // df(t) cho MỌI triệu chứng trong junction + N = số ứng viên có ≥1 triệu chứng.
    const dfRows: Array<{ id_trieu_chung: number; df: string }> =
      await this.repo.query(
        `SELECT id_trieu_chung, COUNT(DISTINCT ${cfg.entityIdCol})::text AS df
         FROM ${cfg.junction} GROUP BY id_trieu_chung`,
      );
    const df = new Map<number, number>();
    for (const r of dfRows) df.set(Number(r.id_trieu_chung), Number(r.df));

    const nRows: Array<{ n: string }> = await this.repo.query(
      `SELECT COUNT(DISTINCT ${cfg.entityIdCol})::text AS n FROM ${cfg.junction}`,
    );
    const N = Number(nRows[0]?.n ?? 0);
    if (N === 0) return { items: [], total: 0 };

    const weight = (tid: number): number => {
      const d = df.get(tid) ?? 0;
      if (d <= 0) return 0; // triệu chứng không thuộc kho này → không phân biệt được
      return Math.log(1 + N / d);
    };

    // Chuẩn của vector đầu vào (chỉ tính theo trọng số trong kho này).
    const inputSet = new Set(inputIds);
    let inputNormSq = 0;
    for (const tid of inputIds) {
      const w = weight(tid);
      inputNormSq += w * w;
    }
    const inputNorm = Math.sqrt(inputNormSq);
    if (inputNorm === 0) return { items: [], total: 0 }; // không triệu chứng nào thuộc kho

    // Tập triệu chứng đầy đủ của từng ứng viên — chỉ lấy ứng viên chứa ≥1 triệu chứng đầu vào.
    const candRows: Array<{
      entity_id: number;
      label: string | null;
      sub_label: string | null;
      group_id: number | null;
      group_label: string | null;
      symptom_ids: number[] | null;
      symptom_names: string[] | null;
    }> = await this.repo.query(
      `SELECT e.id AS entity_id,
              ${cfg.labelExpr}      AS label,
              ${cfg.subLabelExpr}   AS sub_label,
              ${cfg.groupIdExpr}    AS group_id,
              ${cfg.groupLabelExpr} AS group_label,
              array_agg(j.id_trieu_chung ORDER BY j.id_trieu_chung)    AS symptom_ids,
              array_agg(tc.ten_trieu_chung ORDER BY j.id_trieu_chung)  AS symptom_names
       FROM ${cfg.entityTable} e
       JOIN ${cfg.junction} j ON j.${cfg.entityIdCol} = e.id
       JOIN trieu_chung tc ON tc.id = j.id_trieu_chung
       ${cfg.joinClause}
       WHERE e.id IN (
         SELECT ${cfg.entityIdCol} FROM ${cfg.junction} WHERE id_trieu_chung = ANY($1)
       )
       ${cfg.groupBy}`,
      [inputIds],
    );

    const out: DiagnosisCandidate[] = [];
    for (const r of candRows) {
      const symIds = (r.symptom_ids ?? []).map(Number);
      const symNames = (r.symptom_names ?? []).map((s) => String(s));
      let candNormSq = 0;
      let dot = 0;
      const matched: DiagnosisMatchedSymptom[] = [];
      for (let i = 0; i < symIds.length; i++) {
        const tid = symIds[i];
        const w = weight(tid);
        candNormSq += w * w;
        if (inputSet.has(tid)) {
          dot += w * w; // hiện diện nhị phân: thành phần 2 vector đều = w
          matched.push({ id: tid, ten_trieu_chung: symNames[i] });
        }
      }
      const candNorm = Math.sqrt(candNormSq);
      if (candNorm === 0 || matched.length === 0) continue;
      const cosine = dot / (inputNorm * candNorm);
      if (cosine <= 0) continue;
      // Độ phủ: phạt ứng viên chỉ khớp ít triệu chứng (1 khớp → ×0.5, 5 khớp → ×0.83…).
      const coverage = matched.length / (matched.length + 1);
      const score = cosine * coverage;

      const label = (r.label ?? '').trim() || `${cfg.nameFallback} #${r.entity_id}`;
      out.push({
        id: Number(r.entity_id),
        label,
        subLabel: r.sub_label ? String(r.sub_label).trim() : null,
        groupLabel: r.group_label ? String(r.group_label).trim() : null,
        groupId: r.group_id != null ? Number(r.group_id) : null,
        score,
        percent: Math.round(score * 100),
        matchedCount: matched.length,
        total: symIds.length,
        matched,
      });
    }

    out.sort(
      (a, b) =>
        b.score - a.score ||
        b.matchedCount - a.matchedCount ||
        a.label.localeCompare(b.label, 'vi'),
    );
    return {
      items: out.slice(0, TrieuChungService.DIAGNOSIS_TOP_N),
      total: out.length,
    };
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
