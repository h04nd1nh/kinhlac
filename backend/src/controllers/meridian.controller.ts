import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeridianSyndrome } from '../models/meridian-syndrome.model';

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
    c11: number;
    c12: number;
  }>;
  syndromes: MeridianSyndrome[];
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
  ) {}

  async analyze(data: AnalyzeInputDto): Promise<AnalyzeOutputDto> {
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

    // --- Tính toán Toán học cho Khung Sinh Lý ---
    const calculateBounds = (leftArr: number[], rightArr: number[]) => {
      const allVals = [...leftArr, ...rightArr];
      const maxVal = Math.max(...allVals);
      const minVal = Math.min(...allVals);
      const midPoint = (maxVal + minVal) / 2.0;
      const range = maxVal - minVal;
      const dungSai = range / 6.0;
      
      return {
        maxVal, 
        minVal, 
        midPoint, 
        range, 
        dungSai,
        upperLimit: midPoint + dungSai,
        lowerLimit: midPoint - dungSai
      };
    };

    const boundsUpper = calculateBounds(leftChannels.slice(0, 6), rightChannels.slice(0, 6)); // Tay (0-5)
    const boundsLower = calculateBounds(leftChannels.slice(6, 12), rightChannels.slice(6, 12)); // Chân (6-11)

    // --- 2.2 Tính Toán Cờ Trạng Thái (Flags) ---
    const flags: any[] = [];
    for (let i = 0; i < 12; i++) {
      const isUpper = i < 6;
      const bounds = isUpper ? boundsUpper : boundsLower;
      
      const L = leftChannels[i];
      const R = rightChannels[i];
      const avg = (L + R) / 2.0;

      // Cờ C10 (Trung bình)
      let c10 = 0;
      if (avg > bounds.midPoint) c10 = 1;
      else if (avg < bounds.midPoint) c10 = -1;

      // Cờ C8 (Trái)
      let c8 = 0;
      if (L > bounds.upperLimit) c8 = 1;
      else if (L < bounds.lowerLimit) c8 = -1;

      // Cờ C11 (Phải)
      let c11 = 0;
      if (R > bounds.upperLimit) c11 = 1;
      else if (R < bounds.lowerLimit) c11 = -1;

      // Cờ C12 (Lệch 2 Bên)
      let c12 = 0;
      const diff = Math.abs(L - R);
      if (diff > bounds.dungSai) {
        c12 = L > R ? 1 : -1;
      }

      flags.push({ channelIndex: i, channelName: CHANNELS[i], L, R, Avg: avg, c8, c10, c11, c12 });
    }

    // --- 3. Suy luận Âm-Dương & Khí-Huyết ---
    // Âm-Dương (Đọc ở kinh số 8 - Đảm)
    const c10_8 = flags[8].c10;
    let am_duong = 'Bình thường';
    if (c10_8 > 0) am_duong = 'Âm hư';
    else if (c10_8 < 0) am_duong = 'Dương hư';

    // Khí (Đếm số lượng Cờ C10 > 0 ở 6 kinh tay)
    const countKhi = flags.slice(0, 6).filter(f => f.c10 > 0).length;
    let khi = 'Bình thường';
    if (countKhi > 3) khi = 'Khí thịnh';
    else if (countKhi < 3) khi = 'Khí hư';

    // Huyết (Đếm số lượng Cờ C10 > 0 ở 6 kinh chân)
    const countHuyet = flags.slice(6, 12).filter(f => f.c10 > 0).length;
    let huyet = 'Bình thường';
    if (countHuyet > 3) huyet = 'Huyết thịnh';
    else if (countHuyet < 3) huyet = 'Huyết hư';

    // --- 4. Suy Luận Lâm Sàng & Khớp CSDL ---
    const allSyndromes = await this.meridianRepo.find();
    
    const matchedSyndromes = allSyndromes.filter(dbRow => {
      // Kiểm tra 12 kênh x 3 cột = 36 cột. Nếu cột nào !== 0 thì patient phải khớp.
      for (let i = 0; i < 12; i++) {
        const flagPatient = flags[i];
        const chName = CHANNELS[i];

        // Khớp Cờ C8
        const dbC8 = dbRow[`${chName}_c8` as keyof MeridianSyndrome] as number;
        if (dbC8 !== 0 && dbC8 !== null && dbC8 !== undefined) {
          if (dbC8 !== flagPatient.c8) return false;
        }

        // Khớp Cờ C10
        const dbC10 = dbRow[`${chName}` as keyof MeridianSyndrome] as number;
        if (dbC10 !== 0 && dbC10 !== null && dbC10 !== undefined) {
          if (dbC10 !== flagPatient.c10) return false;
        }

        // Khớp Cờ C11
        const dbC11 = dbRow[`${chName}_c11` as keyof MeridianSyndrome] as number;
        if (dbC11 !== 0 && dbC11 !== null && dbC11 !== undefined) {
          if (dbC11 !== flagPatient.c11) return false;
        }
      }
      return true; // Khớp tất cả các giá trị != 0
    });

    return {
      am_duong,
      khi,
      huyet,
      flags,
      syndromes: matchedSyndromes,
    };
  }
}
