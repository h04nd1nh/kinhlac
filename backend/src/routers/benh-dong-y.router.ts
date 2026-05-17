import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { BenhDongYExcelService } from '../controllers/benh-dong-y-excel.controller';

@Controller('benh-dong-y')
export class BenhDongYRouter {
  constructor(private readonly excelService: BenhDongYExcelService) {}

  @Get()
  async findAll() {
    const rows = await this.excelService.findAll();
    return rows.map((r) => BenhDongYRouter.shape(r));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const r = await this.excelService.findOne(id);
    return BenhDongYRouter.shape(r);
  }

  private static shape(r: {
    id: number;
    code: string;
    name: string;
    outputCell: string;
    idPhapTri: number | null;
    phapTri: { id: number; chung_trang: string | null; nguyen_tac: string | null } | null;
    trieuChungList?: { id: number; ten_trieu_chung: string }[];
    baiThuocList?: { id: number; ten_bai_thuoc: string }[];
  }) {
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
      trieu_chung_list: (r.trieuChungList ?? []).map((t) => ({ id: t.id, ten_trieu_chung: t.ten_trieu_chung })),
      bai_thuoc_list: (r.baiThuocList ?? []).map((b) => ({ id: b.id, ten_bai_thuoc: b.ten_bai_thuoc })),
    };
  }
}
