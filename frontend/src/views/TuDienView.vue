<script setup lang="ts">
/**
 * TuDienView — Tab "Từ Điển" với 2 tab con:
 *   1) Huyệt Vị · Châm Cứu      → tra cứu 1058 huyệt (vị trí, chủ trị, châm cứu, giải phẫu…)
 *   2) Lý Thuyết · Tra Cứu Kinh → 12 chính kinh + 8 mạch + Kỳ Huyệt, trình bày theo TAB-TRONG
 *      (Tổng Quan · Đường Vận Hành · Đồ Hình Tổng Quát · Chủ Trị · Các Huyệt) — mỗi lần xem 1 mục
 *      cho gọn mắt, kèm sơ đồ tương ứng (giống bố cục phần mềm cũ).
 *
 * Dữ liệu lấy từ file tĩnh public/kinhmach3d/data/* (window.ACUPOINTS / MERIDIANS / ACU_COORDS3D) qua
 * ensureDictData() — KHÔNG kéo Three.js. Chi tiết HUYỆT VỊ dựng bằng chuỗi HTML (v-html); chi tiết
 * KINH MẠCH dựng bằng template Vue (tab-trong) để bố cục rõ ràng, phân cấp theo mắt nhìn.
 */
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ensureDictData, BASE } from '@/lib/acuMap3d'

// ───────────────────────── kiểu dữ liệu ─────────────────────────
interface AcuSection { h: string; body: string }
interface AcuRecord {
  id: number
  ten: string
  noiDung?: string
  phoiHuyet?: string
  ghiChu?: string
  thamKhao?: string
  sections?: AcuSection[]
  image?: string | null
  _tenKhac?: string
  _xuatXu?: string
  _dacTinh?: string
  _exCode?: string
  _s?: string
  _name?: string   // norm(tên) — cho xếp hạng tìm kiếm
  _code?: string   // norm(mã huyệt: LU9, EX-…) — cho tìm/xếp hạng theo mã
}
interface MerPoint { n?: number; ten: string; code?: string; id?: number }
interface Meridian {
  id?: number
  type: string
  ten: string
  code?: string
  desc?: string; chinh?: string; can?: string; biet?: string; doc?: string; ngang?: string; chuTri?: string
  dacTinh?: string; vanHanh?: string; trieuChung?: string; dieuTri?: string; nameAlt?: string
  huyet?: string
  pointSummary?: string
  images?: Record<string, string>
  points: MerPoint[]
  _i: number
  _s: string
  _ky?: boolean
}

type MerSection = 'tong-quan' | 'van-hanh' | 'chu-tri' | 'do-hinh' | 'huyet'

const router = useRouter()
const route = useRoute()

// ───────────────────────── trạng thái ─────────────────────────
const loading = ref(true)
const error = ref<string | null>(null)
const ready = ref(false)
const subtab = ref<'huyet' | 'kinh'>('huyet')

// Huyệt vị
const acuRecords = ref<AcuRecord[]>([])
const huyetSearch = ref('')
const activeAcuId = ref<number | null>(null)
const acuLetters = ref<string[]>([])
const acuListEl = ref<HTMLElement | null>(null)

// Kinh mạch
const merList = ref<Meridian[]>([])
const kinhSearch = ref('')
const activeMerI = ref<number | null>(null)
const merSection = ref<MerSection>('tong-quan')
const merVanhanhSub = ref<string>('chinh')
const kyOnlyCoded = ref(false)
const merMainEl = ref<HTMLElement | null>(null)
const flashAcuId = ref<number | null>(null)   // huyệt vừa nhảy tới ở "Các Huyệt" → tô sáng tạm

// dữ liệu phụ trợ (gán 1 lần sau khi nạp xong)
let acuByName = new Map<string, number>()
let acuById = new Map<number, AcuRecord>()    // id → record, để lấy TÊN CHUẨN cho chip huyệt ở "Các Huyệt"
let acuCodeToId = new Map<string, number>()   // mã WHO (LI20, GB11…) → id huyệt — vá khi tên trong kinh ≠ tên huyệt vị
let acuIdToCode = new Map<number, string>()
let acuIdToMer = new Map<number, { i: number; code?: string }>()   // id huyệt → đường kinh chứa nó
let imageLabels: Record<string, string> = {}
let coords: { meridians: Record<string, { color?: string }>; points: Record<string, unknown> } = {
  meridians: {},
  points: {},
}

// ───────────────────────── tiện ích ─────────────────────────
const norm = (s?: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
const fold = (s?: string) => norm(s).replace(/[^a-z0-9]+/g, ' ').trim()
// tách truy vấn thành các từ khoá (đã chuẩn hoá) — khớp mọi từ, không cần đúng thứ tự
const tokenize = (q: string) => q.split(/\s+/).filter(Boolean)
/**
 * Điểm độ-liên-quan của 1 mục với truy vấn: trả -1 nếu KHÔNG khớp (thiếu 1 từ khoá);
 * càng cao càng sát. Dùng để sắp xếp: trùng mã/tên → đứng đầu, chỉ khớp mô tả → cuối.
 * name/code/blob phải cùng kiểu chuẩn hoá với q (norm cho huyệt, fold cho kinh).
 */
function relScore(q: string, tokens: string[], name: string, code: string, blob: string): number {
  for (const t of tokens) if (!blob.includes(t)) return -1
  if (code && code === q) return 100 // trùng mã (LU9)
  if (name === q) return 95 // trùng tên đầy đủ
  if (code && code.startsWith(q)) return 85 // mã bắt đầu bằng q
  if (name.startsWith(q)) return 75 // tên bắt đầu bằng q
  if ((' ' + name).includes(' ' + q)) return 60 // q là đầu một từ trong tên
  if (name.includes(q)) return 45 // q nằm giữa tên
  return 10 // chỉ khớp ở phần mô tả / tên khác / phối huyệt
}
const esc = (s?: string) =>
  (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
const styleSrc = (t: string) => t.replace(/(\([^()]+\))(\.?)$/u, '<span class="src">$1$2</span>')
const secOf = (r: AcuRecord, h: string) => (r.sections || []).find((s) => s.h === h)?.body || ''
const assetUrl = (p?: string | null) =>
  !p ? '' : /^(https?:)?\/\//.test(p) || p.startsWith('/') ? p : BASE + p

// 1 dòng VIẾT HOA TOÀN BỘ (vd "TRIỆU CHỨNG") → coi như tiêu đề con trong nội dung.
const isHeading = (t: string) => t.length <= 34 && /\p{Lu}/u.test(t) && !/\p{Ll}/u.test(t) && !/^\d/.test(t)

// Tô điểm 1 dòng: in đậm TÊN HUYỆT (sau "huyệt"/"h."), in đậm NHÃN đầu dòng ("Kinh bệnh:"…),
// làm nhạt NGUỒN trích cuối dòng "(…)". Trả HTML đã escape.
function decorate(t: string): string {
  let s = esc(t)
  s = s.replace(
    /((?:huyệt|Huyệt|h\.)\s+)([A-ZÀ-Ỹ][\p{Ll}]+(?:\s+[\p{Ll}]+){0,2})/gu,
    '$1<b class="f-acu">$2</b>',
  )
  s = styleSrc(s)
  s = s.replace(/^([^:<.;!?]{1,40}):(?=\s|$)/u, (full, label) =>
    /\p{L}/u.test(label) ? `<b class="f-lead">${label}:</b>` : full,
  )
  return s
}

/**
 * Định dạng đoạn text nhiều dòng → HTML có PHÂN CẤP (giống bài viết):
 *  · dòng VIẾT HOA → tiêu đề con (.f-h)
 *  · "Nhãn: …" → in đậm nhãn (.f-lead) · tên huyệt → .f-acu · nguồn "(…)" → .src (nhạt)
 *  · mục 1./2. → .f-num · mục a)/b) → .f-sub-item
 */
function formatBody(raw?: string): string {
  const lines = (raw || '').split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return ''
  // 1 đoạn văn đơn (không tiêu đề, không đánh số) → thẻ <p> cho thoáng
  if (lines.length === 1) {
    const only = lines[0]!
    if (!isHeading(only) && !/^[\p{L}\d][.)]\s/u.test(only)) return `<p class="f-p">${decorate(only)}</p>`
  }
  let out = ''
  let inList = false
  const closeList = () => {
    if (inList) {
      out += '</ul>'
      inList = false
    }
  }
  for (const t of lines) {
    if (isHeading(t)) {
      closeList()
      out += `<h4 class="f-h">${esc(t)}</h4>`
      continue
    }
    if (!inList) {
      out += '<ul class="f-list">'
      inList = true
    }
    const cls = /^\d+[.)]\s/.test(t) ? ' class="f-num"' : /^[\p{L}][.)]\s/u.test(t) ? ' class="f-sub-item"' : ''
    out += `<li${cls}>${decorate(t)}</li>`
  }
  closeList()
  return out
}

// ───────────────────────── nạp dữ liệu ─────────────────────────
onMounted(async () => {
  try {
    await ensureDictData()
    const W = window as any
    const A = (W.ACUPOINTS && W.ACUPOINTS.records) as AcuRecord[]
    const M = W.MERIDIANS
    if (!A || !M) throw new Error('Thiếu dữ liệu huyệt vị / kinh mạch.')
    coords = W.ACU_COORDS3D || { meridians: {}, points: {} }
    const KY_CODES: Record<number, string> = W.KY_CODES || {}
    imageLabels = M.imageLabels || {}
    // bảng tra mã WHO → id huyệt (acu-index.js): khớp huyệt khi tên ghi trong đường kinh khác tên
    // trong danh sách huyệt vị (vd LI20 "Nghinh hương" ↔ "Nghênh Hương", GB11 "Khiếu âm" ↔ "Đầu Khiếu Âm").
    acuCodeToId = new Map()
    for (const [code, id] of Object.entries((W.ACU_INDEX && W.ACU_INDEX.codeToId) || {}))
      acuCodeToId.set(code.toUpperCase(), id as number)

    // —— Huyệt vị ——
    A.forEach((r) => {
      r._tenKhac = secOf(r, 'TÊN KHÁC')
      r._xuatXu = secOf(r, 'XUẤT XỨ')
      r._dacTinh = secOf(r, 'ĐẶC TÍNH')
      r._exCode = KY_CODES[r.id] || ''
      r._s = norm([r.ten, r._tenKhac, r.phoiHuyet, r.noiDung, r._exCode].join(' '))
    })
    acuRecords.value = A
    acuByName = new Map()
    acuById = new Map()
    for (const r of A) {
      acuById.set(r.id, r)
      const k = fold(r.ten)
      if (!acuByName.has(k)) acuByName.set(k, r.id)
    }
    acuLetters.value = [
      ...new Set(A.map((r) => norm(r.ten)[0]?.toUpperCase()).filter((c): c is string => !!c)),
    ].sort()

    // —— Kinh mạch: 12 chính kinh + mạch có huyệt + Kỳ Huyệt + mạch không huyệt riêng ——
    const merWithPts = (M.circuits || []).filter((c: Meridian) => c.points && c.points.length)
    const merNoPts = (M.circuits || []).filter((c: Meridian) => !(c.points && c.points.length))
    const list: Meridian[] = [...(M.kinh || []), ...merWithPts]

    const kyPoints = A.filter((r) => /kỳ huyệt/iu.test((r._dacTinh || '').normalize('NFC')))
      .map((r) => ({ ten: r.ten, id: r.id, code: KY_CODES[r.id] || '' }))
      .sort((a, b) => fold(a.ten).localeCompare(fold(b.ten)))
    if (kyPoints.length) {
      list.push({ type: 'ky', code: 'KH', ten: 'Kỳ Huyệt', _ky: true, points: kyPoints, images: {}, _i: 0, _s: '' })
    }
    list.push(...merNoPts)

    acuIdToCode = new Map()
    for (const m of [...(M.kinh || []), ...(M.circuits || [])]) {
      for (const p of m.points || []) {
        if (!p.code) continue
        const id = acuIdOf(p)
        if (id != null && !acuIdToCode.has(id)) acuIdToCode.set(id, p.code)
      }
    }
    // chỉ mục tìm kiếm huyệt: tên + mã (LU9 / EX-…) cho xếp hạng; mã cũng đưa vào _s để tìm được.
    A.forEach((r) => {
      r._name = norm(r.ten)
      r._code = norm(acuIdToCode.get(r.id) || r._exCode || '')
      if (r._code) r._s = (r._s || '') + ' ' + r._code
    })

    list.forEach((m, i) => {
      m._i = i
      m._s = fold([m.ten, m.code, ...(m.points || []).map((p) => (p.code || '') + ' ' + p.ten)].join(' '))
    })
    merList.value = list

    // id huyệt → đường kinh chứa nó (kinh chính đứng trước Kỳ Huyệt nên "ai có trước thắng").
    acuIdToMer = new Map()
    for (const m of list) {
      for (const p of m.points || []) {
        const id = p.id ?? acuIdOf(p)
        if (id != null && !acuIdToMer.has(id)) acuIdToMer.set(id, { i: m._i, code: p.code })
      }
    }

    ready.value = true
    if (A.length) activeAcuId.value = A[0]!.id
    if (list.length) selectMer(0)
    applyRouteQuery()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})

// ═══════════════════════ HUYỆT VỊ ═══════════════════════
const acuFiltered = computed<AcuRecord[]>(() => {
  if (!ready.value) return []
  const q = norm(huyetSearch.value.trim())
  if (!q) return acuRecords.value
  const tokens = tokenize(q)
  const hits: { r: AcuRecord; s: number }[] = []
  for (const r of acuRecords.value) {
    const s = relScore(q, tokens, r._name || '', r._code || '', r._s || '')
    if (s >= 0) hits.push({ r, s })
  }
  hits.sort((a, b) => b.s - a.s || (a.r._name || '').localeCompare(b.r._name || ''))
  return hits.map((h) => h.r)
})
const acuActive = computed<AcuRecord | null>(
  () => acuRecords.value.find((r) => r.id === activeAcuId.value) || null,
)

const ACU_META_HEADERS = ['TÊN KHÁC', 'XUẤT XỨ', 'ĐẶC TÍNH']
const ACU_EXTRA: [keyof AcuRecord, string][] = [
  ['phoiHuyet', 'Phối Huyệt'],
  ['ghiChu', 'Ghi Chú'],
  ['thamKhao', 'Tham Khảo'],
]
// icon nhỏ cho mỗi mục → dễ quét bằng mắt khi nhiều chữ (khớp cả tên hoa lẫn tên thường)
const SECTION_ICONS: Record<string, string> = {
  'TÊN HUYỆT': '🏷️', 'TÊN KHÁC': '🏷️', 'XUẤT XỨ': '📜', 'VỊ TRÍ': '📍', 'GIẢI PHẪU': '🦴',
  'ĐẶC TÍNH': '⭐', 'TÁC DỤNG': '✨', 'CHỦ TRỊ': '🎯', 'CHÂM CỨU': '📌', 'THAM KHẢO': '📚',
  'PHỐI HUYỆT': '🔗', 'Ý NGHĨA': '💡', 'CHÚ Ý': '⚠️', 'PHỐI HUYỆT ': '🔗', 'GHI CHÚ': '📝',
}
const secIcon = (h: string) => SECTION_ICONS[h.toUpperCase().trim()] || '•'
const fieldH = (h: string) => `<h3><span class="fi">${secIcon(h)}</span><span class="ft">${esc(h)}</span></h3>`

const acuDetailHtml = computed<string>(() => {
  const r = acuActive.value
  if (!r) return ''
  const metaRow = (label: string, value?: string, cls?: string) =>
    value ? `<div class="m-row"><dt>${label}</dt><dd${cls ? ` class="${cls}"` : ''}>${esc(value)}</dd></div>` : ''
  const meta =
    metaRow('Tên Khác', r._tenKhac) +
    metaRow('Xuất Xứ', r._xuatXu) +
    metaRow('Đặc Tính', r._dacTinh)

  const code3d = acuIdToCode.get(r.id)
  const has3d = code3d && coords.points[code3d]
  const open3d = has3d
    ? `<button class="td-3dbtn" data-map-code="${esc(code3d)}" type="button">🧭 Xem Vị Trí Trên Đồ Hình 3D</button>`
    : ''
  const merInfo = acuIdToMer.get(r.id)
  const openMer = merInfo
    ? `<button class="td-merbtn" data-mer-i="${merInfo.i}" type="button">📖 Xem Trên Đường Kinh</button>`
    : ''
  const actions = open3d || openMer ? `<div class="detail-actions">${open3d}${openMer}</div>` : ''

  const photo = r.image
    ? `<img class="photo" src="${esc(assetUrl(r.image))}" alt="${esc(r.ten)}" onerror="this.style.display='none'">`
    : ''

  const sectionCards = (r.sections || [])
    .filter((s) => s.h && !ACU_META_HEADERS.includes(s.h) && s.body)
    .map((s) => `<section class="field">${fieldH(s.h)}<div class="body">${formatBody(s.body)}</div></section>`)
    .join('')
  const extraCards = ACU_EXTRA.filter(([k]) => r[k])
    .map(([k, label]) => `<section class="field">${fieldH(label)}<div class="body">${formatBody(r[k] as string)}</div></section>`)
    .join('')

  const codeChip = code3d ? `<span class="ah-code">${esc(code3d)}</span>` : ''
  const exChip = r._exCode ? `<span class="ah-code ah-code--ex">${esc(r._exCode)}</span>` : ''

  return `<article class="detail">
      <div class="detail-head">
        ${photo}
        <div class="titles">
          ${codeChip || exChip ? `<div class="ah-badges">${codeChip}${exChip}</div>` : ''}
          <h2>${esc(r.ten)}</h2>
          ${meta ? `<dl class="meta">${meta}</dl>` : ''}
          ${actions}
        </div>
      </div>
      ${sectionCards + extraCards || '<p class="empty-note">Chưa có nội dung chi tiết cho huyệt này.</p>'}
    </article>`
})

function selectAcu(id: number) {
  activeAcuId.value = id
}
function jumpAcuLetter(l: string) {
  const target = acuFiltered.value.find((r) => norm(r.ten)[0]?.toUpperCase() === l)
  if (target) document.getElementById('td-acu-' + target.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}
// các nút trong chi tiết huyệt vị (v-html → dùng delegation)
function onAcuDetailClick(e: MouseEvent) {
  const map3d = (e.target as HTMLElement).closest<HTMLElement>('[data-map-code]')
  if (map3d) {
    gotoMap(map3d.dataset.mapCode!)
    return
  }
  const merBtn = (e.target as HTMLElement).closest<HTMLElement>('[data-mer-i]')
  if (merBtn) openMerForAcu(Number(merBtn.dataset.merI), activeAcuId.value)
}
// ảnh thumbnail / sơ đồ 404 → ẩn (không hiện icon ảnh vỡ)
function onThumbError(e: Event) {
  ;(e.target as HTMLElement).style.visibility = 'hidden'
}
function onFigError(e: Event) {
  const fig = (e.target as HTMLElement).closest('figure')
  if (fig) (fig as HTMLElement).style.display = 'none'
}

// ═══════════════════════ KINH MẠCH ═══════════════════════
const merFiltered = computed<Meridian[]>(() => {
  if (!ready.value) return []
  const q = fold(kinhSearch.value.trim())
  if (!q) return merList.value
  const tokens = tokenize(q)
  const hits: { m: Meridian; s: number }[] = []
  for (const m of merList.value) {
    const s = relScore(q, tokens, fold(m.ten), fold(m.code), m._s)
    if (s >= 0) hits.push({ m, s })
  }
  hits.sort((a, b) => b.s - a.s || a.m._i - b.m._i) // cùng điểm → giữ thứ tự kinh gốc
  return hits.map((h) => h.m)
})
const merActive = computed<Meridian | null>(() =>
  activeMerI.value == null ? null : merList.value[activeMerI.value] || null,
)

const KY_NOTE =
  'Kỳ huyệt (huyệt ngoài kinh) là những huyệt nằm ngoài hệ 12 chính kinh và 8 mạch, có vị trí và chủ trị riêng. Bấm vào tên huyệt để xem chi tiết bên mục Huyệt Vị · Châm Cứu. Huyệt có mã EX-… đã được WHO chuẩn hoá danh pháp quốc tế.'

// Các tab-trong của 1 kinh/mạch (chỉ hiện tab có nội dung)
const merTabs = computed(() => {
  const m = merActive.value
  if (!m || m.type === 'ky') return [] as { key: MerSection; label: string }[]
  const isMach = m.type === 'mach'
  const imgs = m.images || {}
  const tabs: { key: MerSection; label: string }[] = []
  if (isMach ? m.dacTinh || m.nameAlt : m.desc) tabs.push({ key: 'tong-quan', label: isMach ? 'Đặc Tính' : 'Tổng Quan' })
  if (isMach ? m.vanHanh : m.chinh || m.ngang || m.doc || m.biet || m.can || imgs.chinh || imgs.ngang || imgs.doc || imgs.biet || imgs.can)
    tabs.push({ key: 'van-hanh', label: isMach ? 'Vận Hành' : 'Đường Vận Hành' })
  if (isMach ? m.trieuChung || m.dieuTri : m.chuTri) tabs.push({ key: 'chu-tri', label: isMach ? 'Triệu Chứng · Điều Trị' : 'Chủ Trị' })
  if (imgs.gen || imgs.sodo) tabs.push({ key: 'do-hinh', label: 'Đồ Hình Tổng Quát' })
  if (m.points.length) tabs.push({ key: 'huyet', label: 'Các Huyệt' })
  return tabs
})

interface VhSub { key: string; label: string; text: string; img: string; imgLabel: string }
// 5 nhánh "đường vận hành" của chính kinh (mỗi nhánh kèm sơ đồ riêng)
const vanhanhSubs = computed<VhSub[]>(() => {
  const m = merActive.value
  if (!m || m.type !== 'kinh') return []
  const imgs = m.images || {}
  const defs: [keyof Meridian, string][] = [
    ['chinh', 'Kinh Chính'], ['ngang', 'Lạc Ngang'], ['doc', 'Lạc Dọc'], ['biet', 'Kinh Biệt'], ['can', 'Kinh Cân'],
  ]
  return defs
    .filter(([k]) => m[k] || imgs[k as string])
    .map(([k, label]) => ({
      key: k as string,
      label,
      text: (m[k] as string) || '',
      img: imgs[k as string] ? assetUrl(imgs[k as string]) : '',
      imgLabel: imageLabels[k as string] || 'Sơ đồ',
    }))
})
const activeVanhanh = computed<VhSub | null>(
  () => vanhanhSubs.value.find((s) => s.key === merVanhanhSub.value) || vanhanhSubs.value[0] || null,
)

// Ảnh "Đồ hình tổng quát"
const merOverview = computed<{ url: string; label: string }[]>(() => {
  const m = merActive.value
  if (!m) return []
  const imgs = m.images || {}
  const out: { url: string; label: string }[] = []
  if (imgs.gen) out.push({ url: assetUrl(imgs.gen), label: imageLabels.gen || 'Sơ đồ tổng quát' })
  if (imgs.sodo && imgs.sodo !== imgs.gen) out.push({ url: assetUrl(imgs.sodo), label: imageLabels.sodo || 'Sơ đồ' })
  return out
})

// Kỳ Huyệt: gom theo chữ cái đầu
const kyView = computed(() => {
  const m = merActive.value
  if (!m || m.type !== 'ky') return null
  const coded = m.points.filter((p) => p.code)
  const pts = kyOnlyCoded.value ? coded : m.points
  const map = new Map<string, MerPoint[]>()
  for (const p of pts) {
    const L = (fold(p.ten)[0] || '#').toUpperCase()
    if (!map.has(L)) map.set(L, [])
    map.get(L)!.push(p)
  }
  const groups = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([letter, points]) => ({ letter, points }))
  return { groups, coded: coded.length, total: m.points.length }
})

// id huyệt cho 1 điểm trên đường kinh: ưu tiên khớp TÊN, nếu không khớp thì tra theo MÃ WHO
// (vá huyệt lệch tên: LI20, GB11, GB15, CV21, GB33…). GB33 đã có record (id 1059) qua acuCodeToId.
const acuIdOf = (p: MerPoint) =>
  acuByName.get(fold(p.ten)) ?? (p.code ? acuCodeToId.get(p.code.toUpperCase()) : undefined)
// TÊN hiển thị của điểm-kinh: ưu tiên TÊN CHUẨN trong Từ Điển (đồng nhất với 3D, sửa tên kinh sai/lệch
// hoa-thường như KI17, GB24/25/27, GV7…); thiếu record mới dùng tên ghi trong đường kinh.
const ptName = (p: MerPoint) => {
  const id = acuIdOf(p)
  return (id != null && acuById.get(id)?.ten) || p.ten
}

function selectMer(i: number) {
  activeMerI.value = i
  merSection.value = (merTabs.value[0]?.key as typeof merSection.value) || 'tong-quan'
  merVanhanhSub.value = vanhanhSubs.value[0]?.key || 'chinh'
}
function scrollToKy(letter: string) {
  merMainEl.value?.querySelector('#tdky-' + letter)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

// ───────────────────────── điều hướng chéo ─────────────────────────
function openAcu(id?: number) {
  if (id == null) return
  subtab.value = 'huyet'
  activeAcuId.value = id
  nextTick(() => {
    document.getElementById('td-acu-' + id)?.scrollIntoView({ block: 'center' })
    acuListEl.value?.scrollIntoView?.({ block: 'nearest' })
  })
}
// mở tab Kinh Mạch 3D + bay tới huyệt (KinhMach3DView đọc query.focus sau khi engine sẵn sàng)
function gotoMap(code: string) {
  router.push({ name: 'kinh-mach-3d', query: { focus: code } })
}
// từ chi tiết huyệt → tab "Lý Thuyết · Tra Cứu Kinh": chọn đúng đường kinh, mở "Các Huyệt",
// cuộn tới + tô sáng huyệt vừa xem (Kỳ Huyệt thì hiện thẳng danh sách kỳ huyệt).
function openMerForAcu(i: number, acuId: number | null) {
  if (Number.isNaN(i)) return
  subtab.value = 'kinh'
  selectMer(i)
  const m = merList.value[i]
  if (m && m.type !== 'ky' && m.points.length) merSection.value = 'huyet'
  flashAcuId.value = acuId
  nextTick(() => {
    if (acuId != null) {
      document.getElementById('tdpt-' + acuId)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    window.setTimeout(() => {
      if (flashAcuId.value === acuId) flashAcuId.value = null
    }, 2400)
  })
}

// ───────────────────────── deep-link (?acu= / ?mer=) ─────────────────────────
function applyRouteQuery() {
  if (!ready.value) return
  const acuQ = Array.isArray(route.query.acu) ? route.query.acu[0] : route.query.acu
  const merQ = Array.isArray(route.query.mer) ? route.query.mer[0] : route.query.mer
  if (acuQ) {
    const id = Number(acuQ)
    if (acuRecords.value.some((r) => r.id === id)) openAcu(id)
  } else if (merQ) {
    const code = String(merQ).toUpperCase()
    const m = merList.value.find((mm) => (mm.code || '').toUpperCase() === code)
    if (m) {
      subtab.value = 'kinh'
      selectMer(m._i)
      nextTick(() => merMainEl.value?.scrollIntoView?.({ block: 'nearest' }))
    }
  }
}
// điều hướng /tu-dien?acu=… lần nữa khi component được tái dùng (không remount)
watch(() => [route.query.acu, route.query.mer], applyRouteQuery)
</script>

<template>
  <div class="tudien-page">
    <!-- thanh tab con -->
    <div class="td-tabs">
      <button class="td-tab" :class="{ active: subtab === 'huyet' }" @click="subtab = 'huyet'">
        Huyệt Vị · Châm Cứu
      </button>
      <button class="td-tab" :class="{ active: subtab === 'kinh' }" @click="subtab = 'kinh'">
        Lý Thuyết · Tra Cứu Kinh
      </button>
    </div>

    <div v-if="error" class="td-error">
      <p><strong>Không tải được dữ liệu Từ Điển.</strong></p>
      <p>{{ error }}</p>
    </div>

    <div v-else-if="loading" class="td-loading">
      <div class="td-spinner" aria-hidden="true"></div>
      <p>Đang tải dữ liệu huyệt vị & kinh mạch…</p>
    </div>

    <!-- ═════ HUYỆT VỊ · CHÂM CỨU ═════ -->
    <div v-show="!loading && !error && subtab === 'huyet'" class="td-shell">
      <aside class="td-aside">
        <div class="td-search">
          <input
            v-model="huyetSearch"
            type="search"
            class="td-input"
            placeholder="Tìm huyệt / mã (LU9, EX…) / tên khác / phối huyệt…"
            autocomplete="off"
          />
          <span class="td-count">{{ acuFiltered.length }} / {{ acuRecords.length }}</span>
        </div>
        <div class="td-alpha">
          <button v-for="l in acuLetters" :key="l" type="button" @click="jumpAcuLetter(l)">{{ l }}</button>
        </div>
        <ul ref="acuListEl" class="td-list">
          <li
            v-for="r in acuFiltered"
            :id="'td-acu-' + r.id"
            :key="r.id"
            :class="{ active: r.id === activeAcuId }"
            @click="selectAcu(r.id)"
          >
            <img v-if="r.image" class="thumb" loading="lazy" :src="assetUrl(r.image)" alt="" @error="onThumbError" />
            <span v-else class="thumb no-thumb">◉</span>
            <span class="nm">{{ r.ten }}<small v-if="r._tenKhac">{{ r._tenKhac.split('\n')[0]?.slice(0, 60) }}</small></span>
          </li>
          <li v-if="!acuFiltered.length" class="td-empty">Không khớp huyệt nào.</li>
        </ul>
      </aside>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="td-main" @click="onAcuDetailClick" v-html="acuDetailHtml"></div>
    </div>

    <!-- ═════ LÝ THUYẾT · TRA CỨU KINH ═════ -->
    <div v-show="!loading && !error && subtab === 'kinh'" class="td-shell">
      <aside class="td-aside">
        <div class="td-search">
          <input
            v-model="kinhSearch"
            type="search"
            class="td-input"
            placeholder="Tìm kinh / mã (LU, Phế) / tên huyệt…"
            autocomplete="off"
          />
          <span class="td-count">{{ merFiltered.length }} / {{ merList.length }}</span>
        </div>
        <ul class="td-list">
          <li
            v-for="m in merFiltered"
            :key="m._i"
            :class="{ active: m._i === activeMerI }"
            @click="selectMer(m._i)"
          >
            <span class="mer-code" :class="m.type">{{ m.code || (m.type === 'mach' ? '8M' : '—') }}</span>
            <span class="nm">{{ m.ten }}<small>{{ m.points.length ? m.points.length + ' huyệt' : (m.type === 'mach' ? 'kỳ kinh' : '') }}</small></span>
          </li>
          <li v-if="!merFiltered.length" class="td-empty">Không khớp kinh nào.</li>
        </ul>
      </aside>

      <div ref="merMainEl" class="td-main">
        <div v-if="!merActive" class="mer-welcome">
          <h3>Tra Cứu Kinh Mạch</h3>
          <p>Chọn một đường kinh ở danh sách bên trái để xem lý thuyết đầy đủ.</p>
        </div>

        <template v-else>
          <header class="mer-head">
            <h2>{{ merActive.ten }}</h2>
            <div class="mer-badges">
              <span v-if="merActive.code" class="badge">{{ merActive.code }}</span>
              <span class="badge sec">{{ merActive.type === 'mach' ? 'Kỳ Kinh / Mạch' : merActive.type === 'ky' ? 'Huyệt Ngoài Kinh' : 'Chính Kinh' }}</span>
              <span v-if="merActive.points.length" class="badge">{{ merActive.points.length }} huyệt</span>
            </div>
          </header>

          <!-- ── Kỳ Huyệt ── -->
          <div v-if="merActive.type === 'ky' && kyView" class="mer-ky">
            <p class="ky-note">{{ KY_NOTE }}</p>
            <div class="ky-bar">
              <div class="ky-alpha">
                <button v-for="g in kyView.groups" :key="g.letter" type="button" @click="scrollToKy(g.letter)">{{ g.letter }}</button>
              </div>
              <button v-if="kyView.coded" class="ky-toggle" :class="{ on: kyOnlyCoded }" @click="kyOnlyCoded = !kyOnlyCoded">
                {{ kyOnlyCoded ? '✓ ' : '' }}Có Mã Quốc Tế ({{ kyView.coded }})
              </button>
            </div>
            <div v-for="g in kyView.groups" :id="'tdky-' + g.letter" :key="g.letter" class="ky-group">
              <h4 class="ky-letter">{{ g.letter }} <span class="lz">{{ g.points.length }}</span></h4>
              <div class="mer-points">
                <a v-for="p in g.points" :id="'tdpt-' + p.id" :key="p.id" class="pt link" :class="{ 'has-ex': p.code, flash: p.id === flashAcuId }" role="button" @click="openAcu(p.id)">
                  <b v-if="p.code">{{ p.code }}</b> {{ p.ten }}
                </a>
              </div>
            </div>
          </div>

          <!-- ── Kinh / Mạch: tab-trong ── -->
          <template v-else>
            <nav class="mer-nav">
              <button
                v-for="t in merTabs"
                :key="t.key"
                class="mer-nav-btn"
                :class="{ active: merSection === t.key }"
                @click="merSection = t.key"
              >
                {{ t.label }}
              </button>
            </nav>

            <div class="mer-pane">
              <!-- Tổng Quan / Đặc Tính -->
              <div v-if="merSection === 'tong-quan'">
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div class="body" v-html="formatBody(merActive.type === 'mach' ? merActive.dacTinh : merActive.desc)"></div>
                <template v-if="merActive.type === 'mach' && merActive.nameAlt">
                  <h4 class="mer-subhead">Tên Khác</h4>
                  <!-- eslint-disable-next-line vue/no-v-html -->
                  <div class="body" v-html="formatBody(merActive.nameAlt)"></div>
                </template>
              </div>

              <!-- Đường Vận Hành -->
              <div v-else-if="merSection === 'van-hanh'">
                <template v-if="merActive.type === 'kinh'">
                  <div class="vh-subnav">
                    <button
                      v-for="s in vanhanhSubs"
                      :key="s.key"
                      class="vh-sub-btn"
                      :class="{ active: activeVanhanh?.key === s.key }"
                      @click="merVanhanhSub = s.key"
                    >
                      {{ s.label }}
                    </button>
                  </div>
                  <div v-if="activeVanhanh" class="vh-illu">
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div v-if="activeVanhanh.text" class="body vh-lead" v-html="formatBody(activeVanhanh.text)"></div>
                    <p v-else class="empty-note">— Không có mô tả trong tài liệu gốc.</p>
                    <figure v-if="activeVanhanh.img" class="vh-fig">
                      <a :href="activeVanhanh.img" target="_blank" rel="noopener">
                        <img class="mer-img" loading="lazy" :src="activeVanhanh.img" :alt="activeVanhanh.imgLabel" @error="onFigError" />
                      </a>
                      <figcaption>{{ activeVanhanh.imgLabel }} <span class="zoom-hint">· bấm để phóng to</span></figcaption>
                    </figure>
                  </div>
                </template>
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div v-else class="body" v-html="formatBody(merActive.vanHanh)"></div>
              </div>

              <!-- Đồ Hình Tổng Quát -->
              <div v-else-if="merSection === 'do-hinh'" class="mer-illu">
                <figure v-for="img in merOverview" :key="img.url" class="mer-fig mer-fig--big">
                  <a :href="img.url" target="_blank" rel="noopener">
                    <img class="mer-img" loading="lazy" :src="img.url" :alt="img.label" @error="onFigError" />
                  </a>
                  <figcaption>{{ img.label }} <span class="zoom-hint">· bấm để phóng to</span></figcaption>
                </figure>
              </div>

              <!-- Chủ Trị / Triệu Chứng · Điều Trị -->
              <div v-else-if="merSection === 'chu-tri'">
                <template v-if="merActive.type === 'mach'">
                  <template v-if="merActive.trieuChung">
                    <h4 class="mer-subhead">Triệu Chứng</h4>
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div class="body" v-html="formatBody(merActive.trieuChung)"></div>
                  </template>
                  <template v-if="merActive.dieuTri">
                    <h4 class="mer-subhead">Điều Trị</h4>
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div class="body" v-html="formatBody(merActive.dieuTri)"></div>
                  </template>
                </template>
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div v-else class="body" v-html="formatBody(merActive.chuTri)"></div>
              </div>

              <!-- Các Huyệt -->
              <div v-else-if="merSection === 'huyet'">
                <p v-if="merActive.pointSummary" class="mer-ptsum">{{ merActive.pointSummary }}</p>
                <div class="mer-points">
                  <template v-for="p in merActive.points" :key="p.code || p.ten">
                    <a
                      v-if="acuIdOf(p) != null"
                      :id="'tdpt-' + acuIdOf(p)"
                      class="pt link"
                      :class="{ flash: acuIdOf(p) === flashAcuId }"
                      role="button"
                      @click="openAcu(acuIdOf(p))"
                    >
                      <b>{{ p.code || p.n }}</b> {{ ptName(p) }}
                    </a>
                    <span v-else class="pt"><b>{{ p.code || p.n }}</b> {{ ptName(p) }}</span>
                  </template>
                </div>
                <p class="mer-pthint">Bấm một huyệt để mở chi tiết bên mục <b>Huyệt Vị · Châm Cứu</b>.</p>
              </div>
            </div>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Đóng khung theme NÂU/KEM; tắt viết-hoa-tự-động của .content-area để text y học giữ đúng. */
.tudien-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  text-transform: none;
  animation: tdFade 0.35s ease;
}
@keyframes tdFade {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── tab con ── */
.td-tabs { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.td-tab {
  padding: var(--space-3) var(--space-5);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  font-size: var(--font-size-md);
  font-weight: 600;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.td-tab:hover { border-color: var(--brown-300); color: var(--brown-700); background: var(--brown-50); }
.td-tab.active { background: var(--brown-600); border-color: var(--brown-600); color: #fff; }

/* ── trạng thái ── */
.td-error { background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger-border); border-radius: var(--radius-lg); padding: var(--space-4) var(--space-5); font-size: var(--font-size-sm); }
.td-error p { margin: 0 0 var(--space-1); }
.td-loading { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); padding: var(--space-12) 0; color: var(--brown-600); }
.td-spinner { width: 34px; height: 34px; border: 3px solid var(--gray-200); border-top-color: var(--brown-500); border-radius: 50%; animation: tdSpin 0.7s linear infinite; }
@keyframes tdSpin { to { transform: rotate(360deg); } }

/* ── khung 2 cột: danh sách | chi tiết ── */
.td-shell {
  display: flex;
  height: calc(100vh - 210px);
  min-height: 480px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}
.td-aside { width: 320px; flex: none; display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--border); background: var(--surface); }
.td-search { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3); border-bottom: 1px solid var(--border); }
.td-input { flex: 1; min-width: 0; padding: var(--space-2) var(--space-3); border: 1px solid var(--gray-200); border-radius: var(--radius-md); font-size: var(--font-size-sm); font-family: inherit; }
.td-input:focus { outline: none; border-color: var(--brown-500); box-shadow: var(--focus-ring); }
.td-count { font-size: var(--font-size-xs); color: var(--gray-500); font-weight: 600; white-space: nowrap; }

.td-alpha { display: flex; flex-wrap: wrap; gap: 2px; padding: var(--space-2); border-bottom: 1px solid var(--border); }
.td-alpha button { width: 24px; height: 24px; border: 0; background: var(--brown-50); color: var(--brown-700); border-radius: var(--radius-sm); font-size: 12px; font-weight: 700; cursor: pointer; }
.td-alpha button:hover { background: var(--brown-600); color: #fff; }

.td-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; min-height: 0; }
.td-list li { display: flex; align-items: center; gap: var(--space-2); padding: 9px var(--space-3); cursor: pointer; border-bottom: 1px solid var(--gray-100); font-size: var(--font-size-sm); }
.td-list li:hover { background: var(--brown-50); }
.td-list li.active { background: var(--brown-600); color: #fff; }
.td-list li.active .nm small { color: rgba(255, 255, 255, 0.82); }
.td-list .thumb { width: 34px; height: 34px; border-radius: var(--radius-sm); object-fit: cover; flex: none; background: var(--brown-50); border: 1px solid var(--border); }
.td-list .no-thumb { display: flex; align-items: center; justify-content: center; color: var(--gray-400); font-size: 16px; }
.td-list .nm { font-weight: 600; min-width: 0; }
.td-list .nm small { display: block; color: var(--gray-500); font-weight: 400; font-size: 11.5px; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.td-list .mer-code { flex: none; min-width: 36px; height: 24px; padding: 0 7px; border-radius: var(--radius-sm); background: var(--brown-100); color: var(--brown-800); font-size: 11.5px; font-weight: 800; display: flex; align-items: center; justify-content: center; letter-spacing: 0.3px; }
.td-list .mer-code.mach, .td-list .mer-code.ky { background: #f0e3d2; color: var(--brown-700); }
.td-list li.active .mer-code { background: rgba(255, 255, 255, 0.25); color: #fff; }
.td-empty { color: var(--gray-500); font-style: italic; justify-content: center; cursor: default; }
.td-empty:hover { background: none; }

.td-main { flex: 1; min-width: 0; overflow-y: auto; padding: var(--space-7) var(--space-8); }

/* ═══ CHI TIẾT HUYỆT VỊ (v-html) ═══ */
.td-main :deep(.detail) { max-width: 820px; margin: 0 auto; }
/* Header dạng "hero": ảnh bo tròn + mã (chip) + tên lớn + meta gọn */
.td-main :deep(.detail-head) { display: flex; gap: 26px; align-items: flex-start; flex-wrap: wrap; padding-bottom: 18px; margin-bottom: 6px; border-bottom: 1px solid var(--brown-100); }
.td-main :deep(.detail-head .photo) { width: 196px; border-radius: 16px; box-shadow: 0 6px 18px rgba(58, 39, 21, 0.12); background: #fff; border: 1px solid var(--border); }
.td-main :deep(.detail-head .titles) { flex: 1; min-width: 240px; }
.td-main :deep(.ah-badges) { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 9px; }
.td-main :deep(.ah-code) { display: inline-flex; align-items: center; background: var(--brown-600); color: #fff; font-family: ui-monospace, "Cascadia Code", monospace; font-weight: 800; font-size: 12.5px; letter-spacing: 0.5px; padding: 3px 11px; border-radius: 999px; }
.td-main :deep(.ah-code--ex) { background: var(--brown-100); color: var(--brown-800); }
.td-main :deep(.detail-head h2) { color: var(--brown-900, var(--brown-800)); font-size: 30px; font-weight: 800; line-height: 1.15; margin: 0 0 12px; letter-spacing: -0.2px; }
.td-main :deep(.meta) { margin: 0; display: grid; gap: 7px; }
.td-main :deep(.meta .m-row) { display: flex; gap: 14px; align-items: baseline; }
.td-main :deep(.meta dt) { flex: 0 0 92px; color: var(--gray-500); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.6; }
.td-main :deep(.meta dd) { margin: 0; font-size: 14.5px; color: var(--text); line-height: 1.55; }
.td-main :deep(.detail-actions) { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
.td-main :deep(.td-3dbtn), .td-main :deep(.td-merbtn) { display: inline-flex; align-items: center; gap: 6px; padding: 8px 15px; border: 1px solid var(--brown-300); background: var(--brown-50); color: var(--brown-800); border-radius: 999px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all var(--transition-fast); }
.td-main :deep(.td-3dbtn):hover, .td-main :deep(.td-merbtn):hover { background: var(--brown-600); color: #fff; border-color: var(--brown-600); transform: translateY(-1px); }

/* Thẻ mục: nhẹ nhàng, tiêu đề có icon-chip + nhãn in hoa */
.td-main :deep(.field) { background: var(--surface); border: 1px solid var(--brown-100); border-radius: 14px; padding: 16px 22px 14px; margin: 16px 0; }
.td-main :deep(.field:hover) { border-color: var(--brown-200); }
.td-main :deep(.field h3) { display: flex; align-items: center; gap: 10px; margin: 0 0 12px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: var(--brown-700); }
.td-main :deep(.fi) { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 9px; background: var(--brown-50); font-size: 15px; line-height: 1; }
.td-main :deep(.field h3 .ft) { padding-top: 1px; }

/* ═══ Typography nội dung (dùng chung 2 tab; .body bọc HTML từ formatBody) ═══ */
.td-main :deep(.field .body) { font-size: 15.5px; line-height: 1.85; color: var(--gray-800); }
.body { font-size: 15.5px; line-height: 1.85; color: var(--gray-800); }
.body :deep(.f-p), .td-main :deep(.f-p) { margin: 0 0 11px; }
.body :deep(.f-list), .td-main :deep(.f-list) { margin: 0 0 12px; padding-left: 1.3em; }
.body :deep(.f-list > li), .td-main :deep(.f-list > li) { margin: 0 0 9px; padding-left: 5px; }
.body :deep(.f-list > li::marker), .td-main :deep(.f-list > li::marker) { color: var(--brown-500); }
.body :deep(.f-list > li.f-sub-item), .td-main :deep(.f-list > li.f-sub-item) { margin-left: 1.3em; list-style-type: '–'; }
.body :deep(.f-list > li.f-num), .td-main :deep(.f-list > li.f-num) { list-style: none; margin-left: 0.2em; padding-left: 1.6em; text-indent: -1.6em; }
.body :deep(.src), .td-main :deep(.src) { color: var(--brown-500); font-style: italic; font-size: 0.9em; }
.body > :first-child { margin-top: 0; }
.body > :last-child { margin-bottom: 0; }
.empty-note, .td-main :deep(.empty-note) { color: var(--gray-500); font-style: italic; }

/* phân cấp kiểu bài viết: tiêu đề con (pill) · nhãn đầu dòng · tên huyệt */
.body :deep(.f-h), .td-main :deep(.f-h) {
  display: inline-block; margin: 18px 0 10px; padding: 5px 12px; font-size: 12px; font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.7px; color: var(--brown-700); line-height: 1.3;
  background: var(--brown-50); border-radius: 8px; border-left: 3px solid var(--brown-400);
}
.body :deep(.f-h:first-child), .td-main :deep(.f-h:first-child) { margin-top: 0; }
.body :deep(.f-lead), .td-main :deep(.f-lead) { font-weight: 700; color: var(--brown-800); }
.body :deep(.f-acu), .td-main :deep(.f-acu) { font-weight: 600; color: var(--brown-700); }

/* ═══ CHI TIẾT KINH MẠCH (template, tab-trong) ═══ */
.mer-welcome { max-width: 460px; margin: 8% auto 0; text-align: center; color: var(--gray-500); }
.mer-welcome h3 { color: var(--brown-800); margin: 0 0 6px; }

.mer-head { padding-bottom: 14px; border-bottom: 1px solid var(--brown-100); }
.mer-head h2 { margin: 0 0 10px; color: var(--brown-900, var(--brown-800)); font-size: 28px; font-weight: 800; line-height: 1.18; letter-spacing: -0.2px; }
.mer-badges { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.badge { background: var(--brown-100); color: var(--brown-800); font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 12px; }
.badge.sec { background: #f0e3d2; color: var(--brown-700); }

/* thanh tab-trong (segmented) — dính trên khi cuộn */
.mer-nav { display: flex; flex-wrap: wrap; gap: 6px; padding: 14px 0 12px; position: sticky; top: 0; z-index: 3; background: var(--surface); }
.mer-nav-btn { padding: 7px 15px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); font-size: 13.5px; font-weight: 600; border-radius: 999px; cursor: pointer; transition: all var(--transition-fast); }
.mer-nav-btn:hover { border-color: var(--brown-300); color: var(--brown-700); background: var(--brown-50); }
.mer-nav-btn.active { background: var(--brown-600); border-color: var(--brown-600); color: #fff; }

.mer-pane { padding: 8px 2px 10px; animation: tdFade 0.22s ease; }
.mer-subhead { display: inline-block; margin: 18px 0 10px; padding: 5px 12px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.7px; color: var(--brown-700); background: var(--brown-50); border-radius: 8px; border-left: 3px solid var(--brown-400); }
.mer-subhead:first-child { margin-top: 0; }

/* sub-nav của "Đường vận hành" */
.vh-subnav { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.vh-sub-btn { padding: 5px 12px; border: 1px solid var(--border); background: var(--surface-2); color: var(--brown-800); font-size: 12.5px; font-weight: 700; border-radius: 8px; cursor: pointer; transition: all var(--transition-fast); }
.vh-sub-btn:hover { border-color: var(--brown-400); }
.vh-sub-btn.active { background: var(--brown-700); border-color: var(--brown-700); color: #fff; }

/* Đường vận hành: ẢNH là trung tâm — chữ đọc phía trên (rộng vừa phải), ảnh lớn căn giữa bên dưới */
.vh-illu { display: flex; flex-direction: column; align-items: center; }
.vh-lead { width: 100%; max-width: 720px; margin-bottom: 18px; }
.vh-fig { margin: 0; width: 360px; max-width: 100%; }

/* ảnh sơ đồ (dùng chung cho đường vận hành + đồ hình tổng quát) */
.mer-img { width: 100%; border: 1px solid var(--border); border-radius: 12px; background: #fff; display: block; cursor: zoom-in; box-shadow: var(--shadow-sm); transition: box-shadow var(--transition-fast); }
.mer-img:hover { box-shadow: 0 6px 18px rgba(58, 39, 21, 0.14); }
.vh-fig figcaption, .mer-fig figcaption { font-size: 12px; color: var(--gray-500); text-align: center; margin-top: 7px; }
.zoom-hint { color: var(--brown-400); }
.mer-illu { display: flex; flex-wrap: wrap; gap: 22px; justify-content: center; }
.mer-fig { margin: 0; width: 300px; max-width: 100%; }
.mer-fig--big { width: 460px; max-width: 100%; }

/* danh sách huyệt (chip) */
.mer-ptsum { font-size: 13.5px; color: var(--brown-700); font-weight: 600; margin: 0 0 12px; }
.mer-points { display: flex; flex-wrap: wrap; gap: 7px; }
.mer-points .pt { font-size: 13px; padding: 5px 10px; border-radius: 14px; background: var(--brown-50); color: var(--text); border: 1px solid transparent; white-space: nowrap; scroll-margin-top: 64px; }
.mer-points .pt b { color: var(--brown-700); font-weight: 800; margin-right: 3px; }
.mer-points a.pt.link { text-decoration: none; cursor: pointer; }
.mer-points a.pt.link:hover { background: var(--brown-600); color: #fff; border-color: var(--brown-700); }
.mer-points a.pt.link:hover b { color: #fff; }
.mer-points .pt.has-ex { border-color: var(--brown-500); background: #f3ece1; }
/* huyệt vừa nhảy tới từ chi tiết → nhấp nháy để dễ nhận ra */
.mer-points .pt.flash { background: var(--brown-600); color: #fff; border-color: var(--brown-700); animation: ptFlash 2.4s ease; }
.mer-points .pt.flash b { color: #fff; }
@keyframes ptFlash {
  0%, 60% { box-shadow: 0 0 0 3px var(--brown-200); }
  100% { box-shadow: 0 0 0 0 transparent; }
}
.mer-pthint { margin: 14px 0 0; font-size: 12.5px; color: var(--gray-500); font-style: italic; }

/* Kỳ Huyệt */
.ky-note { color: var(--gray-500); font-size: 13.5px; line-height: 1.55; margin: 14px 0 12px; }
.ky-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; position: sticky; top: 0; z-index: 3; background: var(--surface); padding: 6px 0; border-bottom: 1px solid var(--border); margin-bottom: 10px; }
.ky-alpha { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; }
.ky-alpha button { min-width: 26px; height: 26px; padding: 0 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--brown-800); font-weight: 700; font-size: 12.5px; cursor: pointer; }
.ky-alpha button:hover { background: var(--brown-600); color: #fff; border-color: var(--brown-700); }
.ky-toggle { font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; background: var(--surface); color: var(--brown-800); border: 1px solid var(--brown-500); padding: 4px 11px; border-radius: 12px; white-space: nowrap; }
.ky-toggle.on { background: var(--brown-600); color: #fff; }
.ky-group { margin: 0 0 16px; scroll-margin-top: 52px; }
.ky-letter { margin: 0 0 8px; font-size: 13px; font-weight: 800; color: var(--brown-800); border-bottom: 1px solid var(--border); padding-bottom: 4px; }
.ky-letter .lz { color: var(--gray-500); font-weight: 600; font-size: 12px; margin-left: 4px; }

/* ── thu hẹp ── */
@media (max-width: 1024px) {
  .mer-fig, .mer-fig--big, .vh-fig { width: 100%; }
}
@media (max-width: 860px) {
  .td-shell { flex-direction: column; height: auto; }
  .td-aside { width: auto; border-right: 0; border-bottom: 1px solid var(--border); }
  .td-list { max-height: 280px; }
  .td-main { max-height: 72vh; }
}
@media (max-width: 768px) {
  .td-shell { min-height: 0; }
}
</style>
