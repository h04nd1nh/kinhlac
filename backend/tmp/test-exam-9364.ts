/**
 * Chạy engine mới với data thực của exam 9364 trên TẤT CẢ 29 rule từ dongyhiendai.md.
 * In ra rule nào match, rule nào không, và vì sao.
 */
import { evaluateLogicExpression } from '../src/utils/excel-rule-engine';

// === Tính cells từ inputData của exam 9364 ===
const data = {
  tieutruongtrai: 35, tieutruongphai: 34.6,
  tamtrai: 35.1, tamphai: 34.7,
  tamtieutrai: 34.3, tamtieuphai: 33.9,
  tambaotrai: 34.9, tambaophai: 34.7,
  daitrangtrai: 35, daitrangphai: 34.2,
  phetrai: 34.4, phephai: 34.3,
  bangquangtrai: 28.7, bangquangphai: 33.1,
  thantrai: 29.7, thanphai: 33.9,
  damtrai: 29.7, damphai: 33.9,
  vitrai: 29.8, viphai: 32.7,
  cantrai: 31.4, canphai: 33.2,
  tytrai: 31.9, typhai: 33.2,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const d10 = round2((data.tieutruongtrai + data.tieutruongphai) / 2);
const d11 = round2((data.tamtrai + data.tamphai) / 2);
const d12 = round2((data.tamtieutrai + data.tamtieuphai) / 2);
const d13 = round2((data.tambaotrai + data.tambaophai) / 2);
const d14 = round2((data.daitrangtrai + data.daitrangphai) / 2);
const d15 = round2((data.phetrai + data.phephai) / 2);
const upperVals = [data.tieutruongtrai, data.tieutruongphai, data.tamtrai, data.tamphai,
  data.tamtieutrai, data.tamtieuphai, data.tambaotrai, data.tambaophai,
  data.daitrangtrai, data.daitrangphai, data.phetrai, data.phephai].filter(v => v > 0);
const a7 = Math.max(...upperVals), a8 = Math.min(...upperVals);
const d7 = round2((a7 + a8) / 2);
const e7 = round2((a7 - a8) / 6);

const d21 = round2((data.bangquangtrai + data.bangquangphai) / 2);
const d22 = round2((data.thantrai + data.thanphai) / 2);
const d23 = round2((data.damtrai + data.damphai) / 2);
const d24 = round2((data.vitrai + data.viphai) / 2);
const d25 = round2((data.cantrai + data.canphai) / 2);
const d26 = round2((data.tytrai + data.typhai) / 2);
const lowerVals = [data.bangquangtrai, data.bangquangphai, data.thantrai, data.thanphai,
  data.damtrai, data.damphai, data.vitrai, data.viphai,
  data.cantrai, data.canphai, data.tytrai, data.typhai].filter(v => v > 0);
const a18 = Math.max(...lowerVals), a19 = Math.min(...lowerVals);
const d18 = round2((a18 + a19) / 2);
const e18 = round2((a18 - a19) / 6);

const input: Record<string, number> = {
  D7: d7, D18: d18,
  E7: e7,
  E10: round2(d10 - d7), E11: round2(d11 - d7), E12: round2(d12 - d7),
  E13: round2(d13 - d7), E14: round2(d14 - d7), E15: round2(d15 - d7),
  E18: e18,
  E21: round2(d21 - d18), E22: round2(d22 - d18), E23: round2(d23 - d18),
  E24: round2(d24 - d18), E25: round2(d25 - d18), E26: round2(d26 - d18),
  H10: round2(Math.abs(data.tieutruongtrai - data.tieutruongphai)),
  H11: round2(Math.abs(data.tamtrai - data.tamphai)),
  H12: round2(Math.abs(data.tamtieutrai - data.tamtieuphai)),
  H13: round2(Math.abs(data.tambaotrai - data.tambaophai)),
  H14: round2(Math.abs(data.daitrangtrai - data.daitrangphai)),
  H15: round2(Math.abs(data.phetrai - data.phephai)),
  H21: round2(Math.abs(data.bangquangtrai - data.bangquangphai)),
  H22: round2(Math.abs(data.thantrai - data.thanphai)),
  H23: round2(Math.abs(data.damtrai - data.damphai)),
  H24: round2(Math.abs(data.vitrai - data.viphai)),
  H25: round2(Math.abs(data.cantrai - data.canphai)),
  H26: round2(Math.abs(data.tytrai - data.typhai)),
  AN10: round2(data.tieutruongtrai - d7), AQ10: round2(data.tieutruongphai - d7),
  AN11: round2(data.tamtrai - d7),         AQ11: round2(data.tamphai - d7),
  AN12: round2(data.tamtieutrai - d7),     AQ12: round2(data.tamtieuphai - d7),
  AN13: round2(data.tambaotrai - d7),      AQ13: round2(data.tambaophai - d7),
  AN14: round2(data.daitrangtrai - d7),    AQ14: round2(data.daitrangphai - d7),
  AN15: round2(data.phetrai - d7),         AQ15: round2(data.phephai - d7),
  AN21: round2(data.bangquangtrai - d18),  AQ21: round2(data.bangquangphai - d18),
  AN22: round2(data.thantrai - d18),       AQ22: round2(data.thanphai - d18),
  AN23: round2(data.damtrai - d18),        AQ23: round2(data.damphai - d18),
  AN24: round2(data.vitrai - d18),         AQ24: round2(data.viphai - d18),
  AN25: round2(data.cantrai - d18),        AQ25: round2(data.canphai - d18),
  AN26: round2(data.tytrai - d18),         AQ26: round2(data.typhai - d18),
};

console.log('== Input cells exam 9364 ==');
console.log(input);
console.log();

const rules: Array<[string, string, string]> = [
  ['HD001','Giãn động Mạch Vành','OR(AND(E10<0;E11>0;E15<0);AND(E13>0;E15<0);AND(E11>0;E13>0;E15<0))'],
  ['HD002','Bệnh Tuyến Giáp đơn thuần','E11>0 AND E15>0 AND E25>0'],
  ['HD003','Bệnh cường Tuyến Giáp','E11>0 AND E15>0 AND E23>0 AND E25>0'],
  ['HD004','Bệnh suy Tuyến Giáp','E11>0 AND E15>0 AND E23<0 AND E25>0'],
  ['HD005','Đau lưng do viêm đại tràng','E13>0 AND E14>0 AND E15>0 AND LEN(AP14)>0 AND OR(AND(AN21*AQ21<0;AN22*AQ22<0);AND(AN21*AQ21>0;AN22*AQ22>0;H21>D18;H22>D18))'],
  ['HD006','Bệnh cảm cúm','E11>0 AND E15>0 AND E25>0 AND E26>0'],
  ['HD007','Chứng viêm','E11>0 AND E13>0 AND E14>0 AND E15>0'],
  ['HD008','Khối kết','E10<0 AND E11<0 AND E12<0 AND ABS(E10)>E7 AND ABS(E11)>E7 AND ABS(E12)>E7 AND E13>0 AND E14>0 AND E15>0'],
  ['HD009','Ký Sinh Trùng đường ruột','E23<0'],
  ['HD010','Viêm cấp tính đường Tiết Niệu','E15>0 AND E21>0'],
  ['HD011','Công năng Tình Dục tăng tiến','E13>0 AND E22>0 AND E23>0 AND E24>0 AND E25>0 AND E26>0'],
  ['HD012','Phù nề dạ dày','E22>0 AND E23<0 AND E24<0 AND E25>0 AND E26<0'],
  ['HD013','Bệnh đốt sống cổ','OR(AND(B10="+";G10="0";B11="-";G11="+";B12="-";G12="+");AND(B10="-";G10="-";B11="+";G11="-";B12="-";G12="0");AND(B10="-";G10="0";B11="-";G11="+";B12="+";G12="0");AND(B10="-";G10="-";B11="-";G11="-";B12="-";G12="0");AND(B10="-";G10="-";E10<0;B11="+";E11=0;G11="-";B12="-";E12<0;G12="-"))'],
  ['HD014','Bệnh đau lưng','OR(AND(AN21*AQ21<0;AN22*AQ22<0);AND(AN21*AQ21>0;AN22*AQ22>0;H21>D18;H22>D18))'],
  ['HD015','Đau lưng do trĩ','E13>0 AND E14>0 AND E15>0 AND AN14*AQ14<0 AND H14>D7 AND OR(AND(AN21*AQ21<0;AN22*AQ22<0);AND(AN21*AQ21>0;AN22*AQ22>0;H21>D18;H22>D18))'],
  ['HD016','Đau lưng do thoái hóa đĩa đệm','E23>0 AND AN23*AQ23<0 AND OR(AND(AN21*AQ21<0;AN22*AQ22<0);AND(AN21*AQ21>0;AN22*AQ22>0;H21>D18;H22>D18))'],
  ['HD017','Đau lưng do Thận hư','E23<0 AND E21<0 AND E22<0 AND AN23*AQ23<0 AND OR(AND(AN21*AQ21<0;AN22*AQ22<0);AND(AN21*AQ21>0;AN22*AQ22>0;H21>D18;H22>D18))'],
  ['HD018','Đau lưng do tổn thương phần mềm','E25>0 AND E26>0 AND AN25*AQ25<0 AND AN26*AQ26<0 AND OR(AND(AN21*AQ21<0;AN22*AQ22<0);AND(AN21*AQ21>0;AN22*AQ22>0;H21>D18;H22>D18))'],
  ['HD019','RLCG Họng do suy Tuyến Giáp','E11>E7 AND E15>E7 AND E25>E18 AND E23<0 AND ABS(E23)>E18'],
  ['HD020','RLCG Họng do cường Tuyến Giáp','E11>E8 AND E15>E8 AND E25>E18 AND E23>E18'],
  ['HD021','RLCG Họng do cường Tuyến Giáp nặng','E11>E9 AND E15>E9 AND E25>E18 AND E23>E18 AND E13>0 AND E14>0 AND E15>0'],
  ['HD022','Bệnh tình chí','E11>E7 AND E13>0 AND E11>E13'],
  ['HD023','Bệnh do tình chí','OR(E11>0;AND(E11>0;E13<0))'],
  ['HD024','Tức giận thành bệnh','E11>0 AND E25>0'],
  ['HD025','Lo nghĩ thành bệnh','E11>0 AND E26>0'],
  ['HD026','Tiếc xót thành bệnh','E11>0 AND E22>0'],
  ['HD027','Buồn thành bệnh','E11>0 AND E15>0'],
  ['HD028','Oan uất thành bệnh','E11>0 AND E15>0 AND E23<0 AND E25>0'],
  ['HD029','Bệnh thần kinh chức năng','E13>0 AND E13>E11'],
];

const matched: string[] = [];
const skipped: string[] = [];
for (const [code, name, expr] of rules) {
  const ok = evaluateLogicExpression(expr, input);
  const mark = ok ? 'MATCH' : '     ';
  console.log(`${mark}  ${code}  ${name}`);
  if (ok) matched.push(`${code} - ${name}`);
  else skipped.push(code);
}

console.log(`\n=== ${matched.length} matched ===`);
matched.forEach((m) => console.log('  ✓', m));
