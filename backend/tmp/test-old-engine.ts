// Mô phỏng đúng engine CŨ của production để xem nó có match HD001 không
type CmpOp = '>' | '<' | '>=' | '<=' | '=' | '!=';

function parseClauseOld(clause: string): { left: string; operator: CmpOp; right: string } {
  const normalized = clause.trim().replace(/^\(+|\)+$/g, '');
  const m = normalized.match(/^(ABS\([A-Za-z][A-Za-z0-9]*\)|[A-Za-z][A-Za-z0-9]*|-?\d+(?:\.\d+)?)\s*(>=|<=|!=|=|>|<)\s*(ABS\([A-Za-z][A-Za-z0-9]*\)|[A-Za-z][A-Za-z0-9]*|-?\d+(?:\.\d+)?)$/);
  if (!m) throw new Error(`Không parse được mệnh đề: ${clause}`);
  return { left: m[1], operator: m[2] as CmpOp, right: m[3] };
}

function resolveOperandOld(operand: string, input: Record<string, number>): number | null {
  const absMatch = operand.match(/^ABS\(([A-Za-z][A-Za-z0-9]*)\)$/);
  if (absMatch) {
    const v = input[absMatch[1].toUpperCase()];
    return Number.isFinite(v) ? Math.abs(v) : null;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(operand)) return Number(operand);
  const v = input[operand.toUpperCase()];
  return Number.isFinite(v) ? v : null;
}

function compareOld(left: number, op: CmpOp, right: number): boolean {
  switch (op) {
    case '>': return left > right;
    case '<': return left < right;
    case '>=': return left >= right;
    case '<=': return left <= right;
    case '=': return left === right;
    case '!=': return left !== right;
  }
}

function evaluateRuleOld(logic: string, input: Record<string, number>): boolean {
  const clauses = logic.split(/\s+AND\s+/i).map((x) => x.trim()).filter(Boolean);
  if (!clauses.length) return false;
  for (const c of clauses) {
    let parsed;
    try { parsed = parseClauseOld(c); } catch { return false; }
    const l = resolveOperandOld(parsed.left, input);
    const r = resolveOperandOld(parsed.right, input);
    if (l === null || r === null) return false;
    if (!compareOld(l, parsed.operator, r)) return false;
  }
  return true;
}

const exam9364: Record<string, number> = {
  E7: 0.2, E10: 0.3, E11: 0.4, E12: -0.4, E13: 0.3, E14: 0.1, E15: -0.15,
  E18: 0.87, E21: -0.4, E22: 0.5, E23: 0.5, E24: -0.05, E25: 1, E26: 1.25,
};

const HD001 = 'OR(AND(E10<0;E11>0;E15<0);AND(E13>0;E15<0);AND(E11>0;E13>0;E15<0))';
console.log('HD001 old-engine match?', evaluateRuleOld(HD001, exam9364));

// Test the split behaviour
console.log('split result:', HD001.split(/\s+AND\s+/i));
