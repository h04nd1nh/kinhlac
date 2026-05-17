import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { BenhDongYExcelService } from '../controllers/benh-dong-y-excel.controller';

@Controller('benh-dong-y')
export class BenhDongYRouter {
  constructor(private readonly excelService: BenhDongYExcelService) {}

  @Get()
  async findAll() {
    const rows = await this.excelService.findAll();
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      outputCell: r.outputCell,
      idPhapTri: r.idPhapTri,
      phapTri: r.phapTri
        ? {
            id: r.phapTri.id,
            chung_trang: r.phapTri.chung_trang,
            nguyen_tac: r.phapTri.nguyen_tac,
          }
        : null,
    }));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const r = await this.excelService.findOne(id);
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      outputCell: r.outputCell,
      idPhapTri: r.idPhapTri,
      phapTri: r.phapTri
        ? {
            id: r.phapTri.id,
            chung_trang: r.phapTri.chung_trang,
            nguyen_tac: r.phapTri.nguyen_tac,
          }
        : null,
    };
  }
}
