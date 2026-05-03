import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeridianSyndrome } from '../models/meridian-syndrome.model';
import { LegacyMeridianSyndrome } from '../models/legacy-meridian-syndrome.model';

export class AnalyzeInputDto {
  tieutruongtrai: number;
  tieutruongphai: number;
  tamtrai: number;
  tamphai: number;
  tamtieutrai: number;
  tamtieuphai: number;
  tambaotrai: number;
  tambaophai: number;
  daitrangtrai: number;
  daitrangphai: number;
  phetrai: number;
  phephai: number;
  bangquangtrai: number;
  bangquangphai: number;
  thantrai: number;
  thanphai: number;
  damtrai: number;
  damphai: number;
  vitrai: number;
  viphai: number;
  cantrai: number;
  canphai: number;
  tytrai: number;
  typhai: number;
}

export class AnalyzeOutputDto {
  am_duong: string;
  khi: string;
  huyet: string;
  flags: Array<{
    channelIndex: number;
    channelName: string;
    L: number;
    R: number;
    Avg: number;
    c8: number;
    c10: number;
    c10Legacy?: number;
    c11: number;
    c12: number;
  }>;
  /**
   * Danh sách mô hình bệnh lý gợi ý (đã xếp hạng theo % khớp)
   * rate: tỉ lệ khớp (0..1) trên các điều kiện có trong mô hình
   */
  syndromes: Array<MeridianSyndrome & { rate?: number; matchScore?: number; totalInModel?: number }>;
  currentSyndromes?: Array<MeridianSyndrome & { rate?: number; matchScore?: number; totalInModel?: number }>;
  legacySyndromes?: Array<LegacyMeridianSyndrome & { rate?: number; matchedCount?: number; totalInModel?: number }>;
  comparisonRows?: Array<{
    current: (MeridianSyndrome & { rate?: number; matchScore?: number }) | null;
    legacy: (LegacyMeridianSyndrome & { rate?: number }) | null;
  }>;
}

const CHANNELS = [
  'tieutruong', // 0: Tiểu trường
  'tam',        // 1: Tâm
  'tamtieu',    // 2: Tam tiêu
  'tambao',     // 3: Tâm bào
  'daitrang',   // 4: Đại tràng
  'phe',        // 5: Phế
  'bangquang',  // 6: Bàng quang
  'than',       // 7: Thận
  'dam',        // 8: Đảm
  'vi',         // 9: Vị
  'can',        // 10: Can
  'ty',         // 11: Tỳ
];

@Injectable()
export class MeridiansService {
  constructor(
    @InjectRepository(MeridianSyndrome)
    private readonly meridianRepo: Repository<MeridianSyndrome>,
    @InjectRepository(LegacyMeridianSyndrome)
    private readonly legacyMeridianRepo: Repository<LegacyMeridianSyndrome>,
  ) {}

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  /**
   * Chuẩn hoá dữ liệu nhiệt độ kinh lạc về đúng khoảng sinh lý 20..40 °C.
   *
   * Quy tắc:
   * - Nếu val = 0: coi là chưa đo -> giữ nguyên 0
   * - Nếu val nằm trong [20,40]: giữ nguyên
   * - Nếu val > 40:
   *    - thử chia theo 10^k (k=1..4) để đưa về [20,40]
   *      (vd 354 -> 35.4; 3544 -> 35.44)
   *    - nếu không có k phù hợp: báo lỗi để tránh quy đổi sai
   */
  private normalizeChannelValue(val: number, fieldName: string): number {
    if (!Number.isFinite(val) || val === 0) return 0;

    // Đã đúng đơn vị
    if (val >= 20 && val <= 40) return val;

    // Rất có thể người dùng nhập theo dạng "x10" hoặc "x100" cho đúng số lẻ
    if (val > 40) {
      const maxPow = 4; // cho phép tối đa 4 chữ số "nhân lên"
      for (let pow = 1; pow <= maxPow; pow++) {
        const cand = val / Math.pow(10, pow);
        if (cand >= 20 && cand <= 40) return this.round2(cand);
      }
    }

    throw new BadRequestException(
      `Giá trị nhiệt độ không hợp lệ (${fieldName} = ${val}). ` +
      `Chỉ chấp nhận trong khoảng 20..40 °C. Nếu bạn nhập theo dạng "x10/x100" ` +
      `(ví dụ 354 -> 35.4, 3544 -> 35.44) thì hệ thống sẽ tự quy đổi.`,
    );
  }

  async analyze(data: AnalyzeInputDto): Promise<AnalyzeOutputDto> {
    // Chuẩn hoá/validate 24 giá trị trước khi tính toán ngưỡng
    // (mutate tại chỗ để các nơi lưu inputData về sau cũng có giá trị chuẩn)
    for (const ch of CHANNELS) {
      const leftKey = `${ch}trai` as keyof AnalyzeInputDto;
      const rightKey = `${ch}phai` as keyof AnalyzeInputDto;
      (data as any)[leftKey] = this.normalizeChannelValue((data as any)[leftKey], String(leftKey));
      (data as any)[rightKey] = this.normalizeChannelValue((data as any)[rightKey], String(rightKey));
    }

    const leftChannels = [
      data.tieutruongtrai,
      data.tamtrai,
      data.tamtieutrai,
      data.tambaotrai,
      data.daitrangtrai,
      data.phetrai,
      data.bangquangtrai,
      data.thantrai,
      data.damtrai,
      data.vitrai,
      data.cantrai,
      data.tytrai,
    ];

    const rightChannels = [
      data.tieutruongphai,
      data.tamphai,
      data.tamtieuphai,
      data.tambaophai,
      data.daitrangphai,
      data.phephai,
      data.bangquangphai,
      data.thanphai,
      data.damphai,
      data.viphai,
      data.canphai,
      data.typhai,
    ];

    if ((leftChannels as any[]).includes(undefined) || (rightChannels as any[]).includes(undefined)) {
      throw new Error('Invalid input, must provide all 24 specific channels.');
    }

    // --- Bước 2.1: Tính Khung Sinh Lý (làm tròn 2 chữ số như code gốc) ---
    const calculateBounds = (leftArr: number[], rightArr: number[]) => {
      const allVals = [...leftArr, ...rightArr].filter(v => v > 0);
      if (allVals.length === 0) {
        return { midPoint: 0, dungSai: 0, upperLimit: 0, lowerLimit: 0 };
      }

      const maxVal = Math.max(...allVals);
      const minVal = Math.min(...allVals);
      const range = maxVal - minVal;

      // Trong phương pháp Lê Văn Sửu (theo Excel): midPoint = (Max + Min) / 2
      const midPoint = this.round2((maxVal + minVal) / 2.0);
      const dungSai = this.round2(range / 6.0);

      return {
        midPoint,
        dungSai,
        upperLimit: this.round2(midPoint + dungSai),
        lowerLimit: this.round2(midPoint - dungSai),
      };
    };

    const boundsUpper = calculateBounds(leftChannels.slice(0, 6), rightChannels.slice(0, 6));
    const boundsLower = calculateBounds(leftChannels.slice(6, 12), rightChannels.slice(6, 12));

    // --- Bước 2.2: Tính Cờ Trạng Thái (Flags) ---
    const flags: AnalyzeOutputDto['flags'] = [];

    for (let i = 0; i < 12; i++) {
      const bounds = i < 6 ? boundsUpper : boundsLower;

      const L = leftChannels[i];
      const R = rightChannels[i];
      const avg = this.round2((L + R) / 2.0);

      // C10: Trạng thái của kinh (Hàn/Bình/Nhiệt)
      const c10 = avg > bounds.upperLimit ? 1 : (avg < bounds.lowerLimit ? -1 : 0);
      // C10 gốc app 32-bit: so với midpoint, không dùng corridor upper/lower.
      const c10Legacy = avg > bounds.midPoint ? 1 : (avg < bounds.midPoint ? -1 : 0);

      // C8: trái so với giới hạn
      const c8 = L > bounds.upperLimit ? 1 : L < bounds.lowerLimit ? -1 : 0;

      // C11: phải so với giới hạn
      const c11 = R > bounds.upperLimit ? 1 : R < bounds.lowerLimit ? -1 : 0;

      // C12: lệch 2 bên
      const diff = L - R;
      const c12 = Math.abs(diff) > bounds.dungSai
        ? (diff > 0 ? 1 : -1)
        : 0;

      flags.push({ channelIndex: i, channelName: CHANNELS[i], L, R, Avg: avg, c8, c10, c10Legacy, c11, c12 });
    }

    // --- Bước 3: Suy luận Âm-Dương & Khí-Huyết ---
    // Âm / Dương: Dựa trên trung bình kinh Đảm so với trị số bình quân nhóm Chi dưới
    const avg_dam = this.round2((data.damtrai + data.damphai) / 2.0);
    const mid_tuc = boundsLower.midPoint; // (Max + Min) / 2 của nhóm Chi dưới
    const diff_am_duong = this.round2(avg_dam - mid_tuc);
    
    let am_duong = 'Bình thường';
    if (diff_am_duong < 0) {
      am_duong = 'Dương hư';
    } else if (diff_am_duong > 0) {
      am_duong = 'Âm hư';
    }

    // --- Bước 3.1: Chẩn đoán Khí (Dựa trên 6 kinh Chi trên) ---
    let huTrenCount = 0;
    let sumDiffTren = 0;
    let allTrenZero = true;

    for (let i = 0; i < 6; i++) {
      const f = flags[i];
      const diff = this.round2(f.Avg - boundsUpper.midPoint);
      sumDiffTren += diff;
      if (f.Avg !== 0) allTrenZero = false;
      if (diff < 0) huTrenCount++;
    }

    let khi = 'Bình thường';
    if (allTrenZero) {
      khi = '';
    } else {
      if (huTrenCount > 3) {
        khi = 'Khí hư';
      } else if (huTrenCount < 3) {
        khi = 'Khí thịnh';
      } else {
        // huTrenCount == 3
        if (sumDiffTren < 0) khi = 'Khí hư';
        else if (sumDiffTren > 0) khi = 'Khí thịnh';
        else khi = '';
      }
    }

    // --- Bước 3.2: Chẩn đoán Huyết (Dựa trên 6 kinh Chi dưới) ---
    let huDuoiCount = 0;
    let sumDiffDuoi = 0;
    let allDuoiZero = true;

    for (let i = 6; i < 12; i++) {
      const f = flags[i];
      const diff = this.round2(f.Avg - boundsLower.midPoint);
      sumDiffDuoi += diff;
      if (f.Avg !== 0) allDuoiZero = false;
      if (diff < 0) huDuoiCount++;
    }

    let huyet = 'Bình thường';
    if (allDuoiZero) {
      huyet = '';
    } else {
      if (huDuoiCount > 3) {
        huyet = 'Huyết hư';
      } else if (huDuoiCount < 3) {
        huyet = 'Huyết thịnh';
      } else {
        // huDuoiCount == 3
        if (sumDiffDuoi < 0) huyet = 'Huyết hư';
        else if (sumDiffDuoi > 0) huyet = 'Huyết thịnh';
        else huyet = '';
      }
    }

    // --- Bước 4: Khớp CSDL bệnh chứng luận trị (Logic chấm điểm tương đồng) ---
    const allSyndromes = await this.meridianRepo.find();

    const suggested = allSyndromes.map(dbRow => {
      let score = 0;
      let totalConditions = 0;
      let matchedConditions = 0;

      for (let i = 0; i < 12; i++) {
        const ch = CHANNELS[i];
        const f = flags[i];
        
        // Lấy điều kiện từ DB cho kinh này (c10, c8, c11)
        const dbC10 = (dbRow[ch as keyof MeridianSyndrome] as number) ?? 0;
        const dbC8 = (dbRow[`${ch}_c8` as keyof MeridianSyndrome] as number) ?? 0;
        const dbC11 = (dbRow[`${ch}_c11` as keyof MeridianSyndrome] as number) ?? 0;

        // Nếu DB có quy định trạng thái cho kinh này
        if (dbC10 !== 0 || dbC8 !== 0 || dbC11 !== 0) {
          totalConditions++;
          
          let channelMatched = true;
          let weight = 1.0;

          // Kiểm tra khớp từng flag nếu DB có quy định
          if (dbC10 !== 0 && dbC10 !== f.c10) channelMatched = false;
          if (dbC8 !== 0 && dbC8 !== f.c8) channelMatched = false;
          if (dbC11 !== 0 && dbC11 !== f.c11) channelMatched = false;

          if (channelMatched) {
            matchedConditions++;
            // Nếu kinh này đang ở trạng thái Thực/Hư rõ rệt (ngoài corridor) thì tăng trọng số điểm
            if (f.c8 !== 0 || f.c11 !== 0) weight = 1.5;
            score += weight;
          }
        }
      }

      // Tỷ lệ khớp dựa trên số điều kiện đã khớp / tổng số điều kiện của mẫu bệnh đó
      const rate = totalConditions > 0 ? matchedConditions / totalConditions : 0;
      
      return Object.assign(dbRow, { 
        rate, 
        matchScore: score, 
        matchedCount: matchedConditions,
        totalInModel: totalConditions 
      });
    })
    // Lọc các mô hình có độ tương đồng cao (trên 60% hoặc khớp tuyệt đối)
    .filter(m => (m.totalInModel ?? 0) > 0 && (m.rate ?? 0) >= 0.6)
    .sort((a, b) => {
      // Ưu tiên khớp tuyệt đối (rate=1), sau đó đến điểm số (score) và tỷ lệ (rate)
      if (a.rate === 1 && b.rate !== 1) return -1;
      if (a.rate !== 1 && b.rate === 1) return 1;
      return (b.matchScore ?? 0) - (a.matchScore ?? 0) || (b.rate ?? 0) - (a.rate ?? 0);
    })
    .slice(0, 15);

    // --- Bước 5: Đối chiếu mô hình app gốc (legacy) ---
    const legacyRows = await this.legacyMeridianRepo.find({
      order: { nhomid: 'ASC', tieuket: 'ASC', id: 'ASC' },
    });

    const legacySuggested = legacyRows
      .map((dbRow) => {
        let totalConditions = 0;
        let matchedConditions = 0;
        let allMatched = true;

        for (let i = 0; i < 12; i++) {
          const ch = CHANNELS[i];
          const f = flags[i];
          const dbC10 = (dbRow[ch as keyof LegacyMeridianSyndrome] as number) ?? 0;
          const dbC8 = (dbRow[`${ch}_c8` as keyof LegacyMeridianSyndrome] as number) ?? 0;
          const dbC11 = (dbRow[`${ch}_c11` as keyof LegacyMeridianSyndrome] as number) ?? 0;

          if (dbC10 !== 0 || dbC8 !== 0 || dbC11 !== 0) {
            totalConditions++;
            const channelMatched =
              (dbC10 === 0 || dbC10 === (f.c10Legacy ?? 0)) &&
              (dbC8 === 0 || dbC8 === f.c8) &&
              (dbC11 === 0 || dbC11 === f.c11);

            if (channelMatched) matchedConditions++;
            else allMatched = false;
          }
        }

        if (totalConditions === 0 || !allMatched) return null;

        const rate = matchedConditions / totalConditions;
        return Object.assign(dbRow, {
          rate,
          matchedCount: matchedConditions,
          totalInModel: totalConditions,
        });
      })
      .filter((x): x is LegacyMeridianSyndrome & { rate?: number; matchedCount?: number; totalInModel?: number } => !!x);

    const comparisonRows = Array.from(
      { length: Math.max(suggested.length, legacySuggested.length) },
      (_, idx) => ({
        current: suggested[idx] ?? null,
        legacy: legacySuggested[idx] ?? null,
      }),
    );

    return {
      am_duong,
      khi,
      huyet,
      flags,
      currentSyndromes: suggested,
      legacySyndromes: legacySuggested,
      comparisonRows,
      syndromes: suggested,
    };
  }
}
