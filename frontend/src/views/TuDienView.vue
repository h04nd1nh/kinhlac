<script setup lang="ts">
/**
 * TuDienView — Tab "Từ Điển" với 2 tab con:
 *   1) Huyệt Vị · Châm Cứu     → tra cứu 1058 huyệt (vị trí, chủ trị, châm cứu, giải phẫu…)
 *   2) Lý Thuyết · Tra Cứu Kinh → 12 chính kinh + 8 mạch + Kỳ Huyệt (đường kinh chính/cân/biệt/lạc,
 *      chủ trị, danh sách huyệt) kèm ĐỒ HÌNH GIẢI PHẪU 2D bấm được (→ bay tới đồ hình 3D).
 *
 * Dữ liệu lấy từ các file tĩnh trong public/kinhmach3d/data/* (window.ACUPOINTS / MERIDIANS / ACU_COORDS3D),
 * nạp qua ensureDictData() — KHÔNG kéo theo Three.js nên trang này nhẹ. Phần CHI TIẾT dựng bằng chuỗi HTML
 * (port nguyên logic bản gốc) rồi gắn qua v-html; danh sách & tìm kiếm dùng template Vue cho phản ứng nhanh.
 */
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
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

const router = useRouter()

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
const kyOnlyCoded = ref(false)
const merMainEl = ref<HTMLElement | null>(null)

// dữ liệu phụ trợ (gán 1 lần sau khi nạp xong)
let acuByName = new Map<string, number>()
let acuIdToCode = new Map<number, string>()
let labels: Record<string, string> = {}
let imageLabels: Record<string, string> = {}
let coords: { meridians: Record<string, { color?: string }>; points: Record<string, any> } = {
  meridians: {},
  points: {},
}

// ───────────────────────── tiện ích ─────────────────────────
const norm = (s?: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
const fold = (s?: string) =>
  norm(s).replace(/[^a-z0-9]+/g, ' ').trim()
const esc = (s?: string) =>
  (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
const styleSrc = (t: string) => t.replace(/(\([^()]+\))(\.?)$/u, '<span class="src">$1$2</span>')
const secOf = (r: AcuRecord, h: string) => (r.sections || []).find((s) => s.h === h)?.body || ''
const assetUrl = (p?: string | null) =>
  !p ? '' : /^(https?:)?\/\//.test(p) || p.startsWith('/') ? p : BASE + p

/** Định dạng đoạn text nhiều dòng: gạch đầu dòng, mục đánh số 1./2., mục con a)/b). */
function formatBody(raw?: string): string {
  const lines = esc(raw).split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return ''
  const items = lines.map((t) => {
    if (/^\d+[.)]\s/.test(t)) return { k: 'num', html: styleSrc(t) }
    if (/^[\p{L}][.)]\s/u.test(t)) return { k: 'sub', html: styleSrc(t) }
    return { k: 'p', html: styleSrc(t) }
  })
  if (items.length === 1 && items[0].k === 'p') return `<p class="f-p">${items[0].html}</p>`
  return (
    '<ul class="f-list">' +
    items
      .map(
        (it) =>
          `<li${it.k === 'sub' ? ' class="f-sub-item"' : it.k === 'num' ? ' class="f-num"' : ''}>${it.html}</li>`,
      )
      .join('') +
    '</ul>'
  )
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
    labels = M.labels || {}
    imageLabels = M.imageLabels || {}

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
    for (const r of A) {
      const k = fold(r.ten)
      if (!acuByName.has(k)) acuByName.set(k, r.id)
    }
    acuLetters.value = [...new Set(A.map((r) => norm(r.ten)[0]?.toUpperCase()).filter(Boolean))].sort()

    // —— Kinh mạch: 12 chính kinh + mạch có huyệt + Kỳ Huyệt + mạch không huyệt riêng ——
    const merWithPts = (M.circuits || []).filter((c: Meridian) => c.points && c.points.length)
    const merNoPts = (M.circuits || []).filter((c: Meridian) => !(c.points && c.points.length))
    const list: Meridian[] = [...(M.kinh || []), ...merWithPts]

    // Kỳ Huyệt = huyệt có ĐẶC TÍNH "Kỳ Huyệt" (suy ra trực tiếp từ dữ liệu huyệt vị)
    const kyPoints = A.filter((r) => /kỳ huyệt/iu.test((r._dacTinh || '').normalize('NFC')))
      .map((r) => ({ ten: r.ten, id: r.id, code: KY_CODES[r.id] || '' }))
      .sort((a, b) => fold(a.ten).localeCompare(fold(b.ten)))
    if (kyPoints.length) {
      list.push({ type: 'ky', code: 'KH', ten: 'Kỳ Huyệt', _ky: true, points: kyPoints, images: {}, _i: 0, _s: '' })
    }
    list.push(...merNoPts)

    // map tên huyệt → mã quốc tế (để mở đồ hình 3D từ chi tiết huyệt vị)
    acuIdToCode = new Map()
    for (const m of [...(M.kinh || []), ...(M.circuits || [])]) {
      for (const p of m.points || []) {
        if (!p.code) continue
        const id = acuByName.get(fold(p.ten))
        if (id != null && !acuIdToCode.has(id)) acuIdToCode.set(id, p.code)
      }
    }

    list.forEach((m, i) => {
      m._i = i
      m._s = fold([m.ten, m.code, ...(m.points || []).map((p) => (p.code || '') + ' ' + p.ten)].join(' '))
    })
    merList.value = list

    ready.value = true
    // chọn sẵn để trang không trống
    if (A.length) activeAcuId.value = A[0].id
    if (list.length) selectMer(0)
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
  return q ? acuRecords.value.filter((r) => r._s!.includes(q)) : acuRecords.value
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

const acuDetailHtml = computed<string>(() => {
  const r = acuActive.value
  if (!r) return ''
  const metaRow = (label: string, value?: string, cls?: string) =>
    value ? `<div class="m-row"><dt>${label}</dt><dd${cls ? ` class="${cls}"` : ''}>${esc(value)}</dd></div>` : ''
  const meta =
    metaRow('Tên Khác', r._tenKhac) +
    metaRow('Xuất Xứ', r._xuatXu) +
    metaRow('Đặc Tính', r._dacTinh) +
    metaRow('Mã Quốc Tế (WHO)', r._exCode, 'exc')

  const code3d = acuIdToCode.get(r.id)
  const has3d = code3d && coords.points[code3d]
  const open3d = has3d
    ? `<button class="td-3dbtn" data-map-code="${esc(code3d)}" type="button">🧭 Xem Vị Trí Trên Đồ Hình 3D</button>`
    : ''

  const photo = r.image
    ? `<img class="photo" src="${esc(assetUrl(r.image))}" alt="${esc(r.ten)}" onerror="this.style.display='none'">`
    : ''

  const sectionCards = (r.sections || [])
    .filter((s) => s.h && !ACU_META_HEADERS.includes(s.h) && s.body)
    .map((s) => `<section class="field"><h3>${esc(s.h)}</h3><div class="body">${formatBody(s.body)}</div></section>`)
    .join('')
  const extraCards = ACU_EXTRA.filter(([k]) => r[k])
    .map(([k, label]) => `<section class="field"><h3>${label}</h3><div class="body">${formatBody(r[k] as string)}</div></section>`)
    .join('')

  return `<article class="detail">
      <div class="detail-head">
        ${photo}
        <div class="titles">
          <h2>${esc(r.ten)}</h2>
          ${meta ? `<dl class="meta">${meta}</dl>` : ''}
          ${open3d}
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
  if (target) {
    document
      .getElementById('td-acu-' + target.id)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
}
// nút "Xem trên đồ hình 3D" trong chi tiết huyệt vị
function onAcuDetailClick(e: MouseEvent) {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-map-code]')
  if (btn) gotoMap(btn.dataset.mapCode!)
}
// ảnh thumbnail 404 → ẩn hẳn (giữ chỗ trống, không hiện icon ảnh vỡ)
function onThumbError(e: Event) {
  const img = e.target as HTMLImageElement
  img.style.visibility = 'hidden'
}

// ═══════════════════════ KINH MẠCH ═══════════════════════
const merFiltered = computed<Meridian[]>(() => {
  if (!ready.value) return []
  const q = fold(kinhSearch.value.trim())
  return q ? merList.value.filter((m) => m._s.includes(q)) : merList.value
})
const merActive = computed<Meridian | null>(() =>
  activeMerI.value == null ? null : merList.value[activeMerI.value] || null,
)

const KINH_FIELDS: (keyof Meridian)[] = ['desc', 'chinh', 'can', 'biet', 'doc', 'ngang', 'chuTri']
const MACH_FIELDS: (keyof Meridian)[] = ['dacTinh', 'vanHanh', 'trieuChung', 'dieuTri', 'nameAlt']
const KY_NOTE =
  'Kỳ huyệt (huyệt ngoài kinh) là những huyệt nằm ngoài hệ 12 chính kinh và 8 mạch, có vị trí và chủ trị riêng. Bấm vào tên huyệt để xem chi tiết bên mục Huyệt Vị · Châm Cứu. Huyệt có mã EX-… đã được WHO chuẩn hoá danh pháp quốc tế.'

// ---- Đồ hình giải phẫu 2D: chiếu toạ độ đo-từ-mesh xuống hình người mặt trước / mặt sau ----
const FIG = { S: 360, CX: 112, TOP: 16, W: 240, H: 398 }
const sx = (nx: number) => FIG.CX + nx * FIG.S
const sy = (ny: number) => FIG.TOP + (1 - ny) * FIG.S

function projOf(code: string) {
  const p = coords.points[code]
  if (!p) return null
  if (p.x !== undefined || p.z !== undefined)
    return { nx: +p.x || 0, ny: +p.y || 0, view: (+p.z || 0) < -0.0005 ? 'back' : 'front', q: p.q, bilateral: true }
  return { nx: 0, ny: +p.h || 0, view: p.az === 180 ? 'back' : 'front', q: p.q, bilateral: false }
}
function buildFigState(m: Meridian) {
  const color = (coords.meridians[m.code || ''] || {}).color || '#8a5e28'
  const pts: any[] = []
  for (const p of m.points || []) {
    const pr = p.code && projOf(p.code)
    if (!pr) continue
    pts.push({ code: p.code, ten: p.ten, num: +((p.code!.match(/\d+/) || ['0'])[0]), ...pr })
  }
  if (!pts.length) return null
  const front = pts.filter((p) => p.view === 'front').length
  return { color, pts, view: pts.length - front > front ? 'back' : 'front', counts: { front, back: pts.length - front } }
}
function silhouette(view: string) {
  const P = (nx: number, ny: number) => `${sx(nx).toFixed(1)} ${sy(ny).toFixed(1)}`
  const torso = `M ${P(-0.118, 0.815)} L ${P(-0.1, 0.775)} L ${P(-0.082, 0.62)} L ${P(-0.108, 0.505)} L ${P(-0.03, 0.475)} L ${P(0.03, 0.475)} L ${P(0.108, 0.505)} L ${P(0.082, 0.62)} L ${P(0.1, 0.775)} L ${P(0.118, 0.815)} Z`
  const arm = (s: number) => `M ${P(s * 0.108, 0.8)} L ${P(s * 0.14, 0.64)} L ${P(s * 0.172, 0.505)} L ${P(s * 0.178, 0.452)}`
  const leg = (s: number) => `M ${P(s * 0.058, 0.5)} L ${P(s * 0.052, 0.3)} L ${P(s * 0.05, 0.1)}`
  const hand = (s: number) => `<ellipse class="fbfill" cx="${sx(s * 0.178).toFixed(1)}" cy="${sy(0.44).toFixed(1)}" rx="9.5" ry="12.5"/>`
  const foot = (s: number) => `<ellipse class="fbfill" cx="${sx(s * 0.058).toFixed(1)}" cy="${sy(0.03).toFixed(1)}" rx="13" ry="8"/>`
  return `<g>
      <path class="fbz leg" d="${leg(1)}"/><path class="fbz leg" d="${leg(-1)}"/>
      <path class="fbz arm" d="${arm(1)}"/><path class="fbz arm" d="${arm(-1)}"/>
      <path class="fbfill" d="${torso}"/>
      <rect class="fbfill" x="${sx(-0.028).toFixed(1)}" y="${sy(0.86).toFixed(1)}" width="${(0.056 * FIG.S).toFixed(1)}" height="${(0.03 * FIG.S).toFixed(1)}"/>
      <ellipse class="fbfill" cx="${sx(0).toFixed(1)}" cy="${sy(0.925).toFixed(1)}" rx="${(0.052 * FIG.S).toFixed(1)}" ry="${(0.075 * FIG.S).toFixed(1)}"/>
      ${hand(1)}${hand(-1)}${foot(1)}${foot(-1)}
      ${view === 'back' ? `<line class="fspine" x1="${sx(0).toFixed(1)}" y1="${sy(0.82).toFixed(1)}" x2="${sx(0).toFixed(1)}" y2="${sy(0.5).toFixed(1)}"/>` : ''}
    </g>`
}
function figLines(shown: any[], color: string) {
  const seg = (arr: any[], sgn: number) => {
    if (arr.length < 2) return ''
    arr = arr.slice().sort((a, b) => a.num - b.num)
    let out = ''
    let run: any[] = []
    const flush = () => {
      if (run.length > 1)
        out += `<path class="fline" d="${run.map((q, i) => (i ? 'L' : 'M') + sx(sgn * q.nx).toFixed(1) + ' ' + sy(q.ny).toFixed(1)).join(' ')}" style="--c:${color}"/>`
      run = []
    }
    for (const q of arr) {
      if (run.length && q.num - run[run.length - 1].num > 2) flush()
      run.push(q)
    }
    flush()
    return out
  }
  const bil = shown.filter((p) => p.bilateral)
  const mid = shown.filter((p) => !p.bilateral)
  return seg(bil, 1) + seg(bil, -1) + seg(mid, 0)
}
function figDots(shown: any[], color: string) {
  let out = ''
  for (const p of shown)
    for (const s of p.bilateral ? [1, -1] : [0]) {
      out +=
        `<g class="fdot${p.q === 'approx' ? ' approx' : ''}" data-code="${esc(p.code)}" transform="translate(${sx(s * p.nx).toFixed(1)} ${sy(p.ny).toFixed(1)})">` +
        `<circle class="fhit" r="9"/><circle class="fpt" r="4.3" style="--c:${color}"/>` +
        `${s >= 0 ? `<text class="flbl" x="7" y="3.2">${esc(p.code)}</text>` : ''}</g>`
    }
  return out
}
function figStageHTML(figState: any, view: string) {
  const shown = figState.pts.filter((p: any) => p.view === view)
  return (
    `<svg class="figsvg" viewBox="0 0 ${FIG.W} ${FIG.H}" preserveAspectRatio="xMidYMid meet">` +
    `${silhouette(view)}<g class="flines">${figLines(shown, figState.color)}</g><g class="fdots">${figDots(shown, figState.color)}</g></svg>`
  )
}

const merDetailHtml = computed<string>(() => {
  const m = merActive.value
  if (!m) return ''
  return m.type === 'ky' ? buildKyHtml(m) : buildMerHtml(m)
})

function buildMerHtml(m: Meridian): string {
  const figState = buildFigState(m)
  const fields = (m.type === 'mach' ? MACH_FIELDS : KINH_FIELDS).filter((f) => m[f])

  const points = m.points.length
    ? `<section class="field">
        <h3>Các Huyệt${m.pointSummary ? ` <span class="lz">${esc(m.pointSummary)}</span>` : ''}</h3>
        <div class="mer-points">
          ${m.points
            .map((p) => {
              const id = acuByName.get(fold(p.ten))
              const dc = p.code ? ` data-code="${esc(p.code)}"` : ''
              const inner = `<b>${esc(p.code || String(p.n || ''))}</b> ${esc(p.ten)}`
              return id != null
                ? `<a class="pt link" data-acu-id="${id}"${dc} role="button" title="Xem chi tiết huyệt">${inner}</a>`
                : `<span class="pt"${dc}>${inner}</span>`
            })
            .join('')}
        </div>
      </section>`
    : ''

  const textCards = fields
    .map((f) => `<section class="field"><h3>${esc(labels[f as string] || (f as string))}</h3><div class="body">${formatBody(m[f] as string)}</div></section>`)
    .join('')

  return `<article class="detail mer-detail">
      <div class="detail-head">
        <div class="titles">
          <h2>${esc(m.ten)}</h2>
          <div class="mer-badges">
            ${m.code ? `<span class="badge">${esc(m.code)}</span>` : ''}
            <span class="badge sec">${m.type === 'mach' ? 'Kỳ Kinh / Mạch' : 'Chính Kinh'}</span>
            ${m.points.length ? `<span class="badge">${m.points.length} huyệt</span>` : ''}
          </div>
        </div>
      </div>
      <div class="mer-grid">
        <div class="mer-main">
          ${points}
          ${textCards || (points ? '' : '<p class="empty-note">Chưa có nội dung chi tiết.</p>')}
          ${diagramGallery(m)}
        </div>
        ${figureAside(figState)}
      </div>
    </article>`
}

// đồ hình sơ đồ (ảnh quét) của kinh — hiện nếu có file ảnh tương ứng
function diagramGallery(m: Meridian): string {
  const imgs = m.images || {}
  const order = ['chinh', 'can', 'biet', 'doc', 'ngang', 'gen', 'sodo', 'pic']
  const cards = order
    .filter((k) => imgs[k])
    .map(
      (k) =>
        `<figure class="dg-item"><img loading="lazy" src="${esc(assetUrl(imgs[k]))}" alt="${esc(imageLabels[k] || k)}" onerror="this.closest('figure').style.display='none'"><figcaption>${esc(imageLabels[k] || k)}</figcaption></figure>`,
    )
    .join('')
  return cards ? `<section class="field"><h3>Sơ Đồ Đường Kinh</h3><div class="dg-grid">${cards}</div></section>` : ''
}

function figureAside(figState: any): string {
  if (!figState)
    return `<aside class="mer-figure"><h3 class="fig-title">Vị Trí Giải Phẫu</h3><div class="fig-empty">Đường kinh này chưa có toạ độ trên đồ hình.<br>Xem trực quan ở tab <b>“Kinh Mạch 3D”</b>.</div></aside>`
  // mặt mặc định của kinh (đa số huyệt ở mặt nào); nút Mặt Trước/Sau đổi trực tiếp SVG trong onMerClick
  const view = figState.view
  const { counts, color } = figState
  const btn = (v: 'front' | 'back', lab: string) =>
    `<button class="fig-view${v === view ? ' on' : ''}" data-v="${v}"${counts[v] ? '' : ' disabled'} style="--c:${color}">${lab} <small>${counts[v] || 0}</small></button>`
  return `<aside class="mer-figure">
      <h3 class="fig-title">Vị Trí Giải Phẫu <span class="fig-3dhint">🧭 bấm huyệt → mở đồ hình 3D</span></h3>
      <div class="fig-toggle">${btn('front', 'Mặt Trước')}${btn('back', 'Mặt Sau')}</div>
      <div class="fig-stage" id="merFigStage">${figStageHTML(figState, view)}</div>
      <p class="fig-cap" id="merFigCap">Di chuột xem tên · <b>bấm chấm huyệt để bay tới đúng vị trí trên đồ hình 3D</b>.</p>
    </aside>`
}

function buildKyHtml(m: Meridian): string {
  const coded = m.points.filter((p) => p.code)
  const pts = kyOnlyCoded.value ? coded : m.points
  const groups = new Map<string, MerPoint[]>()
  for (const p of pts) {
    const L0 = (fold(p.ten)[0] || '#').toUpperCase()
    if (!groups.has(L0)) groups.set(L0, [])
    groups.get(L0)!.push(p)
  }
  const letters = [...groups.keys()].sort()
  const alpha = `<div class="ky-alpha">${letters.map((L0) => `<button data-l="${L0}">${L0}</button>`).join('')}</div>`
  const body = letters
    .map(
      (L0) => `<div class="ky-group" id="ky-${L0}">
        <h4 class="ky-letter">${L0} <span class="lz">${groups.get(L0)!.length}</span></h4>
        <div class="mer-points">
          ${groups
            .get(L0)!
            .map(
              (p) =>
                `<a class="pt link${p.code ? ' has-ex' : ''}" data-acu-id="${p.id}" role="button" title="Xem chi tiết huyệt">${p.code ? `<b>${esc(p.code)}</b> ` : ''}${esc(p.ten)}</a>`,
            )
            .join('')}
        </div>
      </div>`,
    )
    .join('')
  return `<article class="detail">
      <div class="detail-head">
        <div class="titles">
          <h2>${esc(m.ten)}</h2>
          <div class="mer-badges">
            <span class="badge sec">Huyệt Ngoài Kinh</span>
            <span class="badge">${m.points.length} huyệt</span>
            ${coded.length ? `<button class="ky-toggle${kyOnlyCoded.value ? ' on' : ''}" id="kyToggle">${kyOnlyCoded.value ? '✓ ' : ''}Có Mã Quốc Tế (${coded.length})</button>` : ''}
          </div>
        </div>
      </div>
      <p class="ky-note">${esc(KY_NOTE)}</p>
      ${alpha}
      <div class="ky-groups">${body}</div>
    </article>`
}

function selectMer(i: number) {
  activeMerI.value = i
}

// ---- tương tác trong vùng chi tiết kinh (port event-delegation bản gốc) ----
function onMerClick(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (t.closest('#kyToggle')) {
    kyOnlyCoded.value = !kyOnlyCoded.value
    return
  }
  const ab = t.closest<HTMLElement>('.ky-alpha button')
  if (ab) {
    merMainEl.value?.querySelector('#ky-' + ab.dataset.l)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    return
  }
  const vb = t.closest<HTMLButtonElement>('.fig-view')
  if (vb && !vb.disabled) {
    // đổi mặt trước/sau: chỉ thay SVG + trạng thái nút (giữ vị trí cuộn, không dựng lại cả trang)
    const v = vb.dataset.v as 'front' | 'back'
    const m = merActive.value
    const fs = m ? buildFigState(m) : null
    if (fs && (fs.counts as Record<string, number>)[v]) {
      const stage = merMainEl.value?.querySelector('#merFigStage')
      if (stage) stage.innerHTML = figStageHTML(fs, v)
      merMainEl.value
        ?.querySelectorAll<HTMLElement>('.fig-view')
        .forEach((b) => b.classList.toggle('on', b.dataset.v === v))
    }
    return
  }
  const dot = t.closest<HTMLElement>('.fdot')
  if (dot) {
    gotoMap(dot.dataset.code!)
    return
  }
  const pt = t.closest<HTMLElement>('.pt.link[data-acu-id]')
  if (pt) openAcu(+pt.dataset.acuId!)
}
// làm nổi đồng thời chấm trên hình ⇄ nhãn huyệt trong danh sách
function figCrossHi(code: string, on: boolean) {
  const root = merMainEl.value
  if (!root) return
  root.querySelectorAll(`.fdot[data-code="${code}"]`).forEach((d) => d.classList.toggle('hot', on))
  root.querySelectorAll(`.mer-main .pt[data-code="${code}"]`).forEach((c) => c.classList.toggle('hot', on))
}
function onMerHover(e: MouseEvent, on: boolean) {
  const t = (e.target as HTMLElement).closest<HTMLElement>('.fdot, .mer-main .pt[data-code]')
  if (!t) return
  const code = t.dataset.code
  if (code) figCrossHi(code, on)
}

// ───────────────────────── điều hướng chéo ─────────────────────────
function openAcu(id: number) {
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
            placeholder="Tìm huyệt / tên khác / phối huyệt / mã EX…"
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
            <img
              v-if="r.image"
              class="thumb"
              loading="lazy"
              :src="assetUrl(r.image)"
              alt=""
              @error="onThumbError"
            />
            <span v-else class="thumb no-thumb">◉</span>
            <span class="nm">{{ r.ten }}<small v-if="r._tenKhac">{{ r._tenKhac.split('\n')[0].slice(0, 60) }}</small></span>
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
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div
        ref="merMainEl"
        class="td-main"
        @click="onMerClick"
        @mouseover="(e) => onMerHover(e, true)"
        @mouseout="(e) => onMerHover(e, false)"
        v-html="merDetailHtml"
      ></div>
    </div>
  </div>
</template>

<style scoped>
/* Đóng khung theme NÂU/KEM của app; KHÔNG để .content-area viết-hoa-tự-động làm hỏng text y học. */
.tudien-page {
  --c-line: var(--border);
  --c-brand: var(--brown-600);
  --c-brand-dark: var(--brown-800);
  --c-brand-soft: var(--brown-50);
  --c-accent: var(--brown-500);
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
.td-list .mer-code.mach { background: #f0e3d2; color: var(--brown-700); }
.td-list li.active .mer-code { background: rgba(255, 255, 255, 0.25); color: #fff; }
.td-empty { color: var(--gray-500); font-style: italic; justify-content: center; cursor: default; }
.td-empty:hover { background: none; }

.td-main { flex: 1; min-width: 0; overflow-y: auto; padding: var(--space-6) var(--space-7); }

/* ── chi tiết (port từ bản gốc, đổi sang token nâu) ── */
.td-main :deep(.detail) { max-width: 880px; margin: 0 auto; }
.td-main :deep(.mer-detail) { max-width: 1180px; }
.td-main :deep(.detail-head) { display: flex; gap: 24px; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap; }
.td-main :deep(.detail-head .photo) { width: 220px; border-radius: 12px; box-shadow: var(--shadow-sm); background: #fff; border: 1px solid var(--border); }
.td-main :deep(.detail-head .titles) { flex: 1; min-width: 240px; }
.td-main :deep(.detail-head h2) { color: var(--brown-800); font-size: 28px; margin: 0 0 10px; }

.td-main :deep(.meta) { margin: 0; display: grid; gap: 5px; }
.td-main :deep(.meta .m-row) { display: flex; gap: 12px; align-items: baseline; }
.td-main :deep(.meta dt) { flex: 0 0 132px; color: var(--gray-500); font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; line-height: 1.45; }
.td-main :deep(.meta dd) { margin: 0; font-size: 14.5px; color: var(--text); }
.td-main :deep(.meta .exc) { font-weight: 800; color: var(--brown-700); letter-spacing: 0.3px; }

.td-3dbtn { margin-top: 12px; padding: 7px 14px; border: 1px solid var(--brown-500); background: var(--brown-50); color: var(--brown-800); border-radius: var(--radius-md); font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; }
.td-3dbtn:hover { background: var(--brown-600); color: #fff; }

.td-main :deep(.field) { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 20px; margin: 14px 0; box-shadow: var(--shadow-sm); }
.td-main :deep(.field h3) { margin: 0 0 10px; font-size: 13.5px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--brown-700); border-bottom: 2px solid var(--brown-100); padding-bottom: 6px; }
.td-main :deep(.field h3 .lz) { color: var(--brown-500); font-weight: 600; font-size: 12.5px; margin-left: 4px; text-transform: none; letter-spacing: 0; }
.td-main :deep(.field .body) { font-size: 15px; color: var(--gray-800); }
.td-main :deep(.field .body > :first-child) { margin-top: 0; }
.td-main :deep(.field .body > :last-child) { margin-bottom: 0; }
.td-main :deep(.f-p) { margin: 0 0 10px; }
.td-main :deep(.f-list) { margin: 0 0 12px; padding-left: 1.4em; }
.td-main :deep(.f-list > li) { margin: 0 0 7px; padding-left: 4px; }
.td-main :deep(.f-list > li::marker) { color: var(--brown-600); }
.td-main :deep(.f-list > li.f-sub-item) { margin-left: 1.3em; list-style-type: '–'; }
.td-main :deep(.f-list > li.f-num) { list-style: none; margin-left: 0.2em; padding-left: 1.6em; text-indent: -1.6em; }
.td-main :deep(.src) { color: var(--brown-600); }
.td-main :deep(.empty-note) { color: var(--gray-500); font-style: italic; }

.td-main :deep(.badge) { background: var(--brown-100); color: var(--brown-800); font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 12px; }
.td-main :deep(.badge.sec) { background: #f0e3d2; color: var(--brown-700); }
.td-main :deep(.mer-badges) { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 2px; align-items: center; }

/* lưới 2 cột: nội dung | đồ hình giải phẫu */
.td-main :deep(.mer-grid) { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 22px; align-items: start; }
.td-main :deep(.mer-main) { min-width: 0; }
.td-main :deep(.mer-points) { display: flex; flex-wrap: wrap; gap: 6px; }
.td-main :deep(.mer-points .pt) { font-size: 13px; padding: 4px 9px; border-radius: 14px; background: var(--brown-50); color: var(--text); border: 1px solid transparent; white-space: nowrap; }
.td-main :deep(.mer-points .pt b) { color: var(--brown-700); font-weight: 800; margin-right: 2px; }
.td-main :deep(.mer-points a.pt.link) { text-decoration: none; cursor: pointer; }
.td-main :deep(.mer-points a.pt.link:hover) { background: var(--brown-600); color: #fff; border-color: var(--brown-700); }
.td-main :deep(.mer-points a.pt.link:hover b) { color: #fff; }
.td-main :deep(.mer-points .pt.hot) { background: var(--brown-600); color: #fff; border-color: var(--brown-700); }
.td-main :deep(.mer-points .pt.hot b) { color: #fff; }
.td-main :deep(.mer-points .pt.has-ex) { border-color: var(--brown-500); background: #f3ece1; }

/* đồ hình giải phẫu 2D */
.td-main :deep(.mer-figure) { position: sticky; top: 0; align-self: start; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 14px 14px 10px; box-shadow: var(--shadow-sm); }
.td-main :deep(.fig-title) { margin: 0 0 10px; font-size: 14px; font-weight: 800; color: var(--brown-800); }
.td-main :deep(.fig-3dhint) { font-size: 11px; font-weight: 500; color: var(--brown-600); margin-left: 8px; }
.td-main :deep(.fig-toggle) { display: flex; gap: 8px; margin-bottom: 8px; }
.td-main :deep(.fig-view) { flex: 1; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; background: var(--surface-2); color: var(--brown-800); border: 1px solid var(--border); padding: 6px 8px; border-radius: 10px; }
.td-main :deep(.fig-view small) { font-weight: 700; opacity: 0.65; }
.td-main :deep(.fig-view.on) { background: var(--c, var(--brown-600)); border-color: var(--c, var(--brown-700)); color: #fff; }
.td-main :deep(.fig-view:disabled) { opacity: 0.4; cursor: default; }
.td-main :deep(.fig-stage) { background: linear-gradient(#fbfaf7, #f1ece4); border: 1px solid var(--border); border-radius: 12px; padding: 6px; }
.td-main :deep(.figsvg) { display: block; width: 100%; height: auto; }
.td-main :deep(.fig-cap) { min-height: 32px; margin: 8px 2px 2px; font-size: 12px; line-height: 1.45; color: var(--gray-500); }
.td-main :deep(.fig-empty) { font-size: 13px; line-height: 1.55; color: var(--gray-500); padding: 10px 4px; }
.td-main :deep(.fbfill) { fill: #ece4d8; stroke: #ddd2c2; stroke-width: 1; }
.td-main :deep(.fbz) { fill: none; stroke: #ece4d8; stroke-linecap: round; stroke-linejoin: round; }
.td-main :deep(.fbz.leg) { stroke-width: 27; }
.td-main :deep(.fbz.arm) { stroke-width: 18; }
.td-main :deep(.fspine) { stroke: #cdbfa8; stroke-width: 1.4; stroke-dasharray: 3 3; }
.td-main :deep(.fline) { fill: none; stroke: var(--c, var(--brown-600)); stroke-width: 2; stroke-opacity: 0.55; stroke-linecap: round; stroke-linejoin: round; }
.td-main :deep(.fdot) { cursor: pointer; }
.td-main :deep(.fdot .fhit) { fill: transparent; }
.td-main :deep(.fdot .fpt) { fill: var(--c, var(--brown-600)); stroke: #fff; stroke-width: 1.4; transition: r 0.08s; }
.td-main :deep(.fdot.approx .fpt) { fill-opacity: 0.65; stroke-dasharray: 2 1.5; }
.td-main :deep(.fdot .flbl) { font-size: 8.5px; font-weight: 700; fill: #4a3a28; paint-order: stroke; stroke: #fff; stroke-width: 2.4px; stroke-linejoin: round; pointer-events: none; }
.td-main :deep(.fdot:hover .fpt), .td-main :deep(.fdot.hot .fpt) { r: 6.6; stroke: var(--brown-800); stroke-width: 2; stroke-dasharray: none; }
.td-main :deep(.fdot:hover .flbl), .td-main :deep(.fdot.hot .flbl) { fill: var(--brown-800); }

/* sơ đồ đường kinh (ảnh) */
.td-main :deep(.dg-grid) { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.td-main :deep(.dg-item) { margin: 0; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--surface-2); }
.td-main :deep(.dg-item img) { width: 100%; display: block; background: #fff; }
.td-main :deep(.dg-item figcaption) { padding: 5px 8px; font-size: 12px; color: var(--gray-600); text-align: center; border-top: 1px solid var(--border); }

/* Kỳ Huyệt */
.td-main :deep(.mer-code.ky) { background: #ece0f0; color: #6a4aa6; }
.td-main :deep(.ky-note) { color: var(--gray-500); font-size: 13.5px; line-height: 1.55; margin: 2px 0 12px; }
.td-main :deep(.ky-alpha) { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 4px; padding: 8px 0; margin-bottom: 6px; background: var(--surface); border-bottom: 1px solid var(--border); }
.td-main :deep(.ky-alpha button) { min-width: 26px; height: 26px; padding: 0 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--brown-800); font-weight: 700; font-size: 12.5px; cursor: pointer; }
.td-main :deep(.ky-alpha button:hover) { background: var(--brown-600); color: #fff; border-color: var(--brown-700); }
.td-main :deep(.ky-group) { margin: 0 0 16px; scroll-margin-top: 44px; }
.td-main :deep(.ky-letter) { margin: 0 0 8px; font-size: 13px; font-weight: 800; color: var(--brown-800); border-bottom: 1px solid var(--border); padding-bottom: 4px; }
.td-main :deep(.ky-letter .lz) { color: var(--gray-500); font-weight: 600; font-size: 12px; margin-left: 4px; }
.td-main :deep(.ky-toggle) { font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; background: var(--surface); color: var(--brown-800); border: 1px solid var(--brown-500); padding: 3px 10px; border-radius: 12px; }
.td-main :deep(.ky-toggle.on) { background: var(--brown-600); color: #fff; }

/* ── thu hẹp ── */
@media (max-width: 1024px) {
  .td-main :deep(.mer-grid) { grid-template-columns: 1fr; }
  .td-main :deep(.mer-figure) { position: static; order: -1; }
  .td-main :deep(.fig-stage) { max-width: 320px; margin: 0 auto; }
}
@media (max-width: 860px) {
  .td-shell { flex-direction: column; height: auto; }
  .td-aside { width: auto; border-right: 0; border-bottom: 1px solid var(--border); }
  .td-list { max-height: 280px; }
  .td-main { max-height: 70vh; }
}
@media (max-width: 768px) {
  .td-shell { min-height: 0; }
}
</style>
