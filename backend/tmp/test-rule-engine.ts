/**
 * Smoke test nhanh cho excel-rule-engine.
 * Chạy: cd backend && npx ts-node tmp/test-rule-engine.ts
 */
import { evaluateLogicExpression } from '../src/utils/excel-rule-engine';

let pass = 0;
let fail = 0;

function check(label: string, expr: string, input: Record<string, number>, expected: boolean) {
  const got = evaluateLogicExpression(expr, input);
  const ok = got === expected;
  if (ok) {
    pass++;
    console.log(`✓ ${label}`);
  } else {
    fail++;
    console.error(`✗ ${label}\n    expr=${expr}\n    input=${JSON.stringify(input)}\n    expected=${expected} got=${got}`);
  }
}

// HD001 – Giãn động Mạch Vành
const HD001 = 'OR(AND(E10<0;E11>0;E15<0);AND(E13>0;E15<0);AND(E11>0;E13>0;E15<0))';
// Exam 9364 thực tế: E10=+0.3 E11=+0.4 E13=+0.3 E15=-0.15
check('HD001 — exam 9364 (E13>0,E15<0)', HD001,
  { E10: 0.3, E11: 0.4, E13: 0.3, E15: -0.15 }, true);
check('HD001 — clause1 only', HD001,
  { E10: -1, E11: 1, E13: -1, E15: -1 }, true);
check('HD001 — none match', HD001,
  { E10: 1, E11: -1, E13: -1, E15: 1 }, false);

// Top-level AND chain
check('AND chain — all true', 'E11>E7 AND E15>E7 AND E25>E18',
  { E11: 2, E15: 2, E7: 1, E25: 2, E18: 1 }, true);
check('AND chain — one false', 'E11>E7 AND E15>E7 AND E25>E18',
  { E11: 2, E15: 2, E7: 1, E25: 0, E18: 1 }, false);

// ABS
check('ABS — true', 'E10<0 AND ABS(E10)>E7',
  { E10: -3, E7: 2 }, true);
check('ABS — false', 'E10<0 AND ABS(E10)>E7',
  { E10: -1, E7: 2 }, false);

// HD016 — multiplication
const HD016 = 'OR(AND(AN21*AQ21<0;AN22*AQ22<0);AND(AN21*AQ21>0;AN22*AQ22>0;H21>D18;H22>D18))';
check('HD016 — both products negative', HD016,
  { AN21: 2, AQ21: -1, AN22: -1, AQ22: 3 }, true);
check('HD016 — both positive + H>D', HD016,
  { AN21: 2, AQ21: 3, AN22: 2, AQ22: 1, H21: 5, H22: 4, D18: 3 }, true);
check('HD016 — neither branch', HD016,
  { AN21: 2, AQ21: 3, AN22: 2, AQ22: 1, H21: 1, H22: 1, D18: 3 }, false);

// Top-level AND with nested OR (HD017 shape)
const HD017 = 'E13>0 AND E14>0 AND E15>0 AND AN14*AQ14<0 AND H14>D7 AND OR(AND(AN21*AQ21<0;AN22*AQ22<0);AND(AN21*AQ21>0;AN22*AQ22>0;H21>D18;H22>D18))';
check('HD017 — passes via OR branch 1', HD017,
  { E13: 1, E14: 1, E15: 1, AN14: 1, AQ14: -1, H14: 5, D7: 1,
    AN21: 2, AQ21: -1, AN22: -1, AQ22: 3 }, true);
check('HD017 — fails on top-level AND', HD017,
  { E13: -1, E14: 1, E15: 1, AN14: 1, AQ14: -1, H14: 5, D7: 1,
    AN21: 2, AQ21: -1, AN22: -1, AQ22: 3 }, false);

// Unsupported function (LEN) — clause fails, OR still passes via other branch
const HD002 = 'E13>0 AND E14>0 AND E15>0 AND LEN(AP14)>0';
check('LEN(...) unknown → toàn cụm AND fails', HD002,
  { E13: 1, E14: 1, E15: 1 }, false);

// String compare
check('String "=" true', 'B10="+"', { } as any, false); // string left, no input
check('Empty expr → false', '', {}, false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
