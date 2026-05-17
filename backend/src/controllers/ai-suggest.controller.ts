import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface ViThuocAiSuggestion {
  tinh: string;
  vi: string;
  quy_kinh: string;
}

const YESCALE_DEFAULT_BASE_URL = 'https://api.yescale.vip/v1';
const YESCALE_DEFAULT_MODEL = 'deepseek-v3.2';

const SYSTEM_PROMPT = `Bạn là một chuyên gia Y học Cổ truyền (Đông Y). Khi nhận tên một vị thuốc, hãy trả về CHÍNH XÁC một JSON object với 3 trường:
- "tinh": tính của vị thuốc (1 từ ngắn, và 1 trong các giá trị sau "Ấm", "Hàn", "Lương", "Ôn", "Bình", "Nhiệt").
- "vi": vị của vị thuốc, có thể nhiều vị cách nhau bởi dấu phẩy .yêu cầu chọn chính xác từ các vị sau: Tân  - Cam  - Khổ  - Toan  - Hàm  - Đạm . 
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

  constructor(private readonly config: ConfigService) { }

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

    return {
      tinh: pickString(parsed, 'tinh'),
      vi: pickString(parsed, 'vi'),
      quy_kinh: pickString(parsed, 'quy_kinh'),
    };
  }
}

function pickString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join(', ');
  return String(v).trim();
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
