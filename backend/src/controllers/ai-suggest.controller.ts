import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { KinhMach } from '../models/kinh-mach.model';

export interface ViThuocAiSuggestion {
  tinh: string;
  vi: string;
  /** Tên các kinh mạch ghép bằng dấu phẩy (hiển thị/legacy). */
  quy_kinh: string;
  /** IDs khớp được với bảng `kinh_mach`. */
  kinh_mach_ids: number[];
  /** Tên AI đề xuất nhưng không khớp được kinh mạch nào trong DB. */
  kinh_mach_unmatched: string[];
}

export interface NhomNhoCandidate {
  id: number;
  ten_nhom: string;
  mo_ta?: string | null;
  lieu_luong?: string | null;
}

export interface ClassifyViThuocInput {
  vi_thuoc: { id: number; ten_vi_thuoc: string }[];
  nhom_nho_candidates: NhomNhoCandidate[];
}

export interface ViThuocClassification {
  id: number;
  ten_vi_thuoc: string;
  /** ID nhóm nhỏ phù hợp nhất; `null` nếu AI không chắc chắn. */
  id_nhom_nho: number | null;
  /** Lý do ngắn gọn AI giải thích (1-2 câu). */
  ly_do?: string;
}

const YESCALE_DEFAULT_BASE_URL = 'https://api.yescale.vip/v1';
const YESCALE_DEFAULT_MODEL = 'deepseek-v3.2';

const SYSTEM_PROMPT = `Bạn là một chuyên gia Y học Cổ truyền (Đông Y). Khi nhận tên một vị thuốc, hãy trả về CHÍNH XÁC một JSON object với 3 trường:
- "tinh": tính của vị thuốc (1 từ ngắn, và 1 trong các giá trị sau "Ấm", "Hàn", "Lương", "Ôn", "Bình", "Nhiệt").
- "vi": vị của vị thuốc, có thể nhiều vị cách nhau bởi dấu phẩy và yêu cầu chọn chính xác từ các vị sau: Tân  - Cam  - Khổ  - Toan  - Hàm  - Đạm, không lấy các vị nào khác bên ngoài
- "quy_kinh": các kinh lạc trong lục phủ và ngũ tạng, cách nhau bởi dấu phẩy (ví dụ: Tâm, Can, Tỳ, Phế, Thận, Đại trường, Tiểu trường , ...).

QUY TẮC:
- Chỉ trả về JSON thuần, KHÔNG kèm văn bản, KHÔNG markdown, KHÔNG \`\`\`.
- Nếu không chắc chắn về vị thuốc, vẫn cố gắng đưa giá trị phổ biến nhất trong y văn cổ truyền Việt Nam.
- Dùng tiếng Việt có dấu, viết hoa chữ cái đầu.`;

@Injectable()
export class AiSuggestService {
  private client: OpenAI | null = null;
  private clientKey = '';
  private clientBase = '';

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(KinhMach)
    private readonly kinhMachRepo: Repository<KinhMach>,
  ) { }

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

  async suggestViThuoc(name: string): Promise<ViThuocAiSuggestion> {
    const ten = (name || '').trim();
    if (!ten) {
      throw new BadRequestException('Thiếu tên vị thuốc');
    }

    const client = this.getClient();
    const model =
      this.config.get<string>('YESCALE_MODEL') || YESCALE_DEFAULT_MODEL;

    let response;
    try {
      response = await client.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: 512,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Tên vị thuốc: ${ten}` },
        ],
      });
    } catch (err: any) {
      const status = typeof err?.status === 'number' ? err.status : 503;
      const detail = err?.error?.message || err?.message || String(err);
      throw new HttpException(`yescale lỗi: ${detail}`, status);
    }

    const content = response.choices?.[0]?.message?.content?.trim() ?? '';
    if (!content) {
      throw new ServiceUnavailableException('yescale trả về nội dung rỗng');
    }

    const parsed = parseJsonLoose(content);
    if (!parsed || typeof parsed !== 'object') {
      throw new ServiceUnavailableException(
        `Không parse được JSON từ AI: ${content.slice(0, 200)}`,
      );
    }

    const tinh = pickString(parsed, 'tinh');
    const vi = pickString(parsed, 'vi');
    const quyKinhRaw = pickString(parsed, 'quy_kinh');

    const { ids, matchedNames, unmatched } = await this.mapKinhMachNames(
      splitNames(quyKinhRaw),
    );

    return {
      tinh,
      vi,
      quy_kinh: matchedNames.join(', '),
      kinh_mach_ids: ids,
      kinh_mach_unmatched: unmatched,
    };
  }

  async classifyViThuoc(input: ClassifyViThuocInput): Promise<ViThuocClassification[]> {
    const viThuocs = (input.vi_thuoc ?? []).filter(
      (v) => v && Number.isFinite(v.id) && typeof v.ten_vi_thuoc === 'string' && v.ten_vi_thuoc.trim().length > 0,
    );
    const candidates = (input.nhom_nho_candidates ?? []).filter(
      (c) => c && Number.isFinite(c.id) && typeof c.ten_nhom === 'string' && c.ten_nhom.trim().length > 0,
    );
    if (!viThuocs.length) {
      throw new BadRequestException('Danh sách vị thuốc rỗng');
    }
    if (!candidates.length) {
      throw new BadRequestException('Danh sách nhóm nhỏ ứng viên rỗng');
    }

    const client = this.getClient();
    const model = this.config.get<string>('YESCALE_MODEL') || YESCALE_DEFAULT_MODEL;

    const candidateBlock = candidates
      .map((c) => {
        const parts = [`id=${c.id}`, `ten="${c.ten_nhom.trim()}"`];
        const lieu = (c.lieu_luong ?? '').trim();
        if (lieu) parts.push(`lieu="${lieu}"`);
        const mota = (c.mo_ta ?? '').trim();
        if (mota) parts.push(`mo_ta="${mota.replace(/\s+/g, ' ').slice(0, 200)}"`);
        return `{${parts.join(', ')}}`;
      })
      .join('\n');

    const viThuocBlock = viThuocs
      .map((v) => `{id=${v.id}, ten="${v.ten_vi_thuoc.trim()}"}`)
      .join('\n');

    const systemPrompt = `Bạn là chuyên gia Y học Cổ truyền (Đông Y) Việt Nam. Nhiệm vụ: phân loại từng vị thuốc vào một nhóm nhỏ dược lý phù hợp nhất từ danh sách ứng viên cho trước.

QUY TẮC:
- Chỉ chọn id_nhom_nho từ danh sách ứng viên đã cho.
- Nếu không có nhóm nào thật sự phù hợp, trả về id_nhom_nho: null.
- Mỗi vị thuốc chỉ thuộc 1 nhóm.
- Trả về CHÍNH XÁC JSON mảng, không kèm văn bản, không markdown, không \`\`\`.
- Mỗi phần tử có format: {"id": <id vị thuốc>, "ten_vi_thuoc": "<tên>", "id_nhom_nho": <id nhóm nhỏ hoặc null>, "ly_do": "<lý do ngắn 1 câu>"}
- ly_do: tiếng Việt, ngắn gọn (dưới 25 từ), nêu công năng/tính vị/tác dụng chính lý giải lý do chọn nhóm.`;

    const userPrompt = `Danh sách NHÓM NHỎ ứng viên:
${candidateBlock}

Danh sách VỊ THUỐC cần phân loại:
${viThuocBlock}

Phân loại tất cả vị thuốc trên vào các nhóm nhỏ ứng viên (theo id) và trả JSON.`;

    let response;
    try {
      response = await client.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: Math.min(4096, 256 + viThuocs.length * 80),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
    } catch (err: any) {
      const status = typeof err?.status === 'number' ? err.status : 503;
      const detail = err?.error?.message || err?.message || String(err);
      throw new HttpException(`yescale lỗi: ${detail}`, status);
    }

    const content = response.choices?.[0]?.message?.content?.trim() ?? '';
    if (!content) {
      throw new ServiceUnavailableException('yescale trả về nội dung rỗng');
    }

    const parsed = parseJsonArrayLoose(content);
    if (!parsed) {
      throw new ServiceUnavailableException(
        `Không parse được JSON từ AI: ${content.slice(0, 200)}`,
      );
    }

    const allowedNhomNhoIds = new Set(candidates.map((c) => c.id));
    const byId = new Map<number, { id: number; ten_vi_thuoc: string }>();
    for (const v of viThuocs) byId.set(v.id, v);

    const out: ViThuocClassification[] = [];
    const seen = new Set<number>();
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const raw = item as Record<string, unknown>;
      const idRaw = raw.id ?? raw.id_vi_thuoc;
      const idNum = typeof idRaw === 'number' ? idRaw : Number(idRaw);
      if (!Number.isFinite(idNum)) continue;
      const v = byId.get(idNum);
      if (!v || seen.has(idNum)) continue;
      seen.add(idNum);
      const nnRaw = raw.id_nhom_nho;
      const nnNum =
        nnRaw === null || nnRaw === undefined || nnRaw === ''
          ? null
          : typeof nnRaw === 'number'
            ? nnRaw
            : Number(nnRaw);
      const idNhomNho = nnNum != null && Number.isFinite(nnNum) && allowedNhomNhoIds.has(nnNum) ? nnNum : null;
      const lyDo = typeof raw.ly_do === 'string' ? raw.ly_do.trim() : '';
      out.push({
        id: v.id,
        ten_vi_thuoc: v.ten_vi_thuoc,
        id_nhom_nho: idNhomNho,
        ly_do: lyDo || undefined,
      });
    }

    // Fallback: vị thuốc nào AI bỏ sót → id_nhom_nho: null
    for (const v of viThuocs) {
      if (seen.has(v.id)) continue;
      out.push({ id: v.id, ten_vi_thuoc: v.ten_vi_thuoc, id_nhom_nho: null });
    }
    return out;
  }

  private async mapKinhMachNames(names: string[]): Promise<{
    ids: number[];
    matchedNames: string[];
    unmatched: string[];
  }> {
    if (!names.length) return { ids: [], matchedNames: [], unmatched: [] };

    const all = await this.kinhMachRepo.find();
    const byKey = new Map<string, KinhMach>();
    for (const km of all) {
      if (km.ten_kinh_mach) byKey.set(normKm(km.ten_kinh_mach), km);
      if (km.ten_viet_tat) byKey.set(normKm(km.ten_viet_tat), km);
    }

    const ids: number[] = [];
    const matchedNames: string[] = [];
    const unmatched: string[] = [];
    const seen = new Set<number>();

    for (const name of names) {
      const key = normKm(name);
      let km = byKey.get(key);
      if (!km) {
        // Loose contains-match: "Đại Trường Kinh" vs "Đại Trường".
        for (const candidate of all) {
          const cKey = normKm(candidate.ten_kinh_mach || '');
          if (!cKey) continue;
          if (key.includes(cKey) || cKey.includes(key)) {
            km = candidate;
            break;
          }
        }
      }
      if (km && !seen.has(km.idKinhMach)) {
        seen.add(km.idKinhMach);
        ids.push(km.idKinhMach);
        matchedNames.push(km.ten_kinh_mach || name);
      } else if (!km) {
        unmatched.push(name);
      }
    }
    return { ids, matchedNames, unmatched };
  }
}

function splitNames(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Normalize meridian name: lowercase, strip diacritics, collapse whitespace, drop "kinh" suffix. */
function normKm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\bkinh\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join(', ');
  return String(v).trim();
}

function parseJsonArrayLoose(raw: string): unknown[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through
  }
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      const parsed = JSON.parse(fence[1]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through
    }
  }
  const first = raw.indexOf('[');
  const last = raw.lastIndexOf(']');
  if (first >= 0 && last > first) {
    try {
      const parsed = JSON.parse(raw.slice(first, last + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through
    }
  }
  return null;
}

function parseJsonLoose(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) {
      try {
        return JSON.parse(fence[1]) as Record<string, unknown>;
      } catch {
        // fall through
      }
    }
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(raw.slice(first, last + 1)) as Record<string, unknown>;
      } catch {
        // fall through
      }
    }
    return null;
  }
}
