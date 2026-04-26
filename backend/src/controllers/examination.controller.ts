import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Examination } from '../models/examination.model';
import { CreateExaminationDto, UpdateExaminationDto } from '../models/examination.dto';
import { MeridiansService, AnalyzeInputDto } from './meridian.controller';
import { PatientsService } from './patient.controller';

@Injectable()
export class ExaminationsService {
  constructor(
    @InjectRepository(Examination)
    private readonly examinationRepository: Repository<Examination>,
    private readonly meridiansService: MeridiansService,
    private readonly patientsService: PatientsService,
  ) {}

  findAll(): Promise<Examination[]> {
    return this.examinationRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: CreateExaminationDto): Promise<Examination> {
    await this.patientsService.findOne(dto.patientId);

    const analyzeInput: AnalyzeInputDto = {
      tieutruongtrai: dto.tieutruongtrai,
      tieutruongphai: dto.tieutruongphai,
      tamtrai: dto.tamtrai,
      tamphai: dto.tamphai,
      tamtieutrai: dto.tamtieutrai,
      tamtieuphai: dto.tamtieuphai,
      tambaotrai: dto.tambaotrai,
      tambaophai: dto.tambaophai,
      daitrangtrai: dto.daitrangtrai,
      daitrangphai: dto.daitrangphai,
      phetrai: dto.phetrai,
      phephai: dto.phephai,
      bangquangtrai: dto.bangquangtrai,
      bangquangphai: dto.bangquangphai,
      thantrai: dto.thantrai,
      thanphai: dto.thanphai,
      damtrai: dto.damtrai,
      damphai: dto.damphai,
      vitrai: dto.vitrai,
      viphai: dto.viphai,
      cantrai: dto.cantrai,
      canphai: dto.canphai,
      tytrai: dto.tytrai,
      typhai: dto.typhai,
    };

    const result = await this.meridiansService.analyze(analyzeInput);

    const inputData: Record<string, number> = { ...analyzeInput };

    const examination = this.examinationRepository.create({
      patientId: dto.patientId,
      inputData,
      amDuong: result.am_duong,
      khi: result.khi,
      huyet: result.huyet,
      flags: result.flags,
      syndromes: result.syndromes as any[],
      notes: dto.notes ?? null,
    });

    try {
      return await this.examinationRepository.save(examination);
    } catch (error) {
      // 23505 is PostgreSQL unique_violation.
      // If it's a conflict on the primary key, we try to fix the sequence and retry.
      if (
        error.code === '23505' &&
        (error.detail?.includes('Key (id)') || error.constraint?.includes('PK_'))
      ) {
        console.warn('Primary key sequence out of sync, fixing and retrying...');
        await this.fixSequence();
        return await this.examinationRepository.save(examination);
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateExaminationDto): Promise<Examination> {
    const existing = await this.findOne(id);

    const patientId = dto.patientId ?? existing.patientId;
    await this.patientsService.findOne(patientId);

    const analyzeInput: AnalyzeInputDto = {
      tieutruongtrai: dto.tieutruongtrai ?? existing.inputData?.tieutruongtrai ?? 0,
      tieutruongphai: dto.tieutruongphai ?? existing.inputData?.tieutruongphai ?? 0,
      tamtrai: dto.tamtrai ?? existing.inputData?.tamtrai ?? 0,
      tamphai: dto.tamphai ?? existing.inputData?.tamphai ?? 0,
      tamtieutrai: dto.tamtieutrai ?? existing.inputData?.tamtieutrai ?? 0,
      tamtieuphai: dto.tamtieuphai ?? existing.inputData?.tamtieuphai ?? 0,
      tambaotrai: dto.tambaotrai ?? existing.inputData?.tambaotrai ?? 0,
      tambaophai: dto.tambaophai ?? existing.inputData?.tambaophai ?? 0,
      daitrangtrai: dto.daitrangtrai ?? existing.inputData?.daitrangtrai ?? 0,
      daitrangphai: dto.daitrangphai ?? existing.inputData?.daitrangphai ?? 0,
      phetrai: dto.phetrai ?? existing.inputData?.phetrai ?? 0,
      phephai: dto.phephai ?? existing.inputData?.phephai ?? 0,
      bangquangtrai: dto.bangquangtrai ?? existing.inputData?.bangquangtrai ?? 0,
      bangquangphai: dto.bangquangphai ?? existing.inputData?.bangquangphai ?? 0,
      thantrai: dto.thantrai ?? existing.inputData?.thantrai ?? 0,
      thanphai: dto.thanphai ?? existing.inputData?.thanphai ?? 0,
      damtrai: dto.damtrai ?? existing.inputData?.damtrai ?? 0,
      damphai: dto.damphai ?? existing.inputData?.damphai ?? 0,
      vitrai: dto.vitrai ?? existing.inputData?.vitrai ?? 0,
      viphai: dto.viphai ?? existing.inputData?.viphai ?? 0,
      cantrai: dto.cantrai ?? existing.inputData?.cantrai ?? 0,
      canphai: dto.canphai ?? existing.inputData?.canphai ?? 0,
      tytrai: dto.tytrai ?? existing.inputData?.tytrai ?? 0,
      typhai: dto.typhai ?? existing.inputData?.typhai ?? 0,
    };

    const result = await this.meridiansService.analyze(analyzeInput);
    const inputData: Record<string, number> = { ...analyzeInput };

    existing.patientId = patientId;
    existing.inputData = inputData;
    existing.amDuong = result.am_duong;
    existing.khi = result.khi;
    existing.huyet = result.huyet;
    existing.flags = result.flags;
    existing.syndromes = result.syndromes as any[];
    if (dto.notes !== undefined) {
      existing.notes = dto.notes;
    }

    return this.examinationRepository.save(existing);
  }

  async findByPatient(patientId: number): Promise<Examination[]> {
    const exams = await this.examinationRepository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });

    // Cập nhật chẩn đoán tươi cho toàn bộ danh sách
    for (const exam of exams) {
      if (exam.inputData) {
        try {
          const fresh = await this.meridiansService.analyze(exam.inputData as any);
          exam.amDuong = fresh.am_duong;
          exam.khi = fresh.khi;
          exam.huyet = fresh.huyet;
          exam.flags = fresh.flags;
          exam.syndromes = fresh.syndromes as any[];
        } catch (e) {}
      }
    }
    return exams;
  }

  async findOne(id: number): Promise<Examination> {
    const examination = await this.examinationRepository.findOneBy({ id });
    if (!examination) {
      throw new NotFoundException(`Ca khám #${id} không tồn tại`);
    }

    // Tự động phân tích lại theo logic mới nhất để luôn trả về kết quả chính xác nhất
    if (examination.inputData) {
      try {
        const fresh = await this.meridiansService.analyze(examination.inputData as any);
        examination.amDuong = fresh.am_duong;
        examination.khi = fresh.khi;
        examination.huyet = fresh.huyet;
        examination.flags = fresh.flags;
        examination.syndromes = fresh.syndromes as any[];
      } catch (e) {
        console.warn(`Failed to re-analyze examination #${id} on the fly`, e);
      }
    }

    return examination;
  }

  async remove(id: number): Promise<void> {
    const examination = await this.findOne(id);
    await this.examinationRepository.remove(examination);
  }

  async fixSequence(): Promise<any> {
    try {
      const tables = [
        { name: 'examinations', seq: 'examinations_id_seq' },
        { name: 'patients', seq: 'patients_id_seq' },
        { name: 'meridian_syndromes', seq: 'meridian_syndromes_id_seq' },
      ];

      for (const table of tables) {
        await this.examinationRepository.query(
          `SELECT setval('${table.seq}', (SELECT COALESCE(MAX(id), 0) + 1 FROM ${table.name}), false)`,
        );
      }
      
      return { success: true, message: 'Sequences fixed for multiple tables' };
    } catch (error) {
      console.error('Failed to fix sequences:', error);
      return { success: false, error: error.message };
    }
  }
}
