export class DiagnoseBenhDongYExcelDto {
  chi_so?: Record<string, number | string | null | undefined>;
}

export type InputChiSo = Record<string, number>;

export class CreateBenhDongYExcelDto {
  code: string;
  name: string;
  outputCell: string;
  excelFormula: string;
  logicExpression: string;
  sqlCaseText: string;
  sqlCaseBoolean: string;
}

export class UpdateBenhDongYExcelDto {
  code?: string;
  name?: string;
  outputCell?: string;
  excelFormula?: string;
  logicExpression?: string;
  sqlCaseText?: string;
  sqlCaseBoolean?: string;
}
