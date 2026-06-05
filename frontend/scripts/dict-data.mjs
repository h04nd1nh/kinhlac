// dict-data.mjs — LỚP DỮ LIỆU CHUNG cho từ điển (huyệt vị + đường kinh).
//
// Một nguồn sự thật cho cả 3 dây chuyền: build-dict.mjs (sinh HTML), gen-sitemap.mjs
// (liệt kê URL), indexnow.mjs (ping). Tách "model" (load + phân loại + quyết noindex +
// slug) khỏi "view" (render HTML) → sitemap/IndexNow & trang luôn KHỚP nhau.
//
// Khớp huyệt↔kinh & mã WHO theo ID/MÃ qua acu-index.js (ACU_INDEX) — KHÔNG khớp theo tên
// bỏ dấu (tránh Trung Chú≠Trung Chử, Quản≠Quan). corrupt/thin → noindex.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '..', 'public/kinhmach3d/data')

export const MIN_BODY_CHARS = 200 // dưới ngưỡng → noindex (chống thin/doorway trên site YMYL)
export const LOAI_LABEL = { kinh: 'Kinh huyệt', ky: 'Kỳ huyệt (ngoài 12 đường kinh)', athi: 'A Thị huyệt' }

// (rawKey, nhãn hiển thị, đóng khung cảnh báo thủ thuật?) — DÙNG CHUNG cho render & tính bodyLen.
export const HUYET_SECTIONS = [
  ['TÊN HUYỆT', 'Ý Nghĩa Tên Huyệt', false],
  ['ĐẶC TÍNH', 'Đặc Tính', false],
  ['VỊ TRÍ', 'Vị Trí', false],
  ['GIẢI PHẪU', 'Giải Phẫu', false],
  ['TÁC DỤNG', 'Tác Dụng', false],
  ['CHỦ TRỊ', 'Chủ Trị', false],
  ['CHÂM CỨU', 'Cách Châm Cứu', true],
  ['XUẤT XỨ', 'Xuất Xứ', false],
]
// Render MỌI field có mặt (12 chính kinh: desc/chinh/can…; mạch: dacTinh/vanHanh/trieuChung).
export const KINH_SECTIONS = [
  ['desc', 'Đại Cương', false],
  ['dacTinh', 'Đặc Tính', false],
  ['vanHanh', 'Vận Hành', false],
  ['chinh', 'Đường Kinh Chính', false],
  ['can', 'Kinh Cân', false],
  ['biet', 'Kinh Biệt', false],
  ['doc', 'Lạc Dọc', false],
  ['ngang', 'Lạc Ngang', false],
  ['trieuChung', 'Triệu Chứng / Chủ Trị', false],
  ['chuTri', 'Chủ Trị', false],
  ['dieuTri', 'Điều Trị', true],
]

// ───────────────────────── Đọc dữ liệu gốc (window.X = {JSON}) ──────────────
function loadGlobalJson(file) {
  const txt = readFileSync(join(dataDir, file), 'utf8')
  const a = txt.indexOf('{')
  const b = txt.lastIndexOf('}')
  if (a < 0 || b <= a) throw new Error(`Không tìm thấy object JSON trong ${file}`)
  return JSON.parse(txt.slice(a, b + 1))
}
export const ACU = loadGlobalJson('acupoints.js')
export const MER = loadGlobalJson('meridians.js')
export const IDX = loadGlobalJson('acu-index.js') // { codeToId, points:[{id,code,corrupt,hasViTri}], merVi }

// ───────────────────────── Chuẩn hoá tên (slug & dò A Thị) ──────────────────
export const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
export const fold = (s) => norm(s).replace(/[^a-z0-9]+/g, ' ').trim()
export function slugify(s) {
  return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'muc'
}

// ───────────────────────── Chỉ mục theo ID (chuẩn, hết nhập nhằng dấu) ───────
export const idxById = new Map()
for (const p of IDX.points || []) idxById.set(p.id, { code: p.code || '', corrupt: !!p.corrupt, hasViTri: !!p.hasViTri })
export const codeToId = new Map(Object.entries(IDX.codeToId || {}).map(([c, id]) => [c.toUpperCase(), id]))

// id huyệt → bản ghi ACU (kèm slug DUY NHẤT). records giữ nguyên thứ tự để build & sitemap khớp.
export const records = ACU.records || []
export const acuById = new Map()
const seenSlug = new Set()
for (const r of records) {
  let s = r.slug || slugify(r.ten)
  if (seenSlug.has(s)) { let i = 2; while (seenSlug.has(`${s}-${i}`)) i++; s = `${s}-${i}` }
  r._slug = s
  seenSlug.add(s)
  acuById.set(r.id, r)
}

// ───────────────────────── Bản đồ TRỤ–NHÁNH ─────────────────────────────────
const KINH_SLUG_BY_CODE = {
  LU: 'phe', LI: 'dai-truong', ST: 'vi', SP: 'ty', HT: 'tam', SI: 'tieu-truong',
  BL: 'bang-quang', KI: 'than', PC: 'tam-bao', TE: 'tam-tieu', SJ: 'tam-tieu',
  GB: 'dom', LR: 'can', LIV: 'can', GV: 'doc', CV: 'nham',
}
const KINH_SLUG_OVERRIDE = {
  'mach doi': 'mach-doi', 'mach doi dai': 'mach-doi', 'mach xung': 'mach-xung',
  'mach am kieu': 'mach-am-kieu', 'mach duong kieu': 'mach-duong-kieu',
  'mach am duy': 'mach-am-duy', 'mach duong duy': 'mach-duong-duy',
}
export const kinhSlugOf = (m) => KINH_SLUG_BY_CODE[m.code] || KINH_SLUG_OVERRIDE[fold(m.ten)] || slugify(m.ten)

// 12 chính kinh TRƯỚC để huyệt dùng chung gán về kinh chính (không vào kỳ kinh bát mạch).
export const meridianList = [...(MER.kinh || []), ...(MER.circuits || [])]

// id huyệt → { kinhTen, kinhSlug, mer } — khớp point→huyệt qua MÃ WHO (codeToId), KHÔNG qua tên.
export const merByAcuId = new Map()
for (const m of meridianList) {
  const kinhSlug = kinhSlugOf(m)
  for (const p of m.points || []) {
    const id = p.code ? codeToId.get(String(p.code).toUpperCase()) : null
    if (id != null && !merByAcuId.has(id)) merByAcuId.set(id, { kinhTen: m.ten, kinhSlug, mer: m })
  }
}

export function classify(rec) {
  const meta = idxById.get(rec.id) || {}
  const mer = merByAcuId.get(rec.id)
  if (mer) return { loai: 'kinh', code: meta.code || '', kinhTen: mer.kinhTen, kinhSlug: mer.kinhSlug, mer: mer.mer }
  if (/^a thi\b/.test(fold(rec.ten))) return { loai: 'athi', code: meta.code || '' }
  return { loai: 'ky', code: meta.code || '' }
}

// 1 point trên kinh → bản ghi huyệt (qua MÃ WHO; thiếu mã thì null).
export function recOfPoint(p) {
  const id = p.code ? codeToId.get(String(p.code).toUpperCase()) : null
  return id != null ? acuById.get(id) : null
}

export function sec(rec, h) {
  const want = norm(h)
  const s = (rec.sections || []).find((x) => norm(x.h) === want)
  return s ? String(s.body || '').trim() : ''
}

// ───────────────────────── Quyết định noindex (corrupt / thin) ───────────────
// bodyLen TÍNH ĐÚNG bộ field mà build-dict render → sitemap/IndexNow & trang khớp tuyệt đối.
export function huyetBodyLen(rec) {
  let n = 0
  for (const [h] of HUYET_SECTIONS) { const b = sec(rec, h); if (b) n += b.length }
  if (rec.phoiHuyet) n += rec.phoiHuyet.length
  if (rec.ghiChu) n += rec.ghiChu.length
  return n
}
export function huyetIndexable(rec) {
  const meta = idxById.get(rec.id) || {}
  return !meta.corrupt && huyetBodyLen(rec) >= MIN_BODY_CHARS
}
export function kinhBodyLen(m) {
  let n = 0
  for (const [k] of KINH_SECTIONS) { if (m[k]) n += String(m[k]).length }
  return n
}
export function kinhIndexable(m) {
  return kinhBodyLen(m) >= MIN_BODY_CHARS
}

/**
 * Liệt kê MỌI trang từ điển kèm cờ index — dùng cho sitemap & IndexNow.
 * (Chỉ lấy entry.index === true để đưa vào sitemap/ping; trang noindex vẫn được build nhưng KHÔNG đẩy bot.)
 */
export function listDictPages() {
  const out = []
  for (const m of meridianList) if (m && m.ten) out.push({ kind: 'kinh', slug: kinhSlugOf(m), index: kinhIndexable(m) })
  for (const rec of records) if (rec && rec.ten) out.push({ kind: 'huyet', slug: rec._slug, index: huyetIndexable(rec) })
  return out
}
