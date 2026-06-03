/*
 * _clean-acu.cjs — LỌC RÁC NHỊ PHÂN trong acupoints.js (tab Huyệt của Từ Điển), TẠI CHỖ.
 *
 * acupoints.js dựng từ raw VentSys ở demo (tools/06-build-acu.js + fix-acu-data.cjs, gitignore) nên
 * KHÔNG có build script trong repo — ta dọn thẳng file tĩnh đã commit. Dùng ĐÚNG bộ lọc của
 * _build-benh.cjs (deGarbage): rác = chuỗi byte ngẫu nhiên (ÿ ¿ Æ # $ @ …) dính ở cuối/giữa câu;
 * GIỮ ° ± ½ ¼ ¾ ~ , đổi \ → /. Làm sạch `noiDung` + mọi `sections[].body` (rác nằm ở 23 huyệt, cả 2 nơi).
 *
 * AN TOÀN: chỉ chạy nếu validate "0 prose-window bị mất" (không cắt nhầm chữ thật). Idempotent
 * (chạy lại trên dữ liệu đã sạch = không đổi). Ghi lại đúng định dạng JSON.stringify(…,2) như cũ.
 *
 * CHẠY:  node _clean-acu.cjs            (validate rồi GHI)
 *        node _clean-acu.cjs --check    (chỉ validate, KHÔNG ghi)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = __dirname;

/* ── bộ lọc giống hệt _build-benh.cjs ── */
const VN_LATIN1 = new Set('ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúý'.split(''));
const KEEP_SYM = new Set('°±½¼¾'.split(''));
const isUniBad = (ch) => {
  const cp = ch.codePointAt(0);
  return cp >= 0x00a1 && cp <= 0x00ff && !KEEP_SYM.has(ch) && !VN_LATIN1.has(ch);
};
const STRONG_ASCII = '#$@*^_`{}|\\';
const isMark = (ch) => isUniBad(ch) || STRONG_ASCII.includes(ch);
const isVN = (ch) => /[A-Za-zÀ-ỹ]/u.test(ch) && !isUniBad(ch);
const isLower = (ch) => isVN(ch) && ch === ch.toLowerCase() && ch !== ch.toUpperCase();
const isTone = (ch) => isVN(ch) && !/[A-Za-zđĐ]/u.test(ch);
const isTerm = (ch) => '.)]”"…!?»'.includes(ch);

function isProse(s, lo, hi) {
  lo = Math.max(0, lo);
  let marks = 0, tones = 0, spaces = 0, letters = 0;
  for (let k = lo; k <= hi && k < s.length; k++) {
    const ch = s[k];
    if (isMark(ch)) marks++;
    if (isTone(ch)) tones++;
    if (ch === ' ' || ch === '\n') spaces++;
    if (isVN(ch)) letters++;
  }
  return spaces >= 2 && marks <= 1 && (tones >= 3 || letters >= 10);
}
function realBoundary(s, idx) {
  if (idx < 0 || !isTerm(s[idx])) return false;
  let k = idx - 1;
  while (k >= 0 && (isTerm(s[k]) || s[k] === "'" || s[k] === '’')) k--;
  if (k >= 0 && (s[k] === '%' || s[k] === '°')) k--;
  if (k >= 0 && /[0-9]/.test(s[k])) return true;
  let letters = 0, lower = false;
  while (k >= 0 && isVN(s[k])) { letters++; if (isLower(s[k])) lower = true; k--; }
  return letters >= 2 && lower;
}
const proseAt = (s, p) => p + 1 < s.length && isProse(s, p, p + 17);
function toneWordEndsAt(s, idx) {
  let letters = 0, lowTone = false;
  for (let k = idx; k >= 0 && isVN(s[k]); k--) { letters++; if (isLower(s[k]) && isTone(s[k])) lowTone = true; }
  return letters >= 2 && lowTone;
}
function skipRightLeak(s, j) {
  let k = j, low = 0;
  while (k < s.length && isLower(s[k]) && low < 3) { k++; low++; }
  if (low > 0 && low <= 2 && k < s.length && isVN(s[k]) && !isLower(s[k])) return k;
  return j;
}
function removeGarbage(s, drops) {
  const n = s.length;
  if (n < 18) return s;
  const covered = new Array(n).fill(false);
  let any = false;
  for (let a = 0; a + 1 < n; a++) {
    if (isProse(s, a, a + 17)) { any = true; for (let k = a; k <= a + 17 && k < n; k++) covered[k] = true; }
  }
  if (!any) return s;
  const zones = [];
  for (let m = 0; m < n; m++) {
    if (!isMark(s[m])) continue;
    if (m > 0 && m < n - 1 && isVN(s[m - 1]) && isVN(s[m + 1])) continue;
    if (covered[m] && proseAt(s, m + 1)) continue;
    let left = m, found = false;
    for (let q = m; q >= Math.max(1, m - 40); q--) {
      if (q >= 2 && !covered[q - 2]) continue;
      if (realBoundary(s, q - 1)) { left = q; found = true; break; }
      if ((s[q - 1] === ' ' || s[q - 1] === '\n') && toneWordEndsAt(s, q - 2)) { left = q; found = true; break; }
    }
    if (!found) for (let q = m; q >= Math.max(1, m - 40); q--) if (s[q - 1] === ' ' || s[q - 1] === '\n') { left = q; break; }
    let right = m + 1;
    while (right < n && !proseAt(s, right)) right++;
    right = skipRightLeak(s, right);
    zones.push([left, right]);
  }
  if (!zones.length) return s;
  zones.sort((a, b) => a[0] - b[0]);
  let out = '', cur = 0;
  for (const [a, b] of zones) {
    if (a > cur) { out += s.slice(cur, a); cur = a; }
    if (b > cur) { if (drops) drops.push(s.slice(cur, b)); cur = b; }
  }
  return out + s.slice(cur);
}
function deGarbage(s, drops) {
  let r = removeGarbage(s || '', drops);
  r = r.replace(/\\/g, '/').replace(/\t/g, ' ');
  let out = '';
  for (const ch of r) if (!isMark(ch)) out += ch;
  return out.replace(/ {2,}/g, ' ');
}
// chuỗi bị bỏ có chứa văn xuôi thật? (= mất chữ → CHẶN ghi)
function suspectLegit(d) {
  for (let i = 0; i + 1 < d.length; i++) if (isProse(d, i, i + 17)) return true;
  return false;
}

/* ── chạy ── */
const CHECK = process.argv.includes('--check');
const file = path.join(D, 'acupoints.js');
const orig = fs.readFileSync(file, 'utf8');
global.window = {};
require('./acupoints.js');
const A = global.window.ACUPOINTS;

const drops = [];
let cleanedFields = 0;
const clean1 = (v) => {
  if (typeof v !== 'string') return v;
  let hasMark = false;
  for (const ch of v) if (isMark(ch)) { hasMark = true; break; }
  if (!hasMark) return v; // sạch sẵn → GIỮ NGUYÊN 100% (không đụng khoảng trắng/định dạng)
  const c = deGarbage(v, drops);
  if (c !== v) cleanedFields++;
  return c;
};
for (const r of A.records) {
  r.noiDung = clean1(r.noiDung);
  for (const s of r.sections || []) s.body = clean1(s.body);
}

// kiểm an toàn
let residue = 0;
for (const r of A.records) {
  const fields = [r.noiDung, ...(r.sections || []).map((s) => s.body)];
  for (const v of fields) if (typeof v === 'string') for (const ch of v) if (isMark(ch)) { residue++; break; }
}
const suspects = drops.filter(suspectLegit);

console.log(`Trường đã làm sạch : ${cleanedFields}`);
console.log(`Marker rác còn lại : ${residue}`);
console.log(`Đoạn bỏ NGHI là chữ thật (phải = 0): ${suspects.length}`);
for (const s of suspects.slice(0, 10)) console.log('  ⚠ ' + JSON.stringify(s.slice(0, 80)));

if (CHECK) { console.log('\n--check: KHÔNG ghi.'); process.exit(0); }
if (suspects.length > 0) {
  console.error('\n✗ HỦY GHI: có đoạn nghi là chữ thật bị cắt. Xem lại bộ lọc.');
  process.exit(1);
}
const out = 'window.ACUPOINTS = ' + JSON.stringify(A, null, 2) + ';\n';
if (out === orig) { console.log('\n✔ Đã sạch sẵn — không có gì để đổi.'); process.exit(0); }
fs.writeFileSync(file, out, 'utf8');
console.log(`\n✔ ĐÃ GHI acupoints.js (${orig.length} → ${out.length} byte).`);
