import { Body, Controller, Post } from '@nestjs/common';
import { BenhDongYExcelService } from '../controllers/benh-dong-y-excel.controller';
import { DiagnoseBenhDongYExcelDto } from '../models/benh-dong-y-excel.dto';

@Controller('benh-dong-y-excel')
export class BenhDongYExcelRouter {
  constructor(private readonly service: BenhDongYExcelService) {}

  @Post('chan-doan')
  diagnose(@Body() dto: DiagnoseBenhDongYExcelDto & Record<string, unknown>) {
    const input = dto.chi_so && typeof dto.chi_so === 'object' ? dto.chi_so : dto;
    return this.service.diagnose(input as Record<string, unknown>);
  }
}
