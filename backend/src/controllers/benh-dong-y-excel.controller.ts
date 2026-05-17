import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { BenhDongYExcel } from '../models/benh-dong-y-excel.model';
import {
  CreateBenhDongYExcelDto,
  InputChiSo,
  UpdateBenhDongYExcelDto,
} from '../models/benh-dong-y-excel.dto';

type RuleClause = {
  left: string;
  operator: '>' | '<' | '>=' | '<=' | '=' | '!=';
  right: string;
};

@Injectable()
export class BenhDongYExcelService {
  constructor(
    @InjectRepository(BenhDongYExcel)
    private readonly repo: Repository<BenhDongYExcel>,
  ) {}

  private static isUniqueViolation(err: unknown): boolean {
    return (
      err instanceof QueryFailedError &&
      (err as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505'
    );
  }

  async findAll(): Promise<BenhDongYExcel[]> {
    return this.repo.find({ order: { id: 'ASC' }, relations: { phapTri: true } });
  }

  async findOne(id: number): Promise<BenhDongYExcel> {
    const row = await this.repo.findOne({ where: { id }, relations: { phapTri: true } });
    if (!row) {
      throw new NotFoundException(`Không tìm thấy quy tắc id=${id}`);
    }
    return row;
  }

  private normalizePhapTriId(raw: unknown): number | null | undefined {
    if (raw === undefined) return undefined;
    if (raw === null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  async create(dto: CreateBenhDongYExcelDto): Promise<BenhDongYExcel> {
    const required: (keyof CreateBenhDongYExcelDto)[] = [
      'code',
      'name',
      'outputCell',
      'excelFormula',
      'logicExpression',
      'sqlCaseText',
      'sqlCaseBoolean',
    ];
    for (const k of required) {
      const v = dto[k];
      if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
        throw new BadRequestException(`Thiếu hoặc rỗng trường bắt buộc: ${String(k)}`);
      }
    }

    const idPhapTri = this.normalizePhapTriId(dto.id_phap_tri);
    const entity = this.repo.create({
      code: dto.code.trim(),
      name: dto.name.trim(),
      outputCell: dto.outputCell.trim(),
      excelFormula: dto.excelFormula,
      logicExpression: dto.logicExpression,
      sqlCaseText: dto.sqlCaseText,
      sqlCaseBoolean: dto.sqlCaseBoolean,
      idPhapTri: idPhapTri === undefined ? null : idPhapTri,
    });
    try {
      const saved = await this.repo.save(entity);
      return this.findOne(saved.id);
    } catch (err) {
      if (BenhDongYExcelService.isUniqueViolation(err)) {
        throw new ConflictException(`Mã code "${entity.code}" đã tồn tại.`);
      }
      throw err;
    }
  }

  async update(id: number, dto: UpdateBenhDongYExcelDto): Promise<BenhDongYExcel> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Không tìm thấy quy tắc id=${id}`);
    }
    if (dto.code !== undefined) entity.code = dto.code.trim();
    if (dto.name !== undefined) entity.name = dto.name.trim();
    if (dto.outputCell !== undefined) entity.outputCell = dto.outputCell.trim();
    if (dto.excelFormula !== undefined) entity.excelFormula = dto.excelFormula;
    if (dto.logicExpression !== undefined) entity.logicExpression = dto.logicExpression;
    if (dto.sqlCaseText !== undefined) entity.sqlCaseText = dto.sqlCaseText;
    if (dto.sqlCaseBoolean !== undefined) entity.sqlCaseBoolean = dto.sqlCaseBoolean;
    const idPhapTri = this.normalizePhapTriId(dto.id_phap_tri);
    if (idPhapTri !== undefined) {
      entity.idPhapTri = idPhapTri;
    }
    try {
      await this.repo.save(entity);
      return this.findOne(id);
    } catch (err) {
      if (BenhDongYExcelService.isUniqueViolation(err)) {
        throw new ConflictException(`Mã code "${entity.code}" đã tồn tại.`);
      }
      throw err;
    }
  }

  async remove(id: number): Promise<void> {
    const res = await this.repo.delete(id);
    if (!res.affected) {
      throw new NotFoundException(`Không tìm thấy quy tắc id=${id}`);
    }
  }

  private normalizeInput(raw: Record<string, unknown>): InputChiSo {
    const result: InputChiSo = {};

    for (const [key, value] of Object.entries(raw)) {
      if (value === null || value === undefined || value === '') continue;
      const num = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(num)) {
        result[key.toUpperCase()] = num;
      }
    }

    return result;
  }

  private parseClause(clause: string): RuleClause {
    const normalized = clause.trim().replace(/^\(+|\)+$/g, '');
    const m = normalized.match(/^(ABS\([A-Za-z][A-Za-z0-9]*\)|[A-Za-z][A-Za-z0-9]*|-?\d+(?:\.\d+)?)\s*(>=|<=|!=|=|>|<)\s*(ABS\([A-Za-z][A-Za-z0-9]*\)|[A-Za-z][A-Za-z0-9]*|-?\d+(?:\.\d+)?)$/);
    if (!m) {
      throw new BadRequestException(`Không parse được mệnh đề: ${clause}`);
    }
    return {
      left: m[1],
      operator: m[2] as RuleClause['operator'],
      right: m[3],
    };
  }

  private resolveOperand(operand: string, input: InputChiSo): number | null {
    const absMatch = operand.match(/^ABS\(([A-Za-z][A-Za-z0-9]*)\)$/);
    if (absMatch) {
      const v = input[absMatch[1].toUpperCase()];
      return Number.isFinite(v) ? Math.abs(v) : null;
    }

    if (/^-?\d+(?:\.\d+)?$/.test(operand)) {
      return Number(operand);
    }

    const v = input[operand.toUpperCase()];
    return Number.isFinite(v) ? v : null;
  }

  private compare(left: number, op: RuleClause['operator'], right: number): boolean {
    switch (op) {
      case '>':
        return left > right;
      case '<':
        return left < right;
      case '>=':
        return left >= right;
      case '<=':
        return left <= right;
      case '=':
        return left === right;
      case '!=':
        return left !== right;
      default:
        return false;
    }
  }

  private evaluateRule(logicExpression: string, input: InputChiSo): boolean {
    const clauses = logicExpression
      .split(/\s+AND\s+/i)
      .map((x) => x.trim())
      .filter(Boolean);

    if (!clauses.length) return false;

    for (const rawClause of clauses) {
      const clause = this.parseClause(rawClause);
      const left = this.resolveOperand(clause.left, input);
      const right = this.resolveOperand(clause.right, input);
      if (left === null || right === null) {
        return false;
      }
      if (!this.compare(left, clause.operator, right)) {
        return false;
      }
    }

    return true;
  }

  async diagnose(rawInput: Record<string, unknown>) {
    const input = this.normalizeInput(rawInput);
    if (!Object.keys(input).length) {
      throw new BadRequestException('Thiếu chỉ số đầu vào hợp lệ.');
    }

    const rules = await this.repo.find({ order: { id: 'ASC' } });
    const matched = rules
      .filter((rule) => this.evaluateRule(rule.logicExpression, input))
      .map((rule) => ({
        id: rule.id,
        code: rule.code,
        name: rule.name,
        outputCell: rule.outputCell,
        logicExpression: rule.logicExpression,
      }));

    return {
      success: true,
      total_rules: rules.length,
      matched_count: matched.length,
      matched,
    };
  }
}
