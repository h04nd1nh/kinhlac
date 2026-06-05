import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import OpenAI from 'openai';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';

import { SeoDoiThu } from '../models/seo-doi-thu.model';
import { SeoUrl } from '../models/seo-url.model';
import { SeoCum } from '../models/seo-cum.model';
import { SeoBaiViet } from '../models/seo-bai-viet.model';
import { renderArticleHtml, renderNotFoundHtml } from './seo-blog.renderer';
import {
  CreateDoiThuDto,
  GenerateDraftDto,
  UpdateBaiVietDto,
} from '../models/seo.dto';

// ---- Cấu hình AI (dùng lại hạ tầng Yescale như ai-suggest) ------------------
const YESCALE_DEFAULT_BASE_URL = 'https://api.yescale.vip/v1';
const YESCALE_DEFAULT_MODEL = 'deepseek-v3.2';

// ---- Giới hạn an toàn (tránh crawl/đốt token quá tay) ----------------------
const FETCH_TIMEOUT_MS = 15000;
const MAX_SITEMAPS = 15; // số sitemap con tối đa đi sâu
const MAX_URLS_PER_CRAWL = 300; // trần URL gom mỗi lần quét
const MAX_PAGE_CHARS = 5000; // cắt bớt text trang đối thủ trước khi đưa cho AI
const MAX_ANALYZE_BATCH = 30;
const GAP_MAX_TOPICS = 120; // trần số chủ đề mỗi bên đưa vào gap analysis

// Bối cảnh ngành của Kinhlac — để AI bóc đúng từ khoá liên quan tới ngách của mình.
const BUSINESS_CONTEXT = `Lĩnh vực kinh doanh của chúng tôi (Kinhlac): Y học cổ truyền / Đông Y, tập trung ngách:
- Đo nhiệt độ kinh lạc / chẩn đoán kinh lạc (phương pháp 24 tỉnh huyệt)
- Huyệt vị, đường kinh, châm cứu (tra cứu + đồ hình 3D)
- Vị thuốc, bài thuốc (tính vị quy kinh), biện chứng luận trị
- Phần mềm số hoá / quản lý phòng khám Đông Y`;

const EXTRACT_SYSTEM_PROMPT = `Bạn là thành viên của một đội ngũ SEO chuyên nghiệp trong lĩnh vực Y học cổ truyền (Đông Y).
Nhiệm vụ: phân tích NỘI DUNG một bài blog của đối thủ (đã được trích sẵn text bên dưới) để giúp team xây chiến lược nội dung & từ khoá.

Hãy xác định:
- chu_de: chủ đề chính của bài blog (1 câu ngắn).
- tu_khoa: 3 từ khoá SEO hàng đầu trong bài, liên quan tới lĩnh vực kinh doanh của chúng tôi. Kết hợp từ khoá dài (long tail) và ngắn (short tail). Từ khoá phải thực sự xuất hiện/đúng trọng tâm bài. Ghi cách nhau bởi dấu phẩy.
- tom_tat: tóm tắt dạng gạch đầu dòng, mỗi dòng một ý phụ khác nhau (bắt đầu bằng "- ", phân tách bằng ký tự xuống dòng \\n). Ngắn gọn.

QUY TẮC:
- Chỉ trả về DUY NHẤT một JSON object: {"chu_de": "...", "tu_khoa": "...", "tom_tat": "- ...\\n- ..."}.
- KHÔNG kèm văn bản giải thích, KHÔNG markdown, KHÔNG \`\`\`.
- Tiếng Việt có dấu, viết hoa chữ cái đầu.
- Nếu nội dung quá mỏng/không rõ, vẫn cố suy luận từ tiêu đề & mô tả; tuyệt đối không bịa số liệu.`;

const GAP_SYSTEM_PROMPT = `Bạn là chuyên gia phân tích SEO ngành Y học cổ truyền (Đông Y).
Nhiệm vụ: phân tích "khoảng trống nội dung" (content gap) giữa ĐỐI THỦ và CHÚNG TÔI, rồi đề xuất các CỤM CHỦ ĐỀ (content cluster) mới nên viết.

Phương pháp:
1. Tìm chủ đề/từ khoá mà đối thủ có nhưng chúng tôi còn thiếu hoặc yếu.
2. Chủ đề càng nhiều đối thủ cùng làm = nhu cầu thị trường càng rõ → ưu tiên cao.
3. Càng liên quan tới ngách lõi (đo kinh lạc, huyệt vị, bài thuốc, số hoá phòng khám đông y) càng tốt.

Mỗi cụm chấm điểm:
- diem_uu_tien: số nguyên 1..15 (tổng hợp: độ phổ biến + độ liên quan + giá trị cho người đọc).
- tu_khoa_muc_tieu: 3-6 từ khoá, cách nhau dấu phẩy.
- y_tuong_noi_dung: 2-4 ý tưởng bài viết cụ thể, cách nhau dấu chấm phẩy.
- ly_do: 1 câu vì sao nên viết cụm này.

QUY TẮC:
- Chỉ trả về DUY NHẤT một JSON object: {"clusters": [ { "ten_cum": "...", "diem_uu_tien": 12, "tu_khoa_muc_tieu": "...", "y_tuong_noi_dung": "...", "ly_do": "..." } ]}.
- Tối đa 10 cụm, sắp xếp diem_uu_tien giảm dần.
- KHÔNG markdown, KHÔNG \`\`\`, KHÔNG văn bản ngoài JSON.
- Tiếng Việt có dấu, thuật ngữ Đông Y chuẩn.`;

const WRITE_SYSTEM_PROMPT = `Bạn là cây bút nội dung Y học cổ truyền (Đông Y) cho website Kinhlac (kinhlac.online) — ngách: đo nhiệt độ kinh lạc, huyệt vị, đường kinh, bài thuốc, số hoá phòng khám Đông Y.

Viết MỘT bài blog chuẩn SEO bằng tiếng Việt theo brief được cung cấp.

YÊU CẦU:
- Độ dài 700–1300 từ. Văn phong gần gũi, dễ hiểu, có chuyên môn, thuyết phục.
- Cấu trúc: 1 đoạn mở bài dẫn dắt → nhiều mục ## (H2) và ### (H3) → đoạn kết ngắn có lời mời hành động nhẹ nhàng.
- TUYỆT ĐỐI KHÔNG viết tiêu đề H1 (#) và KHÔNG kèm phần Câu Hỏi Thường Gặp (FAQ) — hai phần đó được xử lý riêng.
- Chèn từ khoá chính & phụ một cách tự nhiên, KHÔNG nhồi nhét.
- KHÔNG bịa số liệu, liều lượng, phác đồ điều trị hay cam kết "chữa khỏi". Nếu nhắc tới điều trị/châm cứu cụ thể, diễn đạt ở mức tham khảo theo lý luận Đông Y và khuyên gặp thầy thuốc.
- Dùng bảng hoặc gạch đầu dòng khi hợp lý để dễ đọc.

LIÊN KẾT NỘI BỘ (BẮT BUỘC — đây là điểm cốt lõi):
- Chèn 2–4 liên kết Markdown dạng [chữ neo](đường-dẫn) trỏ tới các TRANG TÍNH NĂNG của Kinhlac, đặt tự nhiên ngay trong câu văn (không gom thành một danh sách cuối bài).
- Chữ neo phải đa dạng, mô tả đúng trang đích; KHÔNG dùng "tại đây", "nhấn vào đây".
- Mỗi liên kết một đường dẫn KHÁC nhau. CHỈ được dùng đúng các đường dẫn sau:
  • /xem-ket-qua-do — demo đọc kết quả đo nhiệt độ kinh lạc thành biểu đồ.
  • /xem-3d — đồ hình kinh lạc 3D hơn 1.000 huyệt.
  • /xem-bai-thuoc — phân tích bài thuốc theo tính vị quy kinh (biểu đồ radar).
  • /thu-vien — từ điển tra cứu huyệt vị, kinh mạch, vị thuốc.
  • /app — vào dùng thử phần mềm.
- Ưu tiên các trang liên quan nhất tới chủ đề bài. Mục tiêu: mọi liên kết đều dẫn người đọc về tính năng phần mềm.
- TUYỆT ĐỐI KHÔNG chèn liên kết ra website ngoài trong thân bài (nguồn tham khảo được xử lý riêng ở bước sau).

ĐẦU RA: CHỈ Markdown thuần của thân bài, bắt đầu bằng đoạn mở bài. KHÔNG \`\`\`, KHÔNG JSON, KHÔNG lời mở đầu/giải thích nào khác.`;

const META_SYSTEM_PROMPT = `Bạn là chuyên gia SEO. Đọc bài blog Đông Y đã viết và trả về metadata + phân loại an toàn nội dung.

Trả về DUY NHẤT một JSON object đúng cấu trúc:
{
  "tieu_de": "tiêu đề hấp dẫn, chứa từ khoá chính, không đặt trong ngoặc kép",
  "slug": "slug-khong-dau-4-den-6-tu",
  "meta_description": "140-160 ký tự, chứa từ khoá chính, mời gọi",
  "tu_khoa": ["từ khoá 1", "từ khoá 2", "..."],
  "category": "1 chuyên mục ngắn (vd: Đo Kinh Lạc, Kinh Lạc, Huyệt Vị, Bài Thuốc, Số Hoá Phòng Khám)",
  "cta": "chọn ĐÚNG một trong: /xem-ket-qua-do, /xem-3d, /xem-bai-thuoc, /thu-vien, /app",
  "faq": [{"q": "câu hỏi", "a": "trả lời ngắn gọn"}],
  "nguon_tham_khao": [{"ten": "tên nguồn uy tín", "url": "URL nếu CHẮC CHẮN đúng, không chắc thì bỏ trống"}],
  "do_rui_ro": "an_toan hoặc rui_ro",
  "ly_do_rui_ro": "1 câu giải thích"
}

PHÂN LOẠI do_rui_ro (van an toàn YMYL — y tế):
- "rui_ro": bài CÓ lời khuyên chẩn đoán/điều trị cụ thể, liều lượng, phác đồ, hoặc hứa hẹn chữa khỏi bệnh.
- "an_toan": bài chỉ là kiến thức tra cứu/dữ kiện (định nghĩa, vị trí huyệt, đường kinh, tính vị quy kinh, lý thuyết).

NGUỒN THAM KHẢO (nguon_tham_khao — để tăng độ tin cậy E-E-A-T cho nội dung y tế):
- Đề xuất 2-4 nguồn uy tín phù hợp nội dung bài, ƯU TIÊN nguồn Đông Y/y tế chính thống của Việt Nam, ví dụ:
  Sách "Biện Chứng Luận Trị" của lương y Lê Văn Sửu; "Hải Thượng Y Tông Tâm Lĩnh" của Hải Thượng Lãn Ông; "Hoàng Đế Nội Kinh"; Viện Y học cổ truyền Trung ương; Bệnh viện Y học cổ truyền; Bộ Y tế; Liên hiệp các Hội KH&KT Việt Nam (VUSTA); giáo trình YHCT của các trường Y - Dược.
- TUYỆT ĐỐI KHÔNG BỊA URL. Nếu không chắc chắn URL chính xác, để "url" rỗng và chỉ ghi "ten" (tên sách/cơ quan). Thà thiếu URL còn hơn URL sai/chết.
- Chỉ nêu nguồn thật sự liên quan tới nội dung bài; không liệt kê nguồn cho có.

QUY TẮC: faq có 2-4 câu. slug không dấu, không khoảng trắng (dùng dấu -). KHÔNG markdown, KHÔNG \`\`\`, chỉ JSON.`;

const ALLOWED_CTA = new Set(['/xem-ket-qua-do', '/xem-3d', '/xem-bai-thuoc', '/thu-vien', '/app']);
const BAI_VIET_TRANG_THAI = new Set(['nhap', 'da_duyet', 'bo_qua', 'da_dang']);
const BLOG_AUTHOR = 'Ban Biên Tập Kinh Lạc';

// Checklist kiểm duyệt thủ công (van YMYL nhiều bước). Lưu JSON {yKhoa,seo,nguon,anh}.
// Phải tick ĐỦ 4 mục mới được chuyển bài sang "Đã duyệt"/"Đã đăng".
const KIEM_DUYET_KEYS = ['yKhoa', 'seo', 'nguon', 'anh'] as const;

/** true khi cả 4 mục checklist đều = true. JSON hỏng / thiếu mục → false. */
function isKiemDuyetDu(raw: string | null): boolean {
  if (!raw) return false;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return false;
  }
  return KIEM_DUYET_KEYS.every((k) => o?.[k] === true);
}

// Phase 3: từ khoá gốc của ngách (seed cho Google Suggest) + chu kỳ cron tuần.
const DEFAULT_TREND_SEEDS = [
  'đo kinh lạc',
  'đo nhiệt độ kinh lạc',
  'huyệt',
  'bấm huyệt',
  'kinh lạc',
  'châm cứu',
  'bài thuốc đông y',
  'tính vị quy kinh',
  'huyệt đạo',
  '12 đường kinh',
];
const TREND_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Trần số bài sinh mỗi lần. Mỗi bài = 2 lượt gọi AI (~40s) chạy ĐỒNG BỘ trong 1 request,
// mà nginx cắt sau 120s (frontend/nginx.conf) → giữ ở 2 để không vượt timeout proxy.
const TREND_MAX_DRAFTS = 2;

@Injectable()
export class SeoService implements OnModuleInit {
  /** Cron tuần (opt-in): chỉ bật khi env SEO_TREND_CRON=true. */
  private trendTimer: NodeJS.Timeout | null = null;
  private lastTrendRun = 0;
  private client: OpenAI | null = null;
  private clientKey = '';
  private clientBase = '';

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(SeoDoiThu)
    private readonly doiThuRepo: Repository<SeoDoiThu>,
    @InjectRepository(SeoUrl)
    private readonly urlRepo: Repository<SeoUrl>,
    @InjectRepository(SeoCum)
    private readonly cumRepo: Repository<SeoCum>,
    @InjectRepository(SeoBaiViet)
    private readonly baiVietRepo: Repository<SeoBaiViet>,
  ) {}

  /** Bật cron tuần nếu SEO_TREND_CRON=true (mặc định TẮT — bấm tay trước, tự động sau). */
  onModuleInit(): void {
    if (this.config.get<string>('SEO_TREND_CRON') !== 'true') return;
    // Đợi đủ 1 tuần kể từ lúc boot rồi mới chạy (tránh sinh bài mỗi lần restart).
    this.lastTrendRun = Date.now();
    const CHECK_MS = 6 * 60 * 60 * 1000; // 6h kiểm tra 1 lần
    this.trendTimer = setInterval(() => void this.maybeRunWeekly(), CHECK_MS);
    // eslint-disable-next-line no-console
    console.log('[SEO cron] Đã bật cron tuần tự đăng theo xu hướng (SEO_TREND_CRON=true).');
  }

  private async maybeRunWeekly(): Promise<void> {
    if (Date.now() - this.lastTrendRun < TREND_WEEK_MS) return;
    this.lastTrendRun = Date.now();
    try {
      const cands = await this.discoverTrends();
      const pick = cands.slice(0, 1).map((c) => c.keyword);
      if (pick.length) {
        await this.runTrendDrafts(pick);
        // eslint-disable-next-line no-console
        console.log('[SEO cron] Đã tạo nháp xu hướng:', pick.join(', '));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[SEO cron] lỗi:', e?.message || e);
    }
  }

  // ===========================================================================
  // ĐỐI THỦ
  // ===========================================================================

  /** Danh sách đối thủ kèm số URL theo trạng thái (để hiển thị tiến độ). */
  async listDoiThu() {
    const list = await this.doiThuRepo.find({ order: { created_at: 'ASC' } });
    const counts = await this.urlRepo
      .createQueryBuilder('u')
      .select('u.doi_thu_id', 'doi_thu_id')
      .addSelect('u.trang_thai', 'trang_thai')
      .addSelect('COUNT(*)', 'c')
      .groupBy('u.doi_thu_id')
      .addGroupBy('u.trang_thai')
      .getRawMany<{ doi_thu_id: number; trang_thai: string; c: string }>();

    const byId = new Map<number, { tong: number; cho: number; da_phan_tich: number; loi: number }>();
    for (const r of counts) {
      const id = Number(r.doi_thu_id);
      const entry = byId.get(id) || { tong: 0, cho: 0, da_phan_tich: 0, loi: 0 };
      const n = Number(r.c) || 0;
      entry.tong += n;
      if (r.trang_thai === 'cho') entry.cho += n;
      else if (r.trang_thai === 'da_phan_tich') entry.da_phan_tich += n;
      else if (r.trang_thai === 'loi') entry.loi += n;
      byId.set(id, entry);
    }

    return list.map((d) => ({
      ...d,
      thong_ke: byId.get(d.id) || { tong: 0, cho: 0, da_phan_tich: 0, loi: 0 },
    }));
  }

  async createDoiThu(dto: CreateDoiThuDto): Promise<SeoDoiThu> {
    const domain = normalizeDomain(dto.domain ?? '');
    if (!domain) throw new BadRequestException('Domain không hợp lệ');
    if (!/\.[a-z]{2,}$/i.test(domain)) {
      throw new BadRequestException(`Domain "${domain}" trông không hợp lệ (thiếu phần đuôi như .com, .vn)`);
    }

    const existing = await this.doiThuRepo
      .createQueryBuilder('d')
      .where('lower(d.domain) = :domain', { domain })
      .getOne();
    if (existing) return existing;

    const entity = this.doiThuRepo.create({
      domain,
      ten: dto.ten?.trim() || null,
      la_cua_minh: !!dto.la_cua_minh,
      ghi_chu: dto.ghi_chu?.trim() || null,
    });
    return this.doiThuRepo.save(entity);
  }

  async removeDoiThu(id: number): Promise<void> {
    const d = await this.doiThuRepo.findOneBy({ id });
    if (!d) throw new NotFoundException(`Đối thủ #${id} không tồn tại`);
    await this.doiThuRepo.remove(d); // ON DELETE CASCADE xoá luôn seo_url
  }

  // ===========================================================================
  // CRAWL SITEMAP
  // ===========================================================================

  /** Đọc sitemap của domain → gom URL blog → thêm vào seo_url (bỏ trùng). */
  async crawlSitemap(doiThuId: number): Promise<{ found: number; added: number; domain: string }> {
    const d = await this.doiThuRepo.findOneBy({ id: doiThuId });
    if (!d) throw new NotFoundException(`Đối thủ #${doiThuId} không tồn tại`);

    const urls = await this.collectUrlsFromSitemaps(d.domain);
    if (!urls.length) {
      throw new ServiceUnavailableException(
        `Không tìm thấy URL nào trong sitemap của ${d.domain}. Có thể site chặn bot hoặc không có sitemap.xml.`,
      );
    }

    // Bỏ những URL đã có trong DB (so toàn cục theo cột url).
    const existing = await this.urlRepo
      .createQueryBuilder('u')
      .select('u.url', 'url')
      .where('u.url IN (:...urls)', { urls })
      .getRawMany<{ url: string }>();
    const existingSet = new Set(existing.map((e) => e.url));

    const toInsert = urls
      .filter((u) => !existingSet.has(u))
      .map((u) =>
        this.urlRepo.create({ doi_thu_id: doiThuId, url: u, trang_thai: 'cho' as const }),
      );

    if (toInsert.length) {
      // chunk để tránh câu INSERT quá lớn
      const CHUNK = 100;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        await this.urlRepo.save(toInsert.slice(i, i + CHUNK));
      }
    }

    return { found: urls.length, added: toInsert.length, domain: d.domain };
  }

  // ===========================================================================
  // PHÂN TÍCH 1 URL (tải HTML → đưa text cho Yescale → lưu kết quả)
  // ===========================================================================

  async analyzeUrl(urlId: number): Promise<SeoUrl> {
    const row = await this.urlRepo.findOneBy({ id: urlId });
    if (!row) throw new NotFoundException(`URL #${urlId} không tồn tại`);

    try {
      const html = await fetchTextSafe(row.url);
      if (!html) throw new Error('Không tải được nội dung trang (rỗng hoặc bị chặn).');

      const { title, description, body } = htmlToText(html);
      const pageText = [
        title ? `TIÊU ĐỀ: ${title}` : '',
        description ? `MÔ TẢ: ${description}` : '',
        body ? `NỘI DUNG: ${body.slice(0, MAX_PAGE_CHARS)}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      if (pageText.replace(/\s/g, '').length < 40) {
        throw new Error('Trang gần như không có chữ để phân tích.');
      }

      const result = await this.extractWithAi(row.url, pageText);

      row.chu_de = result.chu_de || null;
      row.tu_khoa = result.tu_khoa || null;
      row.tom_tat = result.tom_tat || null;
      row.trang_thai = 'da_phan_tich';
      row.loi = null;
      row.analyzed_at = new Date();
      return await this.urlRepo.save(row);
    } catch (err: any) {
      row.trang_thai = 'loi';
      row.loi = String(err?.error?.message || err?.message || err).slice(0, 500);
      row.analyzed_at = new Date();
      return await this.urlRepo.save(row);
    }
  }

  /** Phân tích lần lượt N URL đang "chờ" của 1 đối thủ. */
  async analyzeBatch(
    doiThuId: number,
    limit = 10,
  ): Promise<{ analyzed: number; ok: number; loi: number }> {
    const d = await this.doiThuRepo.findOneBy({ id: doiThuId });
    if (!d) throw new NotFoundException(`Đối thủ #${doiThuId} không tồn tại`);

    const take = Math.min(Math.max(1, limit || 10), MAX_ANALYZE_BATCH);
    const pending = await this.urlRepo.find({
      where: { doi_thu_id: doiThuId, trang_thai: 'cho' },
      order: { id: 'ASC' },
      take,
    });

    let ok = 0;
    let loi = 0;
    // Tuần tự để không đập quá nhiều request lên Yescale cùng lúc.
    for (const row of pending) {
      const updated = await this.analyzeUrl(row.id);
      if (updated.trang_thai === 'da_phan_tich') ok++;
      else loi++;
    }
    return { analyzed: pending.length, ok, loi };
  }

  async listUrls(doiThuId?: number, trangThai?: string): Promise<SeoUrl[]> {
    const where: FindOptionsWhere<SeoUrl> = {};
    if (doiThuId) where.doi_thu_id = doiThuId;
    if (trangThai) where.trang_thai = trangThai as SeoUrl['trang_thai'];
    return this.urlRepo.find({
      where,
      order: { trang_thai: 'ASC', id: 'ASC' },
      take: 500,
    });
  }

  async removeUrl(id: number): Promise<void> {
    const row = await this.urlRepo.findOneBy({ id });
    if (!row) throw new NotFoundException(`URL #${id} không tồn tại`);
    await this.urlRepo.remove(row);
  }

  // ===========================================================================
  // GAP ANALYSIS
  // ===========================================================================

  async listCum(): Promise<SeoCum[]> {
    return this.cumRepo.find({ order: { diem_uu_tien: 'DESC', id: 'ASC' } });
  }

  /**
   * So nội dung đối thủ ↔ của mình → AI đề xuất các cụm nên viết. Ghi đè các cụm 'de_xuat' cũ.
   * doiThuId: chỉ so với 1 đối thủ (bỏ trống = gộp tất cả đối thủ).
   */
  async gapAnalysis(doiThuId?: number): Promise<SeoCum[]> {
    const doiThus = await this.doiThuRepo.find();
    const laMinh = new Map(doiThus.map((d) => [d.id, d.la_cua_minh]));

    // Nếu lọc theo 1 đối thủ: phải tồn tại & KHÔNG phải site của mình.
    if (doiThuId) {
      const target = doiThus.find((d) => d.id === doiThuId);
      if (!target) throw new NotFoundException(`Đối thủ #${doiThuId} không tồn tại`);
      if (target.la_cua_minh) {
        throw new BadRequestException(
          'Hãy chọn một ĐỐI THỦ (không phải site của bạn) để tìm khoảng trống.',
        );
      }
    }

    const analyzed = await this.urlRepo.find({ where: { trang_thai: 'da_phan_tich' } });
    if (!analyzed.length) {
      throw new BadRequestException(
        'Chưa có URL nào được phân tích. Hãy quét sitemap và bấm "Phân tích" trước đã.',
      );
    }

    const compTopics: string[] = [];
    const myTopics: string[] = [];
    for (const u of analyzed) {
      const line = `- ${u.chu_de || '(không rõ)'} | từ khoá: ${u.tu_khoa || ''}`;
      if (laMinh.get(u.doi_thu_id)) {
        myTopics.push(line);
      } else if (!doiThuId || u.doi_thu_id === doiThuId) {
        // Đối thủ: nếu đang lọc theo 1 đối thủ thì chỉ lấy đúng đối thủ đó.
        compTopics.push(line);
      }
    }

    if (!compTopics.length) {
      throw new BadRequestException(
        doiThuId
          ? 'Đối thủ này chưa có URL nào được phân tích. Bấm "Phân Tích" cho đối thủ đó (bước 2) trước đã.'
          : 'Chưa có dữ liệu ĐỐI THỦ đã phân tích (mọi URL hiện thuộc site của mình). Thêm domain đối thủ và phân tích trước.',
      );
    }

    const userPrompt = `${BUSINESS_CONTEXT}

== CHỦ ĐỀ ĐỐI THỦ ĐANG LÀM (${Math.min(compTopics.length, GAP_MAX_TOPICS)} mục) ==
${compTopics.slice(0, GAP_MAX_TOPICS).join('\n')}

== CHỦ ĐỀ CHÚNG TÔI ĐÃ CÓ (${Math.min(myTopics.length, GAP_MAX_TOPICS)} mục) ==
${myTopics.length ? myTopics.slice(0, GAP_MAX_TOPICS).join('\n') : '(chưa có bài nào — coi như đang trống)'}

Hãy đề xuất các cụm chủ đề nên viết theo đúng định dạng JSON đã quy định.`;

    const parsed = await this.chatJson(GAP_SYSTEM_PROMPT, userPrompt, 2500);
    const clustersRaw = Array.isArray((parsed as any)?.clusters)
      ? (parsed as any).clusters
      : Array.isArray(parsed)
        ? (parsed as any)
        : [];

    if (!clustersRaw.length) {
      throw new ServiceUnavailableException('AI không trả về cụm nào hợp lệ. Thử lại sau.');
    }

    // Ghi đè các cụm 'de_xuat' CŨ CỦA ĐÚNG đối thủ này (giữ cụm đã viết & cụm của đối thủ khác).
    await this.cumRepo.delete({ trang_thai: 'de_xuat', doi_thu_id: doiThuId ?? IsNull() });

    const entities = clustersRaw
      .filter((c: any) => c && typeof c === 'object' && (c.ten_cum || c.cluster_name))
      .slice(0, 10)
      .map((c: any) =>
        this.cumRepo.create({
          ten_cum: String(c.ten_cum || c.cluster_name).trim().slice(0, 255),
          diem_uu_tien: clampInt(c.diem_uu_tien ?? c.priority_score, 0, 15),
          tu_khoa_muc_tieu: toCommaText(c.tu_khoa_muc_tieu ?? c.target_keywords),
          y_tuong_noi_dung: toSemicolonText(c.y_tuong_noi_dung ?? c.content_opportunities),
          ly_do: c.ly_do ? String(c.ly_do).trim() : null,
          doi_thu_id: doiThuId ?? null,
          trang_thai: 'de_xuat' as const,
        }),
      );

    await this.cumRepo.save(entities);
    return this.listCum();
  }

  // ===========================================================================
  // AI helpers (Yescale, OpenAI-compatible)
  // ===========================================================================

  private getClient(): OpenAI {
    const apiKey = this.config.get<string>('YESCALE_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('Chưa cấu hình YESCALE_API_KEY');
    }
    const baseURL =
      this.config.get<string>('YESCALE_BASE_URL') || YESCALE_DEFAULT_BASE_URL;
    if (!this.client || this.clientKey !== apiKey || this.clientBase !== baseURL) {
      this.client = new OpenAI({ apiKey, baseURL });
      this.clientKey = apiKey;
      this.clientBase = baseURL;
    }
    return this.client;
  }

  private async chatJson(
    system: string,
    user: string,
    maxTokens: number,
  ): Promise<Record<string, unknown> | unknown[]> {
    const client = this.getClient();
    const model = this.config.get<string>('YESCALE_MODEL') || YESCALE_DEFAULT_MODEL;

    let response;
    try {
      response = await client.chat.completions.create({
        model,
        temperature: 0.3,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
    } catch (err: any) {
      const status = typeof err?.status === 'number' ? err.status : 503;
      const detail = err?.error?.message || err?.message || String(err);
      throw new HttpException(`yescale lỗi: ${detail}`, status);
    }

    const content = response.choices?.[0]?.message?.content?.trim() ?? '';
    if (!content) throw new ServiceUnavailableException('yescale trả về nội dung rỗng');
    const parsed = parseJsonLoose(content);
    if (!parsed) {
      throw new ServiceUnavailableException(
        `Không parse được JSON từ AI: ${content.slice(0, 200)}`,
      );
    }
    return parsed;
  }

  private async extractWithAi(
    url: string,
    pageText: string,
  ): Promise<{ chu_de: string; tu_khoa: string; tom_tat: string }> {
    const user = `${BUSINESS_CONTEXT}

URL bài blog đối thủ: ${url}

NỘI DUNG ĐÃ TRÍCH:
"""
${pageText}
"""

Trả về JSON {chu_de, tu_khoa, tom_tat} theo đúng quy tắc.`;

    const parsed = (await this.chatJson(EXTRACT_SYSTEM_PROMPT, user, 800)) as Record<string, unknown>;
    return {
      chu_de: pickString(parsed, 'chu_de'),
      tu_khoa: pickString(parsed, 'tu_khoa'),
      tom_tat: pickString(parsed, 'tom_tat'),
    };
  }

  // ===========================================================================
  // Sitemap crawler
  // ===========================================================================

  private async getSitemapCandidates(domain: string): Promise<string[]> {
    const candidates = new Set<string>();
    const robots = await fetchTextSafe(`https://${domain}/robots.txt`);
    if (robots) {
      const re = /^\s*sitemap:\s*(\S+)/gim;
      let m: RegExpExecArray | null;
      while ((m = re.exec(robots))) candidates.add(m[1].trim());
    }
    candidates.add(`https://${domain}/sitemap.xml`);
    candidates.add(`https://${domain}/sitemap_index.xml`);
    return [...candidates];
  }

  private async collectUrlsFromSitemaps(domain: string): Promise<string[]> {
    const seen = new Set<string>();
    const pageUrls = new Set<string>();
    const queue = await this.getSitemapCandidates(domain);
    let fetched = 0;

    while (queue.length && fetched < MAX_SITEMAPS && pageUrls.size < MAX_URLS_PER_CRAWL) {
      const sm = queue.shift()!;
      if (seen.has(sm)) continue;
      seen.add(sm);
      if (/\.gz($|\?)/i.test(sm)) continue; // bỏ qua sitemap nén (Phase 1 chưa giải nén)

      const xml = await fetchTextSafe(sm);
      fetched++;
      if (!xml) continue;

      const locs = extractLocs(xml);
      const isIndex = /<sitemapindex[\s>]/i.test(xml);
      if (isIndex) {
        for (const loc of locs) if (!seen.has(loc)) queue.push(loc);
      } else {
        for (const loc of locs) {
          if (isContentUrl(loc, domain)) pageUrls.add(loc);
          if (pageUrls.size >= MAX_URLS_PER_CRAWL) break;
        }
      }
    }
    return [...pageUrls];
  }

  // ===========================================================================
  // PHASE 2: LÒ VIẾT BÀI (sinh nháp blog → van YMYL → xuất .md)
  // ===========================================================================

  async listBaiViet(): Promise<SeoBaiViet[]> {
    return this.baiVietRepo.find({ order: { updated_at: 'DESC' } });
  }

  async getBaiViet(id: number): Promise<SeoBaiViet> {
    const a = await this.baiVietRepo.findOneBy({ id });
    if (!a) throw new NotFoundException(`Bài viết #${id} không tồn tại`);
    return a;
  }

  /** Sinh bản nháp blog từ 1 cụm (cum_id) hoặc từ chủ đề tự nhập. 2 bước: viết thân bài → bóc metadata + phân loại rủi ro. */
  async generateDraft(dto: GenerateDraftDto): Promise<SeoBaiViet> {
    let chuDe = (dto.chu_de || '').trim();
    let tuKhoa = (dto.tu_khoa || '').trim();
    let yTuong = '';
    let cumId: number | null = null;

    if (dto.cum_id) {
      const cum = await this.cumRepo.findOneBy({ id: dto.cum_id });
      if (!cum) throw new NotFoundException(`Cụm #${dto.cum_id} không tồn tại`);
      cumId = cum.id;
      chuDe = chuDe || cum.ten_cum;
      tuKhoa = tuKhoa || cum.tu_khoa_muc_tieu || '';
      yTuong = cum.y_tuong_noi_dung || '';
    }
    if (!chuDe) {
      throw new BadRequestException('Thiếu chủ đề — chọn 1 cụm hoặc nhập chủ đề.');
    }

    const brief = [
      `Chủ đề/cụm: ${chuDe}`,
      `Từ khoá mục tiêu: ${tuKhoa || '(tự chọn cho phù hợp)'}`,
      yTuong ? `Gợi ý nội dung: ${yTuong}` : '',
      '',
      BUSINESS_CONTEXT,
    ]
      .filter(Boolean)
      .join('\n');

    // Bước 1: viết thân bài (markdown thuần). Lọc link ngoài để AI không bịa URL (chỉ giữ link nội bộ).
    const rawBody = await this.chatText(WRITE_SYSTEM_PROMPT, `Viết bài theo brief sau:\n\n${brief}`, 3500);
    const noiDung = sanitizeBodyLinks(stripLeadingH1(rawBody));
    if (noiDung.replace(/\s/g, '').length < 80) {
      throw new ServiceUnavailableException('AI trả về bài quá ngắn. Thử lại.');
    }

    // Bước 2: bóc metadata + phân loại rủi ro (JSON).
    const metaUser = `Brief:\n${brief}\n\nBÀI ĐÃ VIẾT:\n"""\n${noiDung.slice(0, 8000)}\n"""\n\nTrả về JSON metadata theo đúng quy tắc.`;
    const meta = (await this.chatJson(META_SYSTEM_PROMPT, metaUser, 1200)) as Record<string, unknown>;

    const tieuDe = (pickString(meta, 'tieu_de') || chuDe).slice(0, 500);
    const slug = slugify(pickString(meta, 'slug') || tieuDe);
    const rui: SeoBaiViet['do_rui_ro'] =
      pickString(meta, 'do_rui_ro') === 'rui_ro' ? 'rui_ro' : 'an_toan';

    const entity = this.baiVietRepo.create({
      cum_id: cumId,
      tieu_de: tieuDe,
      slug,
      meta_description: pickString(meta, 'meta_description') || null,
      tu_khoa: toCommaText(meta['tu_khoa']) || tuKhoa || null,
      category: pickString(meta, 'category') || null,
      cta: normalizeCta(pickString(meta, 'cta')),
      faq: normalizeFaqJson(meta['faq']),
      nguon_tham_khao: normalizeSourcesJson(meta['nguon_tham_khao']),
      noi_dung_md: noiDung,
      do_rui_ro: rui,
      ly_do_rui_ro: pickString(meta, 'ly_do_rui_ro') || null,
      trang_thai: 'nhap',
    });
    const saved = await this.baiVietRepo.save(entity);

    if (cumId) {
      // Đánh dấu cụm đã được viết để khỏi trùng.
      await this.cumRepo.update({ id: cumId }, { trang_thai: 'da_viet' });
    }
    return saved;
  }

  async updateBaiViet(id: number, dto: UpdateBaiVietDto): Promise<SeoBaiViet> {
    const a = await this.getBaiViet(id);
    if (dto.tieu_de !== undefined) a.tieu_de = dto.tieu_de.slice(0, 500);
    if (dto.slug !== undefined) a.slug = slugify(dto.slug);
    if (dto.meta_description !== undefined) a.meta_description = dto.meta_description || null;
    if (dto.tu_khoa !== undefined) a.tu_khoa = dto.tu_khoa || null;
    if (dto.category !== undefined) a.category = dto.category || null;
    if (dto.cta !== undefined) a.cta = normalizeCta(dto.cta);
    if (dto.faq !== undefined) a.faq = dto.faq || null;
    if (dto.nguon_tham_khao !== undefined) a.nguon_tham_khao = dto.nguon_tham_khao || null;
    if (dto.noi_dung_md !== undefined) a.noi_dung_md = dto.noi_dung_md;
    if (dto.kiem_duyet !== undefined) a.kiem_duyet = dto.kiem_duyet || null;
    if (dto.trang_thai !== undefined && BAI_VIET_TRANG_THAI.has(dto.trang_thai)) {
      // Van YMYL: chỉ chặn LÚC NÂNG CẤP từ chưa-duyệt → "Đã duyệt"/"Đã đăng" (bài cũ đã đăng vẫn lưu lại được).
      const prev = a.trang_thai;
      const dangNangCap =
        (dto.trang_thai === 'da_duyet' || dto.trang_thai === 'da_dang') &&
        prev !== 'da_duyet' &&
        prev !== 'da_dang';
      if (dangNangCap && !isKiemDuyetDu(a.kiem_duyet)) {
        throw new BadRequestException(
          'Chưa đủ checklist kiểm duyệt (Y khoa · SEO · Nguồn · Ảnh) — tick đủ 4 mục mới chuyển sang "Đã duyệt".',
        );
      }
      a.trang_thai = dto.trang_thai;
    }
    return this.baiVietRepo.save(a);
  }

  async removeBaiViet(id: number): Promise<void> {
    const a = await this.getBaiViet(id);
    await this.baiVietRepo.remove(a);
  }

  /** Dựng object JSON đúng "hợp đồng" publish-article.mjs (xem frontend/content/README.md). */
  private buildArticleJson(a: SeoBaiViet): Record<string, unknown> & { slug: string } {
    const slug = slugify(a.slug || a.tieu_de || `bai-${a.id}`);
    const keywords = (a.tu_khoa || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    let faqArr: { q: string; a: string }[] = [];
    try {
      faqArr = a.faq ? JSON.parse(a.faq) : [];
    } catch {
      faqArr = [];
    }
    let sourcesArr: ({ title: string; url?: string } | string)[] = [];
    try {
      sourcesArr = a.nguon_tham_khao ? JSON.parse(a.nguon_tham_khao) : [];
    } catch {
      sourcesArr = [];
    }
    const ready = a.trang_thai === 'da_duyet' || a.trang_thai === 'da_dang';
    const model = this.config.get<string>('YESCALE_MODEL') || YESCALE_DEFAULT_MODEL;

    // undefined → JSON.stringify bỏ qua (thiếu field = dùng mặc định của bridge).
    return {
      slug,
      title: a.tieu_de || '',
      description: a.meta_description || '',
      author: BLOG_AUTHOR,
      category: a.category || undefined,
      cta: a.cta || undefined,
      image: pickCoverImage(slug, a.tieu_de || '', a.tu_khoa || ''), // ảnh bìa = sơ đồ đường kinh KHỚP chủ đề
      keywords: keywords.length ? keywords : undefined,
      faq: faqArr.length ? faqArr : undefined,
      sources: sourcesArr.length ? sourcesArr : undefined,
      index: ready ? undefined : false, // chưa duyệt → noindex/chờ duyệt (van YMYL)
      seoCumId: a.cum_id ?? undefined,
      aiModel: `Yescale ${model}`,
      body: a.noi_dung_md || '',
    };
  }

  /** Xuất 1 bài thành JSON để tải về (đăng thủ công qua publish-article.mjs). */
  async exportArticle(id: number): Promise<{ filename: string; content: string }> {
    const a = await this.getBaiViet(id);
    const article = this.buildArticleJson(a);
    return { filename: `${article.slug}.json`, content: JSON.stringify(article, null, 2) };
  }

  /**
   * "Đăng": tự ghi file content/blog/<slug>.md (qua publish-article.mjs) rồi chuyển trạng thái 'da_dang'.
   * CHỈ chạy trên máy có mã nguồn frontend (máy đang code). Lên web thật vẫn cần build lại + deploy.
   */
  async publishArticle(
    id: number,
  ): Promise<{ slug: string; trang_thai: string; wrote: boolean; note: string }> {
    const a = await this.getBaiViet(id);
    if (a.trang_thai !== 'da_duyet' && a.trang_thai !== 'da_dang') {
      throw new BadRequestException(
        'Hãy đổi trạng thái bài sang "Đã duyệt" rồi mới Đăng (van an toàn YMYL).',
      );
    }
    const article = this.buildArticleJson(a);
    const scriptPath =
      this.config.get<string>('PUBLISH_SCRIPT_PATH') ||
      pathResolve(process.cwd(), '..', 'frontend', 'scripts', 'publish-article.mjs');

    // Có mã nguồn frontend (máy local) → ghi file luôn. Không có (container VPS) → chỉ đánh dấu, đăng khi deploy.
    const wrote = existsSync(scriptPath);
    if (wrote) {
      await runPublishScript(scriptPath, article);
    }
    a.trang_thai = 'da_dang';
    await this.baiVietRepo.save(a);

    // Báo IndexNow NGAY khi đăng (bài hiển thị tức thì qua render động) — nhưng CHỈ khi bài thật sự
    // được index (an toàn, hoặc rủi ro đã tick đủ checklist). Fire-and-forget: không chặn phản hồi.
    if (a.do_rui_ro !== 'rui_ro' || isKiemDuyetDu(a.kiem_duyet)) {
      void this.pingIndexNow(article.slug);
    }

    return {
      slug: article.slug,
      trang_thai: a.trang_thai,
      wrote,
      note: wrote
        ? `Đã ghi frontend/content/blog/${article.slug}.md. Bài xem được ngay; bản tĩnh chuẩn SEO sẽ thay thế ở lần build/deploy tới.`
        : 'Đã đăng. Bài XEM ĐƯỢC NGAY trên web (backend tự render từ dữ liệu); bản tĩnh chuẩn SEO sẽ thay thế ở lần deploy/build tới.',
    };
  }

  /**
   * Báo URL bài mới cho IndexNow (Bing, Cốc Cốc, Yandex, Seznam, Naver) → index gần như tức thì.
   * Google KHÔNG dùng IndexNow (Google đi qua sitemap.xml + GSC); Cốc Cốc CÓ → quan trọng cho VN.
   * Chỉ chạy khi có env INDEXNOW_KEY (khoá phải khớp file public/<key>.txt đã deploy). Thiếu → bỏ qua êm.
   * SITE_DOMAIN ghi đè domain (mặc định https://kinhlac.online).
   */
  private async pingIndexNow(slug: string): Promise<void> {
    const key = this.config.get<string>('INDEXNOW_KEY');
    if (!key) return; // chưa cấu hình khoá → bỏ qua, không báo lỗi
    const domain = (this.config.get<string>('SITE_DOMAIN') || 'https://kinhlac.online').replace(
      /\/+$/,
      '',
    );
    try {
      const payload = {
        host: new URL(domain).host,
        key,
        keyLocation: `${domain}/${key}.txt`,
        urlList: [`${domain}/blog/${slug}/`],
      };
      await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      });
    } catch {
      // IndexNow chỉ là "điểm cộng" — tuyệt đối không để nó làm hỏng việc đăng bài.
    }
  }

  // ===========================================================================
  // ẢNH MINH HOẠ AI cho thân bài (chèn 1 ảnh dưới mỗi mục ## H2 chưa có ảnh)
  // ===========================================================================

  /**
   * Sinh ảnh minh hoạ bằng AI cho các mục H2 chưa có ảnh → lưu frontend/public/blog-images/<slug>/
   * rồi chèn Markdown ![..](..) vào thân bài. CHỈ chạy trên MÁY CÓ MÃ NGUỒN frontend.
   * Cần env YESCALE_IMAGE_MODEL (model hỗ trợ tạo ảnh) + tài khoản Yescale còn credit ảnh.
   */
  async generateBodyImages(id: number, max = 4): Promise<{ bai: SeoBaiViet; added: number }> {
    const a = await this.getBaiViet(id);
    const slug = slugify(a.slug || a.tieu_de || `bai-${a.id}`);

    const baseDir =
      this.config.get<string>('BLOG_IMAGES_DIR') ||
      pathResolve(process.cwd(), '..', 'frontend', 'public', 'blog-images');
    if (!existsSync(pathResolve(baseDir, '..'))) {
      throw new ServiceUnavailableException(
        'Không thấy thư mục frontend/public — "Sinh ảnh minh hoạ" chỉ chạy trên MÁY CÓ MÃ NGUỒN frontend.',
      );
    }
    const outDir = pathResolve(baseDir, slug);
    mkdirSync(outDir, { recursive: true });

    const lines = (a.noi_dung_md || '').split('\n');
    const cap = Math.min(Math.max(1, max || 4), 6);
    const out: string[] = [];
    let added = 0;
    for (let i = 0; i < lines.length; i++) {
      out.push(lines[i]);
      const h = lines[i].match(/^##\s+(.+?)\s*$/); // chỉ H2 (## ...), bỏ qua ### trở lên
      if (!h || added >= cap) continue;
      if (/^!\[/.test((lines[i + 1] || '').trim())) continue; // đã có ảnh ngay dưới → bỏ qua
      const heading = h[1].replace(/[*_`#]/g, '').trim();
      const { buf, ext } = await this.genImageBuffer(buildImagePrompt(a.tieu_de || slug, heading));
      const fname = `sec-${added + 1}.${ext}`;
      writeFileSync(pathResolve(outDir, fname), buf);
      out.push('', `![${heading}](/blog-images/${slug}/${fname})`);
      added++;
    }
    if (!added) {
      throw new BadRequestException(
        'Không có mục ## (H2) nào để chèn ảnh (hoặc các mục đã có ảnh sẵn). Thêm tiêu đề ## trong bài rồi thử lại.',
      );
    }
    a.noi_dung_md = out.join('\n');
    const bai = await this.baiVietRepo.save(a);
    return { bai, added };
  }

  /**
   * Sinh ẢNH CHO MỘT mục H2 chưa có ảnh ĐẦU TIÊN (để frontend gọi lặp → tiến trình thật từng ảnh).
   * remaining = số mục H2 còn lại chưa có ảnh (sau lần này). heading=null nghĩa là không còn gì để vẽ.
   */
  async generateOneBodyImage(
    id: number,
  ): Promise<{ bai: SeoBaiViet; heading: string | null; remaining: number }> {
    const a = await this.getBaiViet(id);
    const slug = slugify(a.slug || a.tieu_de || `bai-${a.id}`);
    const baseDir =
      this.config.get<string>('BLOG_IMAGES_DIR') ||
      pathResolve(process.cwd(), '..', 'frontend', 'public', 'blog-images');
    if (!existsSync(pathResolve(baseDir, '..'))) {
      throw new ServiceUnavailableException(
        'Không thấy thư mục frontend/public — "Sinh ảnh minh hoạ" chỉ chạy trên MÁY CÓ MÃ NGUỒN frontend.',
      );
    }

    const lines = (a.noi_dung_md || '').split('\n');
    const targets: { i: number; heading: string }[] = [];
    for (let i = 0; i < lines.length; i++) {
      const h = lines[i].match(/^##\s+(.+?)\s*$/); // chỉ H2
      if (h && !/^!\[/.test((lines[i + 1] || '').trim())) {
        targets.push({ i, heading: h[1].replace(/[*_`#]/g, '').trim() });
      }
    }
    if (!targets.length) return { bai: a, heading: null, remaining: 0 };

    const t = targets[0];
    const outDir = pathResolve(baseDir, slug);
    mkdirSync(outDir, { recursive: true });
    // số thứ tự ảnh = số ảnh đã chèn cho bài này + 1 (không ghi đè ảnh cũ).
    const used = (a.noi_dung_md || '').match(new RegExp(`/blog-images/${slug}/sec-`, 'g'))?.length || 0;
    const { buf, ext } = await this.genImageBuffer(buildImagePrompt(a.tieu_de || slug, t.heading));
    const fname = `sec-${used + 1}.${ext}`;
    writeFileSync(pathResolve(outDir, fname), buf);

    lines.splice(t.i + 1, 0, '', `![${t.heading}](/blog-images/${slug}/${fname})`);
    a.noi_dung_md = lines.join('\n');
    const bai = await this.baiVietRepo.save(a);
    return { bai, heading: t.heading, remaining: targets.length - 1 };
  }

  /** Tách danh sách model từ chuỗi env "a,b,c" → mảng (bỏ trùng/rỗng); rỗng thì dùng fallback. */
  private parseModels(raw: string | undefined, fallback: string[]): string[] {
    const list = (raw || '').split(',').map((s) => s.trim()).filter(Boolean);
    return list.length ? [...new Set(list)] : fallback;
  }

  /**
   * Tạo 1 ảnh → Buffer với CHUỖI DỰ PHÒNG NHIỀU DỊCH VỤ: thử lần lượt, cái nào bận/lỗi thì NHẢY sang
   * cái kế → luôn ra được ảnh, không để "model bận = tịt". Thứ tự:
   *   1) Nhà CHÍNH (Yescale): IMAGE_API_* | YESCALE_* — lần lượt các model trong YESCALE_IMAGE_MODELS.
   *   2) Nhà PHỤ (tuỳ chọn, vd Together.ai FLUX free): IMAGE_API_BASE2 / IMAGE_API_KEY2 / IMAGE_MODELS2.
   *   3) Pollinations (free, cần POLLINATIONS_TOKEN) — chốt chặn cuối.
   * IMAGE_PROVIDER='pollinations' → đưa Pollinations lên ĐẦU; còn lại giữ thứ tự trên.
   */
  private async genImageBuffer(prompt: string): Promise<{ buf: Buffer; ext: string }> {
    const provider = (this.config.get<string>('IMAGE_PROVIDER') || '').toLowerCase();
    const compat: { label: string; run: () => Promise<{ buf: Buffer; ext: string }> }[] = [];

    // 1) Nhà CHÍNH (Yescale / OpenAI-compatible)
    const base1 = (
      this.config.get<string>('IMAGE_API_BASE') ||
      this.config.get<string>('YESCALE_BASE_URL') ||
      'https://api.yescale.vip/v1'
    ).replace(/\/$/, '');
    const key1 =
      this.config.get<string>('IMAGE_API_KEY') || this.config.get<string>('YESCALE_API_KEY') || '';
    if (key1) {
      const models1 = this.parseModels(
        this.config.get<string>('YESCALE_IMAGE_MODELS') || this.config.get<string>('IMAGE_MODELS'),
        [
          this.config.get<string>('IMAGE_MODEL') ||
            this.config.get<string>('YESCALE_IMAGE_MODEL') ||
            'dall-e-3',
        ],
      );
      for (const m of models1)
        compat.push({ label: `chính "${m}"`, run: () => this.genImageOpenAICompat(prompt, base1, key1, m) });
    }

    // 2) Nhà PHỤ (tuỳ chọn) — dịch vụ ảnh ĐỘC LẬP, key riêng (vd Together.ai FLUX free)
    const base2 = (this.config.get<string>('IMAGE_API_BASE2') || '').replace(/\/$/, '');
    const key2 = this.config.get<string>('IMAGE_API_KEY2') || '';
    if (base2 && key2) {
      const models2 = this.parseModels(this.config.get<string>('IMAGE_MODELS2'), [
        'black-forest-labs/FLUX.1-schnell-Free',
      ]);
      for (const m of models2)
        compat.push({ label: `phụ "${m}"`, run: () => this.genImageOpenAICompat(prompt, base2, key2, m) });
    }

    // Hugging Face (free, KHÔNG cần thẻ): bật khi có HF_API_KEY / HUGGINGFACE_TOKEN.
    const hf =
      this.config.get<string>('HF_API_KEY') || this.config.get<string>('HUGGINGFACE_TOKEN')
        ? [{ label: 'Hugging Face (free)', run: () => this.genImageHuggingFace(prompt) }]
        : [];
    const poll = { label: 'Pollinations (free)', run: () => this.genImagePollinations(prompt) };
    const attempts =
      provider === 'pollinations' ? [poll, ...compat, ...hf] : [...compat, ...hf, poll];

    const errors: string[] = [];
    for (const at of attempts) {
      try {
        return await at.run();
      } catch (e: any) {
        const msg = (e?.error?.message || e?.message || String(e)).slice(0, 140);
        errors.push(`${at.label}: ${msg}`);
        // eslint-disable-next-line no-console
        console.warn(`[SEO ảnh] ${at.label} lỗi → thử nguồn kế. (${msg})`);
      }
    }
    throw new ServiceUnavailableException(
      `Tất cả ${attempts.length} nguồn ảnh đều bận/không dùng được. Đã thử:\n- ` +
        errors.join('\n- ') +
        `\nMẹo (đều MIỄN PHÍ, KHÔNG cần thẻ): HF_API_KEY (Hugging Face) hoặc POLLINATIONS_TOKEN ` +
        `(auth.pollinations.ai); hoặc nhà OpenAI-compat thứ 2 IMAGE_API_BASE2/IMAGE_API_KEY2/IMAGE_MODELS2.`,
    );
  }

  /** Pollinations.ai — free, NAY cần POLLINATIONS_TOKEN (đăng ký miễn phí). Trả thẳng bytes ảnh. */
  private async genImagePollinations(prompt: string): Promise<{ buf: Buffer; ext: string }> {
    const model = this.config.get<string>('POLLINATIONS_MODEL') || 'flux';
    const token = this.config.get<string>('POLLINATIONS_TOKEN') || '';
    const seed = hashStr(prompt) % 1_000_000; // seed theo prompt → mỗi mục 1 ảnh khác
    let url =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
      `?width=1024&height=1024&nologo=true&model=${encodeURIComponent(model)}&seed=${seed}`;
    if (token) url += `&token=${encodeURIComponent(token)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000); // ảnh free có thể chậm
    try {
      const r = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'KinhlacSEOBot/1.0 (+https://kinhlac.online)',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (r.status === 401 || r.status === 402) {
        throw new ServiceUnavailableException(
          'Pollinations nay cần đăng ký: lấy TOKEN MIỄN PHÍ ở auth.pollinations.ai rồi đặt POLLINATIONS_TOKEN trong backend/.env (hoặc đổi IMAGE_PROVIDER sang together/openai).',
        );
      }
      if (!r.ok) throw new ServiceUnavailableException(`Pollinations lỗi HTTP ${r.status}. Thử lại sau.`);
      const ct = r.headers.get('content-type') || '';
      const ab = await r.arrayBuffer();
      if (!ct.startsWith('image/') || ab.byteLength < 1000) {
        throw new ServiceUnavailableException('Pollinations chưa trả về ảnh hợp lệ (đang bận). Thử lại sau.');
      }
      return { buf: Buffer.from(ab), ext: ct.includes('png') ? 'png' : 'jpg' };
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new ServiceUnavailableException(`Pollinations lỗi: ${e?.message || e}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Hugging Face Inference API — token MIỄN PHÍ, KHÔNG cần thẻ (huggingface.co → Settings → Access Tokens).
   * Trả thẳng bytes ảnh. Mặc định model FLUX.1-schnell; đổi qua HF_IMAGE_MODEL.
   */
  private async genImageHuggingFace(prompt: string): Promise<{ buf: Buffer; ext: string }> {
    const token =
      this.config.get<string>('HF_API_KEY') || this.config.get<string>('HUGGINGFACE_TOKEN') || '';
    if (!token) throw new ServiceUnavailableException('Thiếu HF_API_KEY cho Hugging Face.');
    const model = this.config.get<string>('HF_IMAGE_MODEL') || 'black-forest-labs/FLUX.1-schnell';
    const base = (
      this.config.get<string>('HF_API_BASE') || 'https://api-inference.huggingface.co'
    ).replace(/\/$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const r = await fetch(`${base}/models/${model}`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'image/png',
        },
        body: JSON.stringify({ inputs: prompt }),
      });
      if (!r.ok) {
        // 503 = model đang "nguội"/tải lại; chuỗi sẽ thử nguồn kế (hoặc bạn bấm lại sau).
        throw new ServiceUnavailableException(
          `Hugging Face lỗi (model "${model}"): HTTP ${r.status} ${(await r.text()).slice(0, 160)}`,
        );
      }
      const ct = r.headers.get('content-type') || '';
      const ab = await r.arrayBuffer();
      if (!ct.startsWith('image/') || ab.byteLength < 1000) {
        throw new ServiceUnavailableException('Hugging Face chưa trả về ảnh hợp lệ (model đang tải/bận). Thử lại sau.');
      }
      return { buf: Buffer.from(ab), ext: ct.includes('png') ? 'png' : 'jpg' };
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new ServiceUnavailableException(`Hugging Face lỗi: ${e?.message || e}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * OpenAI-compatible /images/generations cho 1 (base, key, model) cụ thể — dùng cho Yescale,
   * Together.ai (FLUX.1-schnell-Free MIỄN PHÍ), OpenAI… base/key do genImageBuffer truyền theo từng nhà.
   */
  private async genImageOpenAICompat(
    prompt: string,
    base: string,
    key: string,
    model: string,
  ): Promise<{ buf: Buffer; ext: string }> {
    const size = this.config.get<string>('IMAGE_SIZE') || '1024x1024';
    if (!key) {
      throw new ServiceUnavailableException('Thiếu API key cho nhà cung cấp ảnh OpenAI-compatible.');
    }
    // Giới hạn thời gian mỗi model để 1 model treo không "ăn" hết budget của cả chuỗi dự phòng.
    const post = (body: Record<string, unknown>) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 40_000);
      return fetch(`${base}/images/generations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
    };
    let r = await post({ model, prompt, n: 1, size, response_format: 'b64_json' });
    if (r.status === 400) r = await post({ model, prompt, n: 1, size }); // chỉ thử lại khi model chê tham số (KHÔNG gọi đôi khi 503)
    if (!r.ok) {
      throw new ServiceUnavailableException(
        `Sinh ảnh lỗi (model "${model}" @ ${base}): HTTP ${r.status} ${(await r.text()).slice(0, 160)}`,
      );
    }
    const data: any = await r.json();
    const d: any = data?.data?.[0];
    if (d?.b64_json) return { buf: Buffer.from(d.b64_json, 'base64'), ext: 'png' };
    if (d?.url) {
      const ir = await fetch(d.url);
      if (!ir.ok) throw new ServiceUnavailableException('Tải ảnh AI về thất bại.');
      return { buf: Buffer.from(await ir.arrayBuffer()), ext: 'png' };
    }
    throw new ServiceUnavailableException('Nhà cung cấp không trả về ảnh (thiếu b64_json/url).');
  }

  /**
   * Render 1 bài "Đã đăng" (hoặc "Đã duyệt" = xem trước, noindex) thành HTML từ DB.
   * Phục vụ nginx fallback: /blog/<slug>/ chưa có bản tĩnh → backend render ngay.
   * Trả null nếu không có bài hợp lệ (router → 404).
   */
  async renderBlogHtml(slugOrId: string): Promise<string | null> {
    const want = slugify(slugOrId);
    const all = await this.baiVietRepo.find({ order: { updated_at: 'DESC' } });
    const keyOf = (x: SeoBaiViet) => slugify(x.slug || x.tieu_de || `bai-${x.id}`);
    const a = all.find(
      (x) => keyOf(x) === want && (x.trang_thai === 'da_dang' || x.trang_thai === 'da_duyet'),
    );
    if (!a) return null;

    const json = this.buildArticleJson(a);
    const toDay = (d: Date | string | null | undefined) => {
      const dt = d instanceof Date ? d : d ? new Date(d) : null;
      return dt && !isNaN(dt.getTime()) ? dt.toISOString().slice(0, 10) : undefined;
    };
    // Bài liên quan: ưu tiên cùng chuyên mục, chỉ lấy bài ĐÃ ĐĂNG khác.
    const others = all.filter((x) => x.id !== a.id && x.trang_thai === 'da_dang');
    const sameCat = others.filter((x) => x.category && x.category === a.category);
    const related = [...sameCat, ...others.filter((x) => !sameCat.includes(x))]
      .slice(0, 4)
      .map((x) => ({ slug: keyOf(x), title: x.tieu_de }));

    // Van YMYL: bài phân loại "rủi ro" (có lời khuyên chẩn đoán/điều trị) chỉ được
    // cho Google index khi đã tick ĐỦ 4 mục checklist kiểm duyệt. Chưa duyệt → noindex
    // (vẫn xem được trên web, nhưng KHÔNG đẩy cho Google) → an toàn theo SEO-PLAN §6.
    const indexable =
      a.trang_thai === 'da_dang' &&
      (a.do_rui_ro !== 'rui_ro' || isKiemDuyetDu(a.kiem_duyet));

    return renderArticleHtml(
      {
        slug: json.slug,
        title: String(json.title || a.tieu_de || ''),
        description: (json.description as string) || undefined,
        bodyMarkdown: a.noi_dung_md || '',
        date: toDay(a.created_at),
        updated: toDay(a.updated_at),
        category: a.category || undefined,
        cta: (json.cta as string) || undefined,
        image: (json.image as string) || null,
        keywords: (json.keywords as string[]) || undefined,
        faq: (json.faq as { q: string; a: string }[]) || undefined,
        sources: (json.sources as ({ title: string; url?: string } | string)[]) || undefined,
        // "Đã đăng" + (an toàn HOẶC rủi ro-đã-duyệt) mới cho index; còn lại noindex.
        index: indexable,
      },
      related,
    );
  }

  /** HTML 404 (có style blog) khi không tìm thấy bài. */
  renderBlogNotFound(slug: string): string {
    return renderNotFoundHtml(slug);
  }

  // ===========================================================================
  // PHASE 3: TỰ ĐĂNG THEO XU HƯỚNG (Google Suggest → viết nháp → hàng chờ duyệt)
  // ===========================================================================

  /** Quét gợi ý tìm kiếm thật từ Google Suggest theo các từ khoá gốc → chủ đề ứng viên (đã bỏ trùng với bài đã viết). */
  async discoverTrends(seeds?: string[]): Promise<{ keyword: string }[]> {
    const useSeeds = (seeds && seeds.length ? seeds : DEFAULT_TREND_SEEDS)
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 12);

    const collected = new Map<string, string>(); // normLoose -> chuỗi gốc
    for (const seed of useSeeds) {
      const sugs = await this.googleSuggest(seed);
      for (const s of sugs) {
        const norm = normLoose(s);
        if (norm && norm.length > 3 && !collected.has(norm)) collected.set(norm, s);
      }
    }

    // Bỏ những gợi ý đã viết rồi (so theo tiêu đề/slug đã chuẩn hoá).
    const existing = await this.baiVietRepo.find({ select: ['tieu_de', 'slug'] });
    const existingNorms = new Set<string>();
    for (const e of existing) {
      if (e.tieu_de) existingNorms.add(normLoose(e.tieu_de));
      if (e.slug) existingNorms.add(normLoose(e.slug));
    }

    const out: { keyword: string }[] = [];
    for (const [norm, original] of collected) {
      if (existingNorms.has(norm)) continue;
      out.push({ keyword: original });
    }
    return out.slice(0, 50);
  }

  /** Viết nháp hàng loạt từ các từ khoá đã chọn (trần TREND_MAX_DRAFTS). Lỗi 1 bài không dừng cả mẻ. */
  async runTrendDrafts(keywords: string[]): Promise<SeoBaiViet[]> {
    const list = (keywords || [])
      .map((k) => String(k).trim())
      .filter(Boolean)
      .slice(0, TREND_MAX_DRAFTS);
    if (!list.length) throw new BadRequestException('Chưa chọn từ khoá nào để viết.');

    const out: SeoBaiViet[] = [];
    for (const kw of list) {
      try {
        out.push(await this.generateDraft({ chu_de: kw }));
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error('[SEO trend] viết lỗi cho:', kw, '—', e?.message || e);
      }
    }
    return out;
  }

  /** Gọi Google Suggest (miễn phí, không cần key) cho 1 từ khoá → mảng gợi ý. */
  private async googleSuggest(q: string): Promise<string[]> {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=vi&gl=vn&q=${encodeURIComponent(q)}`;
    const text = await fetchTextSafe(url);
    if (!text) return [];
    try {
      const data = JSON.parse(text);
      return Array.isArray(data) && Array.isArray(data[1]) ? data[1].map((x: any) => String(x)) : [];
    } catch {
      return [];
    }
  }

  /** Gọi Yescale lấy văn bản thuần (cho bước viết bài). */
  private async chatText(system: string, user: string, maxTokens: number): Promise<string> {
    const client = this.getClient();
    const model = this.config.get<string>('YESCALE_MODEL') || YESCALE_DEFAULT_MODEL;
    let response;
    try {
      response = await client.chat.completions.create({
        model,
        temperature: 0.6,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
    } catch (err: any) {
      const status = typeof err?.status === 'number' ? err.status : 503;
      const detail = err?.error?.message || err?.message || String(err);
      throw new HttpException(`yescale lỗi: ${detail}`, status);
    }
    const content = response.choices?.[0]?.message?.content?.trim() ?? '';
    if (!content) throw new ServiceUnavailableException('yescale trả về nội dung rỗng');
    return content;
  }
}

// =============================================================================
// Hàm tiện ích (thuần, không phụ thuộc state)
// =============================================================================

/** Chuẩn hoá domain: bỏ http(s), www, path, port. */
function normalizeDomain(input: string): string {
  let s = (input || '').trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^https?:\/\//, '');
  s = s.replace(/^www\./, '');
  s = s.split('/')[0];
  s = s.split('?')[0].split('#')[0];
  s = s.replace(/:\d+$/, '');
  return s.trim();
}

// ---- Chống SSRF (Server-Side Request Forgery) ------------------------------
// Người dùng nhập domain đối thủ → server tự đi tải URL của họ. Nếu không chặn,
// kẻ xấu có thể trỏ tới hạ tầng NỘI BỘ (localhost, 169.254.169.254 = metadata cloud,
// 10.x/192.168.x…) để dò mạng riêng. Ta phân giải DNS rồi từ chối mọi IP nội bộ.
/** true nếu IPv4 thuộc dải nội bộ/đặc biệt (loopback, private, link-local, CGNAT, multicast…). */
function ipv4IsBlocked(ip: string): boolean {
  const p = ip.split('.').map((n) => parseInt(n, 10));
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true; // 0.x · 10/8 · loopback
  if (a === 169 && b === 254) return true; // link-local + metadata cloud 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 192 && b === 0 && p[2] === 0) return true; // 192.0.0/24
  if (a >= 224) return true; // multicast (224–239) + reserved (240–255)
  return false;
}

/** true nếu IP (v4/v6) là nội bộ/không hợp lệ → KHÔNG được fetch tới. */
function ipIsBlocked(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return ipv4IsBlocked(ip);
  if (v === 6) {
    const low = ip.toLowerCase();
    if (low === '::1' || low === '::') return true; // loopback / unspecified
    const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(low); // IPv4-mapped
    if (mapped) return ipv4IsBlocked(mapped[1]);
    if (low.startsWith('fc') || low.startsWith('fd')) return true; // fc00::/7 unique-local
    if (/^fe[89ab]/.test(low)) return true; // fe80::/10 link-local
    return false;
  }
  return true; // không phải IP hợp lệ → chặn cho chắc
}

/**
 * Ném lỗi nếu URL không phải http(s) công khai. Phân giải DNS và chặn nếu host
 * trỏ tới IP nội bộ (chống cả domain "ngụy trang" trỏ về 127.0.0.1).
 * Lưu ý: chưa pin IP nên không tuyệt đối với DNS-rebinding tinh vi, nhưng đã chặn
 * mọi trường hợp phổ biến; cộng QuanTriGuard (chỉ admin) là đủ an toàn cho bối cảnh này.
 */
async function assertPublicHttpUrl(raw: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('URL không hợp lệ');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Chỉ cho phép http/https');
  const host = u.hostname.replace(/^\[|\]$/g, ''); // bỏ ngoặc vuông IPv6
  if (!host || host.toLowerCase() === 'localhost') throw new Error('Chặn host nội bộ');
  if (isIP(host)) {
    if (ipIsBlocked(host)) throw new Error('Chặn IP nội bộ');
    return;
  }
  const addrs = await dns.lookup(host, { all: true });
  if (!addrs.length) throw new Error('Không phân giải được host');
  for (const a of addrs) if (ipIsBlocked(a.address)) throw new Error('Host trỏ tới IP nội bộ');
}

/** Fetch text với timeout + User-Agent giống trình duyệt; lỗi/timeout/SSRF → trả ''. */
async function fetchTextSafe(url: string): Promise<string> {
  try {
    await assertPublicHttpUrl(url); // chặn SSRF trước khi gửi request
  } catch {
    return '';
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; KinhlacSEOBot/1.0; +https://kinhlac.online)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

function extractLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([\s\S]*?)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const u = decodeXmlEntities(m[1].trim());
    if (u) out.push(u);
  }
  return out;
}

/** Loại bỏ URL ảnh/file & trang chủ; giữ lại các trang nội dung. */
function isContentUrl(url: string, domain: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (/\.(jpe?g|png|gif|webp|svg|css|js|pdf|zip|rar|mp4|mp3|ico|xml|woff2?|ttf)(\?|$)/i.test(url)) {
    return false;
  }
  // bỏ trang chủ trần
  const stripped = url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
  if (stripped === domain) return false;
  return true;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCharCode(Number(n));
      } catch {
        return ' ';
      }
    });
}

/** HTML → text (tiêu đề, mô tả, thân bài đã bỏ thẻ). */
function htmlToText(html: string): { title: string; description: string; body: string } {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
  const description = (
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i)?.[1] ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["']/i)?.[1] ||
    ''
  ).trim();

  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  body = decodeHtmlEntities(body).replace(/\s+/g, ' ').trim();

  return {
    title: decodeHtmlEntities(title),
    description: decodeHtmlEntities(description),
    body,
  };
}

function pickString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join(', ');
  return String(v).trim();
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function toCommaText(v: unknown): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join(', ') || null;
  return String(v).trim() || null;
}

function toSemicolonText(v: unknown): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join('; ') || null;
  return String(v).trim() || null;
}

/** Bỏ ```fence``` bao ngoài + dòng tiêu đề H1 ở đầu (AI đôi khi thêm dù đã dặn). */
function stripLeadingH1(md: string): string {
  let s = (md || '').trim();
  const fence = s.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  if (fence?.[1]) s = fence[1].trim();
  s = s.replace(/^\s*#\s+.+\n+/, ''); // xoá 1 dòng H1 mở đầu nếu có
  return s.trim();
}

/** Chạy publish-article.mjs (ghi content/blog/<slug>.md), đẩy JSON qua stdin. spawn arg-array → an toàn injection. */
function runPublishScript(scriptPath: string, articleObj: unknown): Promise<void> {
  return new Promise((resolveP, reject) => {
    const child = spawn('node', [scriptPath, '--stdin']);
    let err = '';
    child.stderr.on('data', (d) => {
      err += String(d);
    });
    child.on('error', (e) => reject(new Error(`Không chạy được node: ${e.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolveP();
      else reject(new Error(`publish-article.mjs lỗi (mã ${code}): ${err.slice(0, 300)}`));
    });
    try {
      child.stdin.write(JSON.stringify(articleObj));
      child.stdin.end();
    } catch (e: any) {
      reject(new Error(`Lỗi ghi stdin: ${e?.message || e}`));
    }
  });
}

/** Prompt ảnh minh hoạ AI — mỹ thuật/biểu tượng, KHÔNG sơ đồ huyệt chính xác (an toàn YMYL). */
function buildImagePrompt(title: string, heading: string): string {
  return [
    'Decorative editorial illustration for a Vietnamese Traditional Medicine (Dong Y) blog.',
    `Article: "${title}". Section: "${heading}".`,
    'Style: warm and elegant, soft natural light, earthy brown and cream palette,',
    'motifs of medicinal herbs, gentle meridian energy lines, a calm traditional clinic.',
    'No text, no watermark, no precise anatomical acupoint map. Symbolic and artistic.',
  ].join(' ');
}

// Ảnh bìa = ảnh "của nhà" (public/kinhmach3d/images, không rủi ro bản quyền) KHỚP chủ đề bài.
// kinh-01..12 theo thứ tự kinh chuẩn: 01 Phế · 02 Đại Trường · 03 Vị · 04 Tỳ · 05 Tâm · 06 Tiểu Trường ·
// 07 Bàng Quang · 08 Thận · 09 Tâm Bào · 10 Tam Tiêu · 11 Đởm · 12 Can.
const MERIDIAN_VARIANTS = ['sodo', 'chinh', 'biet', 'can', 'doc', 'ngang', 'gen'];
const COVER_VARIANTS = ['sodo', 'chinh', 'ngang']; // biến thể "đẹp làm bìa" cho tầng 3
const meridianImg = (idx: number, variant: string) =>
  `/kinhmach3d/images/meridians/kinh-${String(idx).padStart(2, '0')}-${variant}.jpg`;

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Manifest tên huyệt → ảnh (sinh bởi frontend/scripts/_build-acu-index.mjs). Đọc 1 lần; lỗi/không có → [].
// Chạy trên MÁY CÓ MÃ NGUỒN frontend (giống publish-article.mjs); trên server thiếu file thì degrade về kinh.
let _acuIndex: [string, string][] | null = null;
function getAcuIndex(): [string, string][] {
  if (_acuIndex) return _acuIndex;
  const p =
    process.env.ACU_INDEX_PATH ||
    pathResolve(process.cwd(), '..', 'frontend', 'public', 'blog-assets', 'acu-index.json');
  try {
    _acuIndex = existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as [string, string][]) : [];
  } catch {
    _acuIndex = [];
  }
  return _acuIndex;
}

// Cụm chữ ĐẶC TRƯNG (đã bỏ dấu) → chỉ số đường kinh. Tránh âm tiết đơn dễ trùng (tâm, can, vị, thận…):
// dùng bigram "kinh X"/"tạng X", tên kinh đầy đủ, huyệt phổ biến, và từ tiếng Anh.
const MERIDIAN_KEYWORDS: { idx: number; phrases: string[] }[] = [
  { idx: 1, phrases: ['kinh phe', 'tang phe', 'thai am phe', 'phoi', 'lung'] },
  { idx: 2, phrases: ['dai truong', 'duong minh dai truong', 'hop coc', 'large intestine'] },
  { idx: 3, phrases: ['kinh vi', 'tang vi', 'duong minh vi', 'da day', 'tuc tam ly', 'stomach'] },
  { idx: 4, phrases: ['kinh ty', 'tang ty', 'thai am ty', 'tam am giao', 'lach', 'spleen'] },
  { idx: 5, phrases: ['kinh tam', 'tang tam', 'thieu am tam', 'tim mach', 'benh tim', 'heart'] },
  { idx: 6, phrases: ['tieu truong', 'thai duong tieu truong', 'small intestine'] },
  { idx: 7, phrases: ['bang quang', 'thai duong bang quang', 'bladder'] },
  { idx: 8, phrases: ['kinh than', 'tang than', 'thieu am than', 'bo than', 'kidney'] },
  { idx: 9, phrases: ['tam bao', 'quyet am tam bao', 'pericardium'] },
  { idx: 10, phrases: ['tam tieu', 'thieu duong tam tieu', 'san jiao', 'triple energizer'] },
  { idx: 11, phrases: ['kinh dom', 'tang dom', 'thieu duong dom', 'tui mat', 'gallbladder'] },
  { idx: 12, phrases: ['kinh can', 'tang can', 'quyet am can', 'la gan', 'bo gan', 'gan mat', 'liver'] },
];

/**
 * Chọn ảnh bìa khớp chủ đề, 3 tầng: tên huyệt cụ thể → tên kinh (biến thể xoay) → sơ đồ phân bố theo slug.
 * LƯU Ý: bản xem trước ở frontend (SeoRadarView.vue → coverImageFor) phải khớp logic này.
 */
function pickCoverImage(slug: string, tieuDe = '', tuKhoa = ''): string {
  const hay = ` ${normLoose([tieuDe, tuKhoa, slug].filter(Boolean).join(' '))
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
  // Tầng 1: tên huyệt cụ thể (manifest đã sắp tên DÀI trước → cụm dài khớp trước).
  // CHỈ chạy khi bài thực sự nói về "huyệt" — tránh bài khái niệm khớp nhầm (vd "tính vị" ≠ huyệt Ngũ Vị).
  if (hay.includes(' huyet ')) {
    for (const [name, file] of getAcuIndex()) {
      if (hay.includes(` ${name} `)) return file;
    }
  }
  // Tầng 2: tên kinh/tạng → 1 biến thể của đúng kinh đó (xoay theo slug).
  for (const m of MERIDIAN_KEYWORDS) {
    if (m.phrases.some((p) => hay.includes(` ${p} `))) {
      return meridianImg(m.idx, MERIDIAN_VARIANTS[hashStr(slug || '') % MERIDIAN_VARIANTS.length]);
    }
  }
  // Tầng 3: sơ đồ kinh phân bố ổn định theo slug (12 × 3 biến thể bìa). (>>> = dịch KHÔNG dấu.)
  const h = hashStr(slug || 'bai-viet');
  return meridianImg((h % 12) + 1, COVER_VARIANTS[(h >>> 4) % COVER_VARIANTS.length]);
}

/** Chuẩn hoá lỏng để so trùng: bỏ dấu, thường hoá, gộp khoảng trắng. */
function normLoose(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Chuyển tên/tiêu đề thành slug ASCII (không dấu, dùng -). */
function slugify(s: string): string {
  const out = (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return out || 'bai-viet';
}

/** Chỉ chấp nhận các đường dẫn CTA hợp lệ của pipeline blog; mặc định /xem-ket-qua-do. */
function normalizeCta(v: string): string {
  const s = (v || '').trim();
  return ALLOWED_CTA.has(s) ? s : '/xem-ket-qua-do';
}

/**
 * Trong THÂN BÀI chỉ giữ liên kết nội bộ (đường dẫn bắt đầu bằng "/").
 * Link ra ngoài (http, mailto, neo #) bị gỡ về chữ thường — chống AI bịa URL trong bài.
 * Ảnh `![..](..)` được giữ nguyên (không động vào).
 */
function sanitizeBodyLinks(md: string): string {
  return (md || '').replace(
    /(!?)\[([^\]]+)\]\(\s*([^)\s]+)[^)]*\)/g,
    (full, bang: string, text: string, url: string) => {
      if (bang) return full; // ảnh → giữ nguyên
      if (url.startsWith('/')) return full; // link nội bộ → giữ
      return text; // link ngoài / mailto / neo → bỏ link, giữ chữ neo
    },
  );
}

/** Chuẩn hoá mảng nguồn tham khảo → chuỗi JSON [{title, url?}] (hoặc null). KHÔNG giữ url không phải http(s). */
function normalizeSourcesJson(v: unknown): string | null {
  if (!Array.isArray(v)) return null;
  const arr = v
    .map((it) => {
      if (typeof it === 'string') {
        const t = it.trim();
        return t ? { title: t } : null;
      }
      if (it && typeof it === 'object') {
        const o = it as Record<string, unknown>;
        const title = String(o.ten ?? o.title ?? o.name ?? '').trim();
        const url = String(o.url ?? o.link ?? '').trim();
        if (!title && !url) return null;
        return url && /^https?:\/\//i.test(url)
          ? { title: title || url, url }
          : { title: title || url };
      }
      return null;
    })
    .filter(Boolean)
    .slice(0, 6);
  return arr.length ? JSON.stringify(arr) : null;
}

/** Chuẩn hoá mảng FAQ [{q,a}] → chuỗi JSON (hoặc null). */
function normalizeFaqJson(v: unknown): string | null {
  if (!Array.isArray(v)) return null;
  const arr = v
    .map((it) => {
      if (!it || typeof it !== 'object') return null;
      const o = it as Record<string, unknown>;
      const q = String(o.q ?? o.question ?? '').trim();
      const a = String(o.a ?? o.answer ?? '').trim();
      return q && a ? { q, a } : null;
    })
    .filter(Boolean);
  return arr.length ? JSON.stringify(arr) : null;
}

/** Parse JSON "lì đòn": thử trực tiếp → bóc ```fence``` → cắt {..} hoặc [..]. */
function parseJsonLoose(raw: string): Record<string, unknown> | unknown[] | null {
  try {
    return JSON.parse(raw);
  } catch {
    /* tiếp tục */
  }
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      /* tiếp tục */
    }
  }
  const fObj = raw.indexOf('{');
  const lObj = raw.lastIndexOf('}');
  if (fObj >= 0 && lObj > fObj) {
    try {
      return JSON.parse(raw.slice(fObj, lObj + 1));
    } catch {
      /* tiếp tục */
    }
  }
  const fArr = raw.indexOf('[');
  const lArr = raw.lastIndexOf(']');
  if (fArr >= 0 && lArr > fArr) {
    try {
      return JSON.parse(raw.slice(fArr, lArr + 1));
    } catch {
      /* tiếp tục */
    }
  }
  return null;
}
