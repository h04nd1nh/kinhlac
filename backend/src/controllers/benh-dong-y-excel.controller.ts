import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BenhDongYExcel } from '../models/benh-dong-y-excel.model';
import { InputChiSo } from '../models/benh-dong-y-excel.dto';

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
      }));

    return {
      success: true,
      total_rules: rules.length,
      matched_count: matched.length,
      matched,
    };
  }
}
