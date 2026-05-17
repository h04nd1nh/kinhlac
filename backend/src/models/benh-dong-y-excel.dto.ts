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
  id_phap_tri?: number | null;
}

export class UpdateBenhDongYExcelDto {
  code?: string;
  name?: string;
  outputCell?: string;
  excelFormula?: string;
  logicExpression?: string;
  sqlCaseText?: string;
  sqlCaseBoolean?: string;
  id_phap_tri?: number | null;
}
