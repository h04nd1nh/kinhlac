<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '@/services/api'

// ===== Kiểu dữ liệu =====
interface ThongKe {
  tong: number
  cho: number
  da_phan_tich: number
  loi: number
}
interface DoiThu {
  id: number
  domain: string
  ten: string | null
  la_cua_minh: boolean
  ghi_chu: string | null
  thong_ke: ThongKe
}
interface SeoUrlRow {
  id: number
  doi_thu_id: number
  url: string
  trang_thai: 'cho' | 'da_phan_tich' | 'loi'
  chu_de: string | null
  tu_khoa: string | null
  tom_tat: string | null
  loi: string | null
}
interface Cum {
  id: number
  ten_cum: string
  diem_uu_tien: number
  tu_khoa_muc_tieu: string | null
  y_tuong_noi_dung: string | null
  ly_do: string | null
  trang_thai: string
}

// ===== State =====
const doiThuList = ref<DoiThu[]>([])
const cumList = ref<Cum[]>([])
const urlRows = ref<SeoUrlRow[]>([])
const selectedDoiThuId = ref<number | null>(null)
const urlFilter = ref<'all' | 'cho' | 'da_phan_tich' | 'loi'>('all')

const loadingList = ref(false)
const loadingUrls = ref(false)
const runningGap = ref(false)
const busyIds = ref<Set<number>>(new Set()) // id đối thủ / url đang chạy
const message = ref<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null)

// Form thêm đối thủ
const form = ref<{ domain: string; ten: string; la_cua_minh: boolean }>({
  domain: '',
  ten: '',
  la_cua_minh: false,
})
const adding = ref(false)
const batchLimit = ref(5) // mặc định nhỏ để tránh timeout proxy (nginx cắt sau 120s) khi AI chạy lâu

// ===== Helpers =====
function flash(kind: 'ok' | 'err' | 'info', text: string) {
  message.value = { kind, text }
  if (kind === 'ok' || kind === 'info') {
    setTimeout(() => {
      if (message.value?.text === text) message.value = null
    }, 5000)
  }
}
function setBusy(id: number, on: boolean) {
  const s = new Set(busyIds.value)
  if (on) s.add(id)
  else s.delete(id)
  busyIds.value = s
}
const isBusy = (id: number) => busyIds.value.has(id)

const selectedDoiThu = computed(() => doiThuList.value.find((d) => d.id === selectedDoiThuId.value) || null)
const filteredUrls = computed(() =>
  urlFilter.value === 'all' ? urlRows.value : urlRows.value.filter((u) => u.trang_thai === urlFilter.value),
)
const hasCompetitorAnalyzed = computed(() =>
  doiThuList.value.some((d) => !d.la_cua_minh && d.thong_ke.da_phan_tich > 0),
)

const TRANG_THAI_LABEL: Record<string, string> = {
  cho: 'Chờ',
  da_phan_tich: 'Đã phân tích',
  loi: 'Lỗi',
}

// ===== API calls =====
async function loadDoiThu() {
  loadingList.value = true
  try {
    const res = await api.get<{ data: DoiThu[] }>('/seo/doi-thu')
    doiThuList.value = res.data
  } catch (e: any) {
    flash('err', e.message || 'Không tải được danh sách đối thủ')
  } finally {
    loadingList.value = false
  }
}

async function loadCum() {
  try {
    const res = await api.get<{ data: Cum[] }>('/seo/cum')
    cumList.value = res.data
  } catch {
    /* im lặng */
  }
}

async function loadUrls(doiThuId: number) {
  selectedDoiThuId.value = doiThuId
  loadingUrls.value = true
  try {
    const res = await api.get<{ data: SeoUrlRow[] }>(`/seo/url?doiThuId=${doiThuId}`)
    urlRows.value = res.data
  } catch (e: any) {
    flash('err', e.message || 'Không tải được danh sách URL')
  } finally {
    loadingUrls.value = false
  }
}

async function addDoiThu() {
  const domain = form.value.domain.trim()
  if (!domain) {
    flash('err', 'Nhập domain đối thủ trước đã (vd: dokinhlac.com.vn)')
    return
  }
  adding.value = true
  try {
    await api.post('/seo/doi-thu', {
      domain,
      ten: form.value.ten.trim() || undefined,
      la_cua_minh: form.value.la_cua_minh,
    })
    form.value = { domain: '', ten: '', la_cua_minh: false }
    flash('ok', 'Đã thêm. Bấm "Quét Sitemap" để gom URL.')
    await loadDoiThu()
  } catch (e: any) {
    flash('err', e.message || 'Thêm đối thủ thất bại')
  } finally {
    adding.value = false
  }
}

async function removeDoiThu(d: DoiThu) {
  if (!confirm(`Xoá "${d.domain}" và toàn bộ URL đã gom của nó?`)) return
  setBusy(d.id, true)
  try {
    await api.delete(`/seo/doi-thu/${d.id}`)
    if (selectedDoiThuId.value === d.id) {
      selectedDoiThuId.value = null
      urlRows.value = []
    }
    await loadDoiThu()
  } catch (e: any) {
    flash('err', e.message || 'Xoá thất bại')
  } finally {
    setBusy(d.id, false)
  }
}

async function crawl(d: DoiThu) {
  setBusy(d.id, true)
  flash('info', `Đang đọc sitemap của ${d.domain}…`)
  try {
    const res = await api.post<{ data: { found: number; added: number } }>(`/seo/doi-thu/${d.id}/crawl`, {})
    flash('ok', `Tìm thấy ${res.data.found} URL, thêm mới ${res.data.added}.`)
    await loadDoiThu()
    if (selectedDoiThuId.value === d.id) await loadUrls(d.id)
  } catch (e: any) {
    flash('err', e.message || 'Quét sitemap thất bại')
  } finally {
    setBusy(d.id, false)
  }
}

async function analyzeBatch(d: DoiThu) {
  setBusy(d.id, true)
  flash('info', `Đang phân tích tối đa ${batchLimit.value} bài của ${d.domain} (AI có thể mất 1-2 phút)…`)
  try {
    const res = await api.post<{ data: { analyzed: number; ok: number; loi: number } }>(
      `/seo/doi-thu/${d.id}/analyze-batch`,
      { limit: batchLimit.value },
    )
    flash('ok', `Đã phân tích ${res.data.analyzed} bài (thành công ${res.data.ok}, lỗi ${res.data.loi}).`)
    await loadDoiThu()
    if (selectedDoiThuId.value === d.id) await loadUrls(d.id)
  } catch (e: any) {
    flash('err', e.message || 'Phân tích thất bại')
  } finally {
    setBusy(d.id, false)
  }
}

async function analyzeOne(u: SeoUrlRow) {
  setBusy(u.id, true)
  try {
    const res = await api.post<{ data: SeoUrlRow }>(`/seo/url/${u.id}/analyze`, {})
    const idx = urlRows.value.findIndex((x) => x.id === u.id)
    if (idx >= 0) urlRows.value[idx] = res.data
    if (res.data.trang_thai === 'loi') flash('err', `Lỗi: ${res.data.loi}`)
    await loadDoiThu()
  } catch (e: any) {
    flash('err', e.message || 'Phân tích URL thất bại')
  } finally {
    setBusy(u.id, false)
  }
}

async function removeUrl(u: SeoUrlRow) {
  setBusy(u.id, true)
  try {
    await api.delete(`/seo/url/${u.id}`)
    urlRows.value = urlRows.value.filter((x) => x.id !== u.id)
    await loadDoiThu()
  } catch (e: any) {
    flash('err', e.message || 'Xoá URL thất bại')
  } finally {
    setBusy(u.id, false)
  }
}

async function runGap() {
  runningGap.value = true
  flash('info', 'AI đang so sánh nội dung đối thủ với của bạn để tìm khoảng trống…')
  try {
    const res = await api.post<{ data: Cum[] }>('/seo/gap-analysis', {})
    cumList.value = res.data
    flash('ok', `Xong! AI đề xuất ${res.data.length} cụm chủ đề nên viết.`)
  } catch (e: any) {
    flash('err', e.message || 'Phân tích khoảng trống thất bại')
  } finally {
    runningGap.value = false
  }
}

function shortUrl(u: string): string {
  return u.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

// ===== Phase 2: Lò Viết Bài =====
type Tab = 'radar' | 'viet' | 'trend'
const tab = ref<Tab>('radar')

interface BaiViet {
  id: number
  cum_id: number | null
  tieu_de: string
  slug: string | null
  meta_description: string | null
  tu_khoa: string | null
  category: string | null
  cta: string | null
  faq: string | null
  nguon_tham_khao: string | null
  noi_dung_md: string
  do_rui_ro: 'an_toan' | 'rui_ro'
  ly_do_rui_ro: string | null
  kiem_duyet: string | null
  trang_thai: 'nhap' | 'da_duyet' | 'bo_qua' | 'da_dang'
}

const baiVietList = ref<BaiViet[]>([])
const genBusy = ref<number | null>(null) // cum_id đang sinh, -1 = viết tự do
const freeChuDe = ref('')
const freeTuKhoa = ref('')

// Tiến trình ước lượng cho "Viết nháp" (AI chạy 2 lượt: viết thân bài → rà soát YMYL + bóc metadata).
// Backend xử lý đồng bộ trong 1 request nên KHÔNG có % thật — đây là ước lượng theo thời gian cho đỡ sốt ruột.
const genProgress = ref(0)
const genStage = ref('')
let genTimer: ReturnType<typeof setInterval> | null = null

function startGenProgress() {
  genProgress.value = 0
  genStage.value = 'Đang gửi yêu cầu tới AI…'
  const t0 = Date.now()
  const EST = 40000 // ~40s cho 2 lượt gọi AI
  if (genTimer) clearInterval(genTimer)
  genTimer = setInterval(() => {
    const elapsed = Date.now() - t0
    // Tiến tới tối đa 95% theo đường cong (không chạm 100 tới khi có kết quả thật).
    genProgress.value = Math.min(95, Math.round((1 - Math.exp(-elapsed / (EST * 0.55))) * 100))
    if (genProgress.value < 8) genStage.value = 'Đang gửi yêu cầu tới AI…'
    else if (genProgress.value < 58) genStage.value = 'Bước 1/2 · Đang viết thân bài + chèn link nội bộ…'
    else genStage.value = 'Bước 2/2 · Đang rà soát an toàn (YMYL) & bóc tiêu đề, mô tả, nguồn…'
  }, 350)
}

function stopGenProgress() {
  if (genTimer) {
    clearInterval(genTimer)
    genTimer = null
  }
  genProgress.value = 100
  genStage.value = 'Hoàn tất!'
  setTimeout(() => {
    if (genBusy.value === null) genProgress.value = 0
  }, 900)
}
const editing = ref<BaiViet | null>(null)
const savingEditor = ref(false)
const exportingId = ref<number | null>(null)
const publishingId = ref<number | null>(null)

// ===== Tiến trình khi Đăng (overlay: chạy bar tới khi xong → bật nút Xem) =====
const pubModal = ref(false) // overlay tiến trình đang hiện
const pubProgress = ref(0)
const pubStage = ref('')
const pubNote = ref('') // ghi chú backend khi xong (vd "deploy lại để lên web")
const pubDone = ref(false) // đăng xong → cho bấm Xem
const pubError = ref('')
const pubTarget = ref<{ id: number; slug: string; tieu_de: string } | null>(null)
let pubTimer: ReturnType<typeof setInterval> | null = null

function startPubProgress(a: BaiViet) {
  pubModal.value = true
  pubDone.value = false
  pubError.value = ''
  pubNote.value = ''
  pubProgress.value = 0
  pubTarget.value = { id: a.id, slug: a.slug || '', tieu_de: a.tieu_de }
  pubStage.value = 'Đang gửi yêu cầu đăng…'
  const t0 = Date.now()
  const EST = 6000 // ~6s: ghi file .md + cập nhật trạng thái (không có % thật → ước lượng)
  if (pubTimer) clearInterval(pubTimer)
  pubTimer = setInterval(() => {
    const elapsed = Date.now() - t0
    pubProgress.value = Math.min(92, Math.round((1 - Math.exp(-elapsed / (EST * 0.5))) * 100))
    if (pubProgress.value < 30) pubStage.value = 'Đang ghi file bài viết (.md)…'
    else if (pubProgress.value < 70) pubStage.value = 'Đang cập nhật trạng thái “Đã đăng”…'
    else pubStage.value = 'Sắp xong…'
  }, 200)
}
function finishPubProgress(ok: boolean, opts: { slug?: string; note?: string; error?: string } = {}) {
  if (pubTimer) {
    clearInterval(pubTimer)
    pubTimer = null
  }
  if (ok) {
    pubProgress.value = 100
    pubDone.value = true
    if (opts.slug && pubTarget.value) pubTarget.value.slug = opts.slug
    pubStage.value = 'Hoàn tất! Bài đã đăng.'
    pubNote.value = opts.note || ''
  } else {
    pubError.value = opts.error || 'Đăng thất bại.'
  }
}
function closePubModal() {
  if (pubTimer) {
    clearInterval(pubTimer)
    pubTimer = null
  }
  pubModal.value = false
  pubDone.value = false
  pubError.value = ''
  pubNote.value = ''
  pubProgress.value = 0
  pubTarget.value = null
}

// ===== Phase 3: Xu Hướng =====
const DEFAULT_SEEDS = 'đo kinh lạc\nhuyệt\nbấm huyệt\nchâm cứu\nbài thuốc đông y\ntính vị quy kinh'
const trendSeeds = ref(DEFAULT_SEEDS)
const trendCandidates = ref<string[]>([])
const trendSelected = ref<Set<string>>(new Set())
const discovering = ref(false)
const runningTrend = ref(false)
// Trần số nháp viết mỗi lần — PHẢI khớp TREND_MAX_DRAFTS ở backend (nginx cắt request sau 120s).
const TREND_MAX = 2

const CTA_OPTIONS = ['/xem-ket-qua-do', '/xem-3d', '/xem-bai-thuoc', '/thu-vien', '/app']
const TT_BAIVIET: Record<string, string> = {
  nhap: 'Nháp',
  da_duyet: 'Đã duyệt',
  bo_qua: 'Bỏ qua',
  da_dang: 'Đã đăng',
}

async function loadBaiViet() {
  try {
    const res = await api.get<{ data: BaiViet[] }>('/seo/bai-viet')
    baiVietList.value = res.data
  } catch {
    /* im lặng */
  }
}

async function genFromCum(c: Cum) {
  genBusy.value = c.id
  startGenProgress()
  flash('info', `AI đang viết nháp cho cụm "${c.ten_cum}" (~30–60 giây)…`)
  try {
    const res = await api.post<{ data: BaiViet }>('/seo/bai-viet/generate', { cum_id: c.id })
    flash('ok', `Đã tạo nháp: "${res.data.tieu_de}".`)
    await Promise.all([loadBaiViet(), loadCum()])
    editing.value = { ...res.data }
  } catch (e: any) {
    flash('err', e.message || 'Viết nháp thất bại')
  } finally {
    genBusy.value = null
    stopGenProgress()
  }
}

async function genFree() {
  if (!freeChuDe.value.trim()) {
    flash('err', 'Nhập chủ đề trước đã.')
    return
  }
  genBusy.value = -1
  startGenProgress()
  flash('info', `AI đang viết nháp cho "${freeChuDe.value}" (~30–60 giây)…`)
  try {
    const res = await api.post<{ data: BaiViet }>('/seo/bai-viet/generate', {
      chu_de: freeChuDe.value.trim(),
      tu_khoa: freeTuKhoa.value.trim() || undefined,
    })
    flash('ok', `Đã tạo nháp: "${res.data.tieu_de}".`)
    freeChuDe.value = ''
    freeTuKhoa.value = ''
    await loadBaiViet()
    editing.value = { ...res.data }
  } catch (e: any) {
    flash('err', e.message || 'Viết nháp thất bại')
  } finally {
    genBusy.value = null
    stopGenProgress()
  }
}

function openEditor(a: BaiViet) {
  const copy = { ...a }
  // Bài cũ đã duyệt/đăng (trước khi có checklist) → coi như đã tick đủ, khỏi kẹt khi lưu lại.
  if (!copy.kiem_duyet && (copy.trang_thai === 'da_duyet' || copy.trang_thai === 'da_dang')) {
    copy.kiem_duyet = JSON.stringify({ yKhoa: true, seo: true, nguon: true, anh: true })
  }
  editing.value = copy
}
function closeEditor() {
  editing.value = null
}

// ===== Checklist kiểm duyệt thủ công (van YMYL nhiều bước) =====
const KIEM_DUYET_ITEMS: { key: string; label: string }[] = [
  { key: 'yKhoa', label: 'An toàn y khoa (YMYL): không có chẩn đoán/liều lượng nguy hiểm' },
  { key: 'seo', label: 'SEO đạt: tiêu đề, mô tả, từ khoá, slug đã chuẩn' },
  { key: 'nguon', label: 'Có nguồn tham khảo uy tín (E-E-A-T)' },
  { key: 'anh', label: 'Ảnh bìa khớp chủ đề (đã xem bên dưới)' },
]
const kiemDuyet = computed<Record<string, boolean>>(() => {
  const raw = editing.value?.kiem_duyet
  if (!raw) return {}
  try {
    return (JSON.parse(raw) as Record<string, boolean>) || {}
  } catch {
    return {}
  }
})
function toggleKiem(key: string, val: boolean) {
  if (!editing.value) return
  editing.value.kiem_duyet = JSON.stringify({ ...kiemDuyet.value, [key]: val })
}
const kiemDuyetDu = computed(() => KIEM_DUYET_ITEMS.every((it) => kiemDuyet.value[it.key] === true))

// ===== Ảnh bìa tự chọn theo chủ đề — PHẢI khớp pickCoverImage ở backend (seo.controller.ts) =====
const MERIDIAN_KEYWORDS_FE: { idx: number; phrases: string[] }[] = [
  { idx: 1, phrases: ['kinh phe', 'tang phe', 'thai am phe', 'phoi', 'lung'] },
  { idx: 2, phrases: ['dai truong', 'duong minh dai truong', 'hop coc', 'large intestine'] },
  { idx: 3, phrases: ['kinh vi', 'tang vi', 'duong minh vi', 'da day', 'tuc tam ly', 'stomach'] },
  { idx: 4, phrases: ['kinh ty', 'tang ty', 'thai am ty', 'tam am giao', 'lach', 'spleen'] },
  { idx: 5, phrases: ['kinh tam', 'tang tam', 'thieu am tam', 'tim mach', 'benh tim', 'heart'] },
  { idx: 6, phrases: ['tieu truong', 'thai duong tieu truong', 'small intestine'] },
  { idx: 7, phrases: ['bang quang', 'thai duong bang quang', 'bladder'] },
  { idx: 8, phrases: ['kinh than', 'tang than', 'thieu am than', 'bo than', 'kidney'] },
  { idx: 9, phrases: ['tam bao', 'quyet am tam bao', 'pericardium'] },
  { idx: 10, phrases: ['tam tieu', 'thieu duong tam tieu', 'san jiao', 'triple energizer'] },
  { idx: 11, phrases: ['kinh dom', 'tang dom', 'thieu duong dom', 'tui mat', 'gallbladder'] },
  { idx: 12, phrases: ['kinh can', 'tang can', 'quyet am can', 'la gan', 'bo gan', 'gan mat', 'liver'] },
]
function normLooseFE(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
const meridianCoverFE = (i: number) =>
  `/kinhmach3d/images/meridians/kinh-${String(i).padStart(2, '0')}-sodo.jpg`
function coverImageFor(a: BaiViet | null): string {
  if (!a) return ''
  const slug = a.slug || ''
  const hay = ` ${normLooseFE([a.tieu_de, a.tu_khoa, slug].filter(Boolean).join(' '))
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `
  for (const m of MERIDIAN_KEYWORDS_FE) {
    if (m.phrases.some((p) => hay.includes(` ${p} `))) return meridianCoverFE(m.idx)
  }
  const s = slug || 'bai-viet'
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return meridianCoverFE((h % 12) + 1)
}

// Nguồn tham khảo lưu dạng JSON [{title,url?}] nhưng cho sửa thân thiện: mỗi dòng "Tên | URL".
const nguonText = computed<string>({
  get() {
    const a = editing.value
    if (!a?.nguon_tham_khao) return ''
    try {
      const arr = JSON.parse(a.nguon_tham_khao)
      return (Array.isArray(arr) ? arr : [])
        .map((s: any) =>
          typeof s === 'string' ? s : [s.title || s.ten || '', s.url || ''].filter(Boolean).join(' | '),
        )
        .join('\n')
    } catch {
      return a.nguon_tham_khao
    }
  },
  set(v: string) {
    if (!editing.value) return
    const arr = v
      .split('\n')
      .map((ln) => ln.trim())
      .filter(Boolean)
      .map((ln) => {
        const [title, url] = ln.split('|').map((s) => s.trim())
        return url ? { title, url } : { title }
      })
    editing.value.nguon_tham_khao = arr.length ? JSON.stringify(arr) : null
  },
})

// FAQ lưu dạng JSON [{q,a}] nhưng cho sửa thân thiện: mỗi dòng "Câu hỏi | Trả lời" (chỉ tách ở dấu | đầu tiên).
const faqText = computed<string>({
  get() {
    const a = editing.value
    if (!a?.faq) return ''
    try {
      const arr = JSON.parse(a.faq)
      return (Array.isArray(arr) ? arr : [])
        .map((f: any) => [f.q || '', f.a || ''].filter(Boolean).join(' | '))
        .join('\n')
    } catch {
      return a.faq
    }
  },
  set(v: string) {
    if (!editing.value) return
    const arr = v
      .split('\n')
      .map((ln) => ln.trim())
      .filter(Boolean)
      .map((ln) => {
        const i = ln.indexOf('|')
        const q = (i >= 0 ? ln.slice(0, i) : ln).trim()
        const a = (i >= 0 ? ln.slice(i + 1) : '').trim()
        return { q, a }
      })
      .filter((f) => f.q && f.a)
    editing.value.faq = arr.length ? JSON.stringify(arr) : null
  },
})

async function saveEditor() {
  if (!editing.value) return
  savingEditor.value = true
  const e = editing.value
  try {
    const res = await api.put<{ data: BaiViet }>(`/seo/bai-viet/${e.id}`, {
      tieu_de: e.tieu_de,
      slug: e.slug,
      meta_description: e.meta_description,
      tu_khoa: e.tu_khoa,
      category: e.category,
      cta: e.cta,
      faq: e.faq,
      nguon_tham_khao: e.nguon_tham_khao,
      noi_dung_md: e.noi_dung_md,
      kiem_duyet: e.kiem_duyet,
      trang_thai: e.trang_thai,
    })
    const idx = baiVietList.value.findIndex((x) => x.id === e.id)
    if (idx >= 0) baiVietList.value[idx] = res.data
    flash('ok', 'Đã lưu.')
    editing.value = null
  } catch (err: any) {
    flash('err', err.message || 'Lưu thất bại')
  } finally {
    savingEditor.value = false
  }
}

async function deleteBaiViet(a: BaiViet) {
  if (!confirm(`Xoá nháp "${a.tieu_de}"?`)) return
  try {
    await api.delete(`/seo/bai-viet/${a.id}`)
    baiVietList.value = baiVietList.value.filter((x) => x.id !== a.id)
    if (editing.value?.id === a.id) editing.value = null
  } catch (e: any) {
    flash('err', e.message || 'Xoá thất bại')
  }
}

async function exportMd(a: BaiViet) {
  exportingId.value = a.id
  try {
    const res = await api.get<{ data: { filename: string; content: string } }>(`/seo/bai-viet/${a.id}/export`)
    const blob = new Blob([res.data.content], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = res.data.filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    flash(
      'ok',
      `Đã tải ${res.data.filename}. Đăng bài: node frontend/scripts/publish-article.mjs --from <file> rồi npm run build-blog. (Bài chưa "Đã duyệt" sẽ là noindex/chờ duyệt.)`,
    )
  } catch (e: any) {
    flash('err', e.message || 'Xuất .md thất bại')
  } finally {
    exportingId.value = null
  }
}

async function publishArticle(a: BaiViet) {
  if (a.trang_thai !== 'da_duyet' && a.trang_thai !== 'da_dang') {
    flash('err', 'Đổi trạng thái sang "Đã duyệt" rồi mới Đăng được (van an toàn).')
    return
  }
  if (
    !confirm(
      `Đăng bài "${a.tieu_de}"?\n\nSẽ ghi file vào frontend/content/blog/ trên máy này. Để lên web kinhlac.online bạn vẫn cần build + deploy lại.`,
    )
  )
    return
  publishingId.value = a.id
  startPubProgress(a)
  try {
    const res = await api.post<{ data: { slug: string; wrote: boolean; note: string } }>(
      `/seo/bai-viet/${a.id}/publish`,
      {},
    )
    const idx = baiVietList.value.findIndex((x) => x.id === a.id)
    if (idx >= 0) baiVietList.value[idx] = { ...baiVietList.value[idx], trang_thai: 'da_dang', slug: res.data.slug }
    if (editing.value?.id === a.id) editing.value = { ...editing.value, trang_thai: 'da_dang', slug: res.data.slug }
    finishPubProgress(true, { slug: res.data.slug, note: res.data.note })
  } catch (e: any) {
    finishPubProgress(false, { error: e.message || 'Đăng thất bại' })
  } finally {
    publishingId.value = null
  }
}

function viewArticle(a: { slug: string | null }) {
  const slug = (a.slug || '').trim()
  if (!slug) {
    flash('err', 'Bài chưa có slug để xem.')
    return
  }
  // Bài tĩnh nằm ở /blog/<slug>/ (chỉ hiện sau khi build/deploy).
  window.open(`/blog/${slug}/`, '_blank')
}

async function discoverTrends() {
  discovering.value = true
  flash('info', 'Đang lấy gợi ý tìm kiếm thật từ Google…')
  try {
    const seeds = trendSeeds.value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(',')
    const qs = seeds ? `?seeds=${encodeURIComponent(seeds)}` : ''
    const res = await api.get<{ data: { keyword: string }[] }>(`/seo/trends/discover${qs}`)
    trendCandidates.value = res.data.map((d) => d.keyword)
    trendSelected.value = new Set()
    flash('ok', `Tìm thấy ${trendCandidates.value.length} chủ đề ứng viên (đã bỏ bài đã viết).`)
  } catch (e: any) {
    flash('err', e.message || 'Quét xu hướng thất bại')
  } finally {
    discovering.value = false
  }
}

function toggleCand(k: string) {
  const s = new Set(trendSelected.value)
  if (s.has(k)) s.delete(k)
  else s.add(k)
  trendSelected.value = s
}

async function runTrendDrafts() {
  // Chỉ gửi tối đa TREND_MAX chủ đề/lần (khớp backend) để tránh nginx cắt request giữa chừng.
  const kws = [...trendSelected.value].slice(0, TREND_MAX)
  if (!kws.length) {
    flash('err', 'Chọn ít nhất 1 chủ đề.')
    return
  }
  runningTrend.value = true
  flash('info', `AI đang viết ${kws.length} nháp từ xu hướng (mỗi bài ~30s)…`)
  try {
    const res = await api.post<{ data: BaiViet[] }>('/seo/trends/run', { keywords: kws })
    flash('ok', `Đã tạo ${res.data.length} nháp. Mở tab "Lò Viết Bài" để duyệt.`)
    // CHỈ gỡ những chủ đề đã thực sự gửi đi (không gỡ phần dư chưa viết).
    const done = new Set(kws)
    trendCandidates.value = trendCandidates.value.filter((k) => !done.has(k))
    trendSelected.value = new Set([...trendSelected.value].filter((k) => !done.has(k)))
    await loadBaiViet()
    tab.value = 'viet'
  } catch (e: any) {
    flash('err', e.message || 'Viết nháp xu hướng thất bại')
  } finally {
    runningTrend.value = false
  }
}

onMounted(() => {
  loadDoiThu()
  loadCum()
  loadBaiViet()
})
</script>

<template>
  <div class="seo-radar">
    <!-- Giới thiệu -->
    <div class="intro">
      <h2 class="intro-title">🛰️ Radar Đối Thủ SEO</h2>
      <p class="intro-sub">
        Thêm domain đối thủ → <strong>Quét Sitemap</strong> để gom bài blog → <strong>Phân Tích</strong> bằng AI
        (Chủ đề / Từ khoá / Tóm tắt) → <strong>Tìm Khoảng Trống</strong> để biết bạn nên viết gì. Tất cả chạy bằng
        AI của chính bạn, không cần n8n hay Google Sheet.
      </p>
    </div>

    <!-- Banner thông báo -->
    <Transition name="fade">
      <div v-if="message" class="banner" :class="`banner--${message.kind}`">
        <span>{{ message.text }}</span>
        <button class="banner-x" @click="message = null" aria-label="Đóng">×</button>
      </div>
    </Transition>

    <!-- Thanh chuyển tab -->
    <div class="tabbar">
      <button class="tab" :class="{ on: tab === 'radar' }" @click="tab = 'radar'">🛰️ Radar Đối Thủ</button>
      <button class="tab" :class="{ on: tab === 'viet' }" @click="tab = 'viet'">✍️ Lò Viết Bài</button>
      <button class="tab" :class="{ on: tab === 'trend' }" @click="tab = 'trend'">📈 Xu Hướng</button>
    </div>

    <!-- ===== TAB RADAR ===== -->
    <div v-show="tab === 'radar'" class="tabwrap">
    <!-- Bước 1: thêm đối thủ -->
    <section class="card">
      <div class="card-head">
        <h3>1 · Thêm đối thủ (hoặc site của bạn)</h3>
      </div>
      <div class="add-form">
        <input
          v-model="form.domain"
          class="inp inp--domain"
          placeholder="dokinhlac.com.vn"
          @keyup.enter="addDoiThu"
        />
        <input v-model="form.ten" class="inp inp--ten" placeholder="Tên gợi nhớ (tuỳ chọn)" @keyup.enter="addDoiThu" />
        <label class="chk" title="Đánh dấu nếu đây là website của chính bạn (để làm mốc so sánh)">
          <input type="checkbox" v-model="form.la_cua_minh" />
          <span>Đây là site của tôi</span>
        </label>
        <button class="btn btn--primary" :disabled="adding" @click="addDoiThu">
          {{ adding ? 'Đang thêm…' : '+ Thêm' }}
        </button>
      </div>
    </section>

    <!-- Bước 2: danh sách đối thủ -->
    <section class="card">
      <div class="card-head">
        <h3>2 · Danh sách & quét</h3>
        <label class="batch-limit">
          Phân tích mỗi lần:
          <select v-model.number="batchLimit" class="inp inp--sm">
            <option :value="5">5 bài</option>
            <option :value="10">10 bài</option>
            <option :value="15">15 bài</option>
          </select>
        </label>
      </div>

      <p v-if="loadingList" class="muted">Đang tải…</p>
      <p v-else-if="!doiThuList.length" class="muted">Chưa có đối thủ nào. Thêm ở bước 1 phía trên.</p>

      <div v-else class="doithu-grid">
        <div
          v-for="d in doiThuList"
          :key="d.id"
          class="doithu"
          :class="{ active: selectedDoiThuId === d.id, mine: d.la_cua_minh }"
        >
          <div class="doithu-top">
            <div class="doithu-name">
              <span class="badge" :class="d.la_cua_minh ? 'badge--mine' : 'badge--comp'">
                {{ d.la_cua_minh ? 'Của tôi' : 'Đối thủ' }}
              </span>
              <a :href="`https://${d.domain}`" target="_blank" rel="noopener" class="doithu-domain">{{ d.domain }}</a>
            </div>
            <button class="icon-btn" :disabled="isBusy(d.id)" title="Xoá" @click="removeDoiThu(d)">🗑</button>
          </div>
          <div v-if="d.ten" class="doithu-ten">{{ d.ten }}</div>

          <div class="stats">
            <span class="stat">Tổng <b>{{ d.thong_ke.tong }}</b></span>
            <span class="stat stat--cho">Chờ <b>{{ d.thong_ke.cho }}</b></span>
            <span class="stat stat--ok">Đã PT <b>{{ d.thong_ke.da_phan_tich }}</b></span>
            <span v-if="d.thong_ke.loi" class="stat stat--err">Lỗi <b>{{ d.thong_ke.loi }}</b></span>
          </div>

          <div class="doithu-actions">
            <button class="btn btn--sm" :disabled="isBusy(d.id)" @click="crawl(d)">
              {{ isBusy(d.id) ? '…' : 'Quét Sitemap' }}
            </button>
            <button
              class="btn btn--sm btn--accent"
              :disabled="isBusy(d.id) || d.thong_ke.cho === 0"
              @click="analyzeBatch(d)"
            >
              Phân Tích ({{ d.thong_ke.cho }})
            </button>
            <button class="btn btn--sm btn--ghost" :disabled="isBusy(d.id)" @click="loadUrls(d.id)">Xem URL</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Bảng URL của đối thủ đang chọn -->
    <section v-if="selectedDoiThu" class="card">
      <div class="card-head">
        <h3>URL của «{{ selectedDoiThu.domain }}»</h3>
        <div class="filters">
          <button
            v-for="f in (['all', 'cho', 'da_phan_tich', 'loi'] as const)"
            :key="f"
            class="chip-btn"
            :class="{ on: urlFilter === f }"
            @click="urlFilter = f"
          >
            {{ f === 'all' ? 'Tất cả' : TRANG_THAI_LABEL[f] }}
          </button>
        </div>
      </div>

      <p v-if="loadingUrls" class="muted">Đang tải URL…</p>
      <p v-else-if="!filteredUrls.length" class="muted">Không có URL nào trong bộ lọc này.</p>

      <div v-else class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th class="col-url">URL</th>
              <th class="col-st">Trạng thái</th>
              <th>Chủ đề</th>
              <th>Từ khoá</th>
              <th class="col-act"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in filteredUrls" :key="u.id">
              <td class="col-url">
                <a :href="u.url" target="_blank" rel="noopener" :title="u.url">{{ shortUrl(u.url) }}</a>
              </td>
              <td class="col-st">
                <span class="badge" :class="`st--${u.trang_thai}`">{{ TRANG_THAI_LABEL[u.trang_thai] }}</span>
              </td>
              <td>
                <span v-if="u.chu_de" :title="u.tom_tat || ''">{{ u.chu_de }}</span>
                <span v-else-if="u.trang_thai === 'loi'" class="err-text" :title="u.loi || ''">{{ u.loi }}</span>
                <span v-else class="muted">—</span>
              </td>
              <td>
                <span v-if="u.tu_khoa" class="kw">{{ u.tu_khoa }}</span>
                <span v-else class="muted">—</span>
              </td>
              <td class="col-act">
                <button class="btn btn--xs" :disabled="isBusy(u.id)" @click="analyzeOne(u)">
                  {{ isBusy(u.id) ? '…' : u.trang_thai === 'da_phan_tich' ? 'Lại' : 'Phân tích' }}
                </button>
                <button class="icon-btn" :disabled="isBusy(u.id)" title="Xoá URL" @click="removeUrl(u)">×</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Bước 3: gap analysis -->
    <section class="card">
      <div class="card-head">
        <h3>3 · Khoảng trống nội dung — bạn nên viết gì</h3>
        <button
          class="btn btn--primary"
          :disabled="runningGap || !hasCompetitorAnalyzed"
          @click="runGap"
        >
          {{ runningGap ? 'Đang phân tích…' : 'Tìm Khoảng Trống' }}
        </button>
      </div>

      <p v-if="!hasCompetitorAnalyzed" class="muted">
        Cần ít nhất 1 đối thủ đã được phân tích (bước 2) thì mới chạy được.
      </p>
      <p v-else-if="!cumList.length" class="muted">Chưa có gợi ý. Bấm "Tìm Khoảng Trống" để AI đề xuất.</p>

      <div v-else class="cum-grid">
        <div v-for="c in cumList" :key="c.id" class="cum">
          <div class="cum-top">
            <span class="cum-score" :title="'Điểm ưu tiên (1-15)'">{{ c.diem_uu_tien }}</span>
            <h4 class="cum-name">{{ c.ten_cum }}</h4>
          </div>
          <div v-if="c.tu_khoa_muc_tieu" class="cum-kw"><b>Từ khoá:</b> {{ c.tu_khoa_muc_tieu }}</div>
          <div v-if="c.y_tuong_noi_dung" class="cum-idea"><b>Ý tưởng:</b> {{ c.y_tuong_noi_dung }}</div>
          <div v-if="c.ly_do" class="cum-why">{{ c.ly_do }}</div>
        </div>
      </div>
    </section>
    </div>
    <!-- /TAB RADAR -->

    <!-- ===== TAB LÒ VIẾT BÀI ===== -->
    <div v-show="tab === 'viet'" class="tabwrap">
      <!-- Tiến trình khi AI đang viết nháp (ước lượng theo thời gian) -->
      <div v-if="genBusy !== null" class="gen-prog" role="status" aria-live="polite">
        <div class="gen-prog-head">
          <span class="gen-spin" aria-hidden="true"></span>
          <span class="gen-prog-stage">{{ genStage }}</span>
          <span class="gen-prog-pct">{{ genProgress }}%</span>
        </div>
        <div class="gen-bar"><div class="gen-bar-fill" :style="{ width: genProgress + '%' }"></div></div>
        <p class="gen-prog-note">
          AI đang viết &amp; rà soát bài (~30–60 giây). Đừng đóng tab. % là ước lượng theo thời gian, không phải tiến độ thật.
        </p>
      </div>

      <!-- Viết từ cụm gợi ý -->
      <section class="card">
        <div class="card-head"><h3>Viết bài từ cụm gợi ý</h3></div>
        <p v-if="!cumList.length" class="muted">
          Chưa có cụm nào. Sang tab <b>Radar Đối Thủ</b>, chạy "Tìm Khoảng Trống" để AI gợi ý cụm trước.
        </p>
        <div v-else class="cum-grid">
          <div v-for="c in cumList" :key="c.id" class="cum">
            <div class="cum-top">
              <span class="cum-score">{{ c.diem_uu_tien }}</span>
              <h4 class="cum-name">{{ c.ten_cum }}</h4>
            </div>
            <div v-if="c.tu_khoa_muc_tieu" class="cum-kw"><b>Từ khoá:</b> {{ c.tu_khoa_muc_tieu }}</div>
            <button class="btn btn--accent btn--sm" :disabled="genBusy !== null" @click="genFromCum(c)">
              {{ genBusy === c.id ? 'Đang viết…' : '✍️ Viết nháp' }}
            </button>
          </div>
        </div>
      </section>

      <!-- Viết tự do -->
      <section class="card">
        <div class="card-head"><h3>Hoặc viết từ chủ đề tự nhập</h3></div>
        <div class="add-form">
          <input
            v-model="freeChuDe"
            class="inp inp--domain"
            placeholder="Chủ đề (vd: Cách bấm huyệt Hợp Cốc giảm đau đầu)"
          />
          <input v-model="freeTuKhoa" class="inp inp--ten" placeholder="Từ khoá, cách nhau dấu phẩy (tuỳ chọn)" />
          <button class="btn btn--primary" :disabled="genBusy !== null" @click="genFree">
            {{ genBusy === -1 ? 'Đang viết…' : '✍️ Viết nháp' }}
          </button>
        </div>
      </section>

      <!-- Danh sách nháp -->
      <section class="card">
        <div class="card-head"><h3>Bản nháp ({{ baiVietList.length }})</h3></div>
        <p v-if="!baiVietList.length" class="muted">Chưa có bản nháp. Bấm "Viết nháp" ở trên để AI tạo bài.</p>
        <div v-else class="table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Tiêu đề</th>
                <th class="col-st">An toàn (YMYL)</th>
                <th class="col-st">Trạng thái</th>
                <th class="col-act"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in baiVietList" :key="a.id">
                <td>
                  <strong>{{ a.tieu_de }}</strong><br />
                  <span class="muted">/blog/{{ a.slug }}</span>
                </td>
                <td class="col-st">
                  <span
                    class="badge"
                    :class="a.do_rui_ro === 'rui_ro' ? 'st--loi' : 'st--da_phan_tich'"
                    :title="a.ly_do_rui_ro || ''"
                  >
                    {{ a.do_rui_ro === 'rui_ro' ? '🔴 Cần duyệt' : '🟢 An toàn' }}
                  </span>
                </td>
                <td class="col-st"><span class="badge badge--comp">{{ TT_BAIVIET[a.trang_thai] }}</span></td>
                <td class="col-act">
                  <button class="btn btn--xs" @click="openEditor(a)">Mở</button>
                  <button
                    class="btn btn--xs btn--pub"
                    :disabled="publishingId === a.id || (a.trang_thai !== 'da_duyet' && a.trang_thai !== 'da_dang')"
                    :title="a.trang_thai === 'da_duyet' || a.trang_thai === 'da_dang' ? 'Ghi file blog + chuyển Đã đăng' : 'Cần duyệt (đổi sang Đã duyệt) trước khi đăng'"
                    @click="publishArticle(a)"
                  >
                    {{ publishingId === a.id ? '…' : a.trang_thai === 'da_dang' ? '↻ Đăng lại' : '🚀 Đăng' }}
                  </button>
                  <button
                    v-if="a.trang_thai === 'da_dang'"
                    class="btn btn--xs"
                    title="Mở bài trên web (hiện được sau khi build/deploy)"
                    @click="viewArticle(a)"
                  >
                    👁 Xem
                  </button>
                  <button class="icon-btn" title="Xoá nháp" @click="deleteBaiViet(a)">×</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
    <!-- /TAB LÒ VIẾT BÀI -->

    <!-- ===== TAB XU HƯỚNG ===== -->
    <div v-show="tab === 'trend'" class="tabwrap">
      <section class="card">
        <div class="card-head"><h3>Quét xu hướng tìm kiếm (Google Suggest — miễn phí)</h3></div>
        <p class="muted">
          Nhập vài từ khoá gốc của ngách (mỗi dòng 1 cái). Hệ thống lấy <b>gợi ý tìm kiếm thật</b> mà người dùng đang gõ
          trên Google → ra danh sách chủ đề nên viết (tự bỏ những bài bạn đã viết).
        </p>
        <textarea v-model="trendSeeds" class="inp ta" rows="5" spellcheck="false"></textarea>
        <div style="margin-top: var(--space-3)">
          <button class="btn btn--primary" :disabled="discovering" @click="discoverTrends">
            {{ discovering ? 'Đang quét…' : '🔎 Quét Xu Hướng' }}
          </button>
        </div>
      </section>

      <section v-if="trendCandidates.length" class="card">
        <div class="card-head">
          <h3>Chủ đề ứng viên ({{ trendCandidates.length }}) — tích chọn để viết</h3>
          <button
            class="btn btn--accent"
            :disabled="runningTrend || trendSelected.size === 0"
            @click="runTrendDrafts"
          >
            {{ runningTrend ? 'Đang viết…' : `✍️ Viết Nháp (${Math.min(trendSelected.size, TREND_MAX)})` }}
          </button>
        </div>
        <div class="cand-grid">
          <label v-for="k in trendCandidates" :key="k" class="cand" :class="{ on: trendSelected.has(k) }">
            <input type="checkbox" :checked="trendSelected.has(k)" @change="toggleCand(k)" />
            <span>{{ k }}</span>
          </label>
        </div>
        <p v-if="trendSelected.size > TREND_MAX" class="muted" style="margin-top: var(--space-3); color: var(--brown-700)">
          Đang chọn {{ trendSelected.size }} nhưng mỗi lần chỉ viết <b>{{ TREND_MAX }}</b> bài đầu (tránh quá thời gian). Viết xong cứ bấm tiếp cho các bài còn lại.
        </p>
        <p class="muted" style="margin-top: var(--space-3)">
          Tối đa {{ TREND_MAX }} bài/lần (mỗi bài ~30s). Bài viết xong nằm ở tab "Lò Viết Bài", mặc định <b>chờ duyệt / noindex</b> theo van an toàn YMYL.
        </p>
      </section>

      <section class="card">
        <div class="card-head"><h3>Tự chạy hằng tuần (tuỳ chọn)</h3></div>
        <p class="muted">
          Khi đã quen, bật cron tuần bằng biến môi trường <b>SEO_TREND_CRON=true</b> ở backend → mỗi tuần tự tạo 1 nháp
          vào hàng chờ (vẫn cần bạn duyệt mới đăng). Mặc định <b>TẮT</b> để bạn kiểm soát.
        </p>
      </section>
    </div>
    <!-- /TAB XU HƯỚNG -->

    <!-- Modal sửa bản nháp -->
    <div v-if="editing" class="ed-overlay" @click.self="closeEditor">
      <div class="ed-modal">
        <div class="ed-head">
          <h3>Sửa Bản Nháp</h3>
          <button class="tc-close" @click="closeEditor" aria-label="Đóng">×</button>
        </div>
        <div class="ed-body">
          <div v-if="editing.do_rui_ro === 'rui_ro'" class="ymyl-warn">
            🔴 <b>Nội dung y tế cần duyệt kỹ (YMYL).</b>
            {{ editing.ly_do_rui_ro }} Hãy rà soát kỹ trước khi đăng; cân nhắc để noindex tới khi chắc chắn.
          </div>
          <label class="ed-field"><span>Tiêu đề</span><input v-model="editing.tieu_de" class="inp" /></label>
          <div class="ed-row">
            <label class="ed-field"><span>Slug (URL)</span><input v-model="editing.slug" class="inp" /></label>
            <label class="ed-field"><span>Chuyên mục</span><input v-model="editing.category" class="inp" /></label>
          </div>
          <label class="ed-field">
            <span>Meta description</span>
            <textarea v-model="editing.meta_description" class="inp ta" rows="2"></textarea>
          </label>
          <label class="ed-field"><span>Từ khoá (cách nhau dấu phẩy)</span><input v-model="editing.tu_khoa" class="inp" /></label>
          <label class="ed-field">
            <span>Nguồn tham khảo <small>(mỗi dòng: <b>Tên | URL</b> — để trống URL nếu chưa chắc; tăng độ tin cậy E-E-A-T)</small></span>
            <textarea
              v-model="nguonText"
              class="inp ta"
              rows="3"
              spellcheck="false"
              placeholder="Lê Văn Sửu — Biện Chứng Luận Trị&#10;Viện Y học cổ truyền Trung ương | https://..."
            ></textarea>
          </label>

          <label class="ed-field">
            <span>Câu hỏi thường gặp (FAQ) <small>(mỗi dòng 1 câu: <b>Câu hỏi | Trả lời</b> — xuất ra schema FAQPage)</small></span>
            <textarea
              v-model="faqText"
              class="inp ta"
              rows="4"
              spellcheck="false"
              placeholder="Đo kinh lạc có đau không? | Không, đầu đo chỉ chạm nhẹ ngoài da tại tỉnh huyệt.&#10;Đo mất bao lâu? | Khoảng 5–10 phút cho 24 tỉnh huyệt."
            ></textarea>
          </label>

          <!-- Ảnh bìa tự chọn theo chủ đề (đổi bằng cách sửa tiêu đề/từ khoá) -->
          <div class="ed-field">
            <span>Ảnh bìa <small>(tự chọn theo chủ đề — đổi bằng cách sửa tiêu đề / từ khoá)</small></span>
            <div class="cover-prev">
              <img :src="coverImageFor(editing)" :alt="editing.tieu_de" class="cover-prev-img" loading="lazy" />
              <code class="cover-prev-path">{{ coverImageFor(editing) }}</code>
            </div>
          </div>

          <!-- Checklist kiểm duyệt thủ công (van YMYL: đủ 4 mới được "Đã duyệt") -->
          <fieldset class="kd-box" :class="{ 'kd-box--ok': kiemDuyetDu }">
            <legend>Checklist kiểm duyệt <small>(tick đủ 4 mới chuyển được "Đã duyệt")</small></legend>
            <label v-for="it in KIEM_DUYET_ITEMS" :key="it.key" class="kd-item">
              <input
                type="checkbox"
                :checked="kiemDuyet[it.key] === true"
                @change="toggleKiem(it.key, ($event.target as HTMLInputElement).checked)"
              />
              <span>{{ it.label }}</span>
            </label>
            <p class="kd-status" :class="kiemDuyetDu ? 'kd-status--ok' : 'kd-status--warn'">
              {{ kiemDuyetDu ? '✔ Đủ điều kiện duyệt' : '⚠ Chưa đủ — còn mục chưa tick, chưa thể "Đã duyệt"' }}
            </p>
          </fieldset>

          <div class="ed-row">
            <label class="ed-field">
              <span>CTA</span>
              <select v-model="editing.cta" class="inp">
                <option v-for="o in CTA_OPTIONS" :key="o" :value="o">{{ o }}</option>
              </select>
            </label>
            <label class="ed-field">
              <span>Trạng thái</span>
              <select v-model="editing.trang_thai" class="inp">
                <option value="nhap">Nháp</option>
                <option value="da_duyet" :disabled="!kiemDuyetDu">Đã duyệt{{ kiemDuyetDu ? '' : ' (cần đủ checklist)' }}</option>
                <option value="bo_qua">Bỏ qua</option>
                <option value="da_dang" :disabled="!kiemDuyetDu">Đã đăng{{ kiemDuyetDu ? '' : ' (cần đủ checklist)' }}</option>
              </select>
            </label>
          </div>
          <label class="ed-field">
            <span>Nội dung (Markdown — không có tiêu đề H1, FAQ lưu riêng)</span>
            <textarea v-model="editing.noi_dung_md" class="inp ta ta--big" rows="18" spellcheck="false"></textarea>
          </label>
        </div>
        <div class="ed-foot">
          <button class="btn btn--ghost" @click="closeEditor">Đóng</button>
          <button class="btn btn--ghost" :disabled="exportingId === editing.id" @click="exportMd(editing)">
            {{ exportingId === editing.id ? '…' : 'Xuất JSON' }}
          </button>
          <button
            class="btn btn--ghost btn--pub-ghost"
            :disabled="publishingId === editing.id || (editing.trang_thai !== 'da_duyet' && editing.trang_thai !== 'da_dang')"
            title="Ghi file blog + chuyển Đã đăng (cần Đã duyệt)"
            @click="publishArticle(editing)"
          >
            {{ publishingId === editing.id ? 'Đang đăng…' : '🚀 Đăng' }}
          </button>
          <button
            v-if="editing.trang_thai === 'da_dang'"
            class="btn btn--ghost"
            title="Mở bài trên web (sau khi build/deploy)"
            @click="viewArticle(editing)"
          >
            👁 Xem
          </button>
          <button class="btn btn--primary" :disabled="savingEditor" @click="saveEditor">
            {{ savingEditor ? 'Đang lưu…' : 'Lưu' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Overlay tiến trình khi Đăng (chạy bar tới khi xong → bật nút Xem) -->
    <div v-if="pubModal" class="ed-overlay" @click.self="(pubDone || pubError) && closePubModal()">
      <div class="pub-card" role="status" aria-live="polite">
        <h3 class="pub-title">
          {{ pubError ? '✗ Đăng thất bại' : pubDone ? '✓ Đã đăng bài' : '🚀 Đang đăng bài…' }}
        </h3>
        <p v-if="pubTarget" class="pub-name">{{ pubTarget.tieu_de }}</p>

        <template v-if="!pubError">
          <div class="gen-prog-head">
            <span v-if="!pubDone" class="gen-spin" aria-hidden="true"></span>
            <span class="gen-prog-stage">{{ pubStage }}</span>
            <span class="gen-prog-pct">{{ pubProgress }}%</span>
          </div>
          <div class="gen-bar"><div class="gen-bar-fill" :style="{ width: pubProgress + '%' }"></div></div>
        </template>
        <p v-else class="pub-err">{{ pubError }}</p>

        <p v-if="!pubDone && !pubError" class="gen-prog-note">
          Đang ghi bài lên máy này. Đừng đóng cửa sổ. (% là ước lượng theo thời gian, không phải tiến độ thật.)
        </p>
        <p v-if="pubDone && pubNote" class="gen-prog-note">{{ pubNote }}</p>

        <div class="pub-foot">
          <button
            v-if="pubDone"
            class="btn btn--primary"
            :disabled="!pubTarget?.slug"
            title="Mở bài trên web (chỉ hiện sau khi build/deploy)"
            @click="pubTarget && viewArticle(pubTarget)"
          >
            👁 Xem Bài
          </button>
          <button class="btn btn--ghost" :disabled="!pubDone && !pubError" @click="closePubModal">
            {{ pubDone || pubError ? 'Đóng' : 'Đang xử lý…' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.seo-radar { display: flex; flex-direction: column; gap: var(--space-5); max-width: 1100px; }

.intro-title { font-size: var(--font-size-xl); font-weight: 800; color: var(--brown-800); }
.intro-sub { margin-top: var(--space-2); color: var(--text-muted); font-size: var(--font-size-sm); line-height: 1.6; }

/* Banner */
.banner { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); font-weight: 500; }
.banner--ok { background: var(--success-bg, #e8f5e9); color: var(--success, #2e7d32); }
.banner--err { background: var(--danger-bg); color: var(--danger); }
.banner--info { background: var(--brown-50); color: var(--brown-700); }
.banner-x { font-size: 20px; line-height: 1; color: inherit; opacity: .7; }
.banner-x:hover { opacity: 1; }

/* Card */
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-5); }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-4); flex-wrap: wrap; }
.card-head h3 { font-size: var(--font-size-md); font-weight: 700; color: var(--text); }

.muted { color: var(--text-subtle); font-size: var(--font-size-sm); }

/* Form thêm */
.add-form { display: flex; gap: var(--space-3); flex-wrap: wrap; align-items: center; }
.inp { height: 40px; padding: 0 var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); color: var(--text); font-size: var(--font-size-sm); }
.inp:focus { outline: none; border-color: var(--brown-400); box-shadow: var(--focus-ring); }
.inp--domain { flex: 1; min-width: 220px; }
.inp--ten { flex: 1; min-width: 180px; }
.inp--sm { height: 34px; min-width: 90px; }
.chk { display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-sm); color: var(--text-muted); white-space: nowrap; }
.batch-limit { font-size: var(--font-size-sm); color: var(--text-muted); display: flex; align-items: center; gap: var(--space-2); }

/* Nút */
.btn { height: 40px; padding: 0 var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); font-weight: 600; transition: all var(--transition-fast); border: 1px solid transparent; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn--primary { background: var(--brown-600); color: #fff; }
.btn--primary:not(:disabled):hover { background: var(--brown-700); }
.btn--accent { background: var(--brown-100); color: var(--brown-800); }
.btn--accent:not(:disabled):hover { background: var(--brown-200); }
.btn--ghost { background: transparent; border-color: var(--border); color: var(--text-muted); }
.btn--ghost:not(:disabled):hover { background: var(--gray-100); }
.btn--sm { height: 34px; padding: 0 var(--space-3); font-size: var(--font-size-xs); background: var(--surface); border-color: var(--border); color: var(--brown-700); }
.btn--sm:not(:disabled):hover { background: var(--brown-50); }
.btn--xs { height: 28px; padding: 0 var(--space-2); font-size: var(--font-size-xs); background: var(--brown-50); color: var(--brown-700); }
.btn--xs:not(:disabled):hover { background: var(--brown-100); }
.btn--xs.btn--pub { background: var(--brown-600); color: #fff; }
.btn--xs.btn--pub:not(:disabled):hover { background: var(--brown-700); }
.btn--pub-ghost { color: var(--brown-700); border-color: var(--brown-300); }
.icon-btn { width: 30px; height: 30px; border-radius: var(--radius-sm); color: var(--gray-500); font-size: 16px; }
.icon-btn:not(:disabled):hover { background: var(--danger-bg); color: var(--danger); }

/* Lưới đối thủ */
.doithu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-3); }
.doithu { border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); transition: all var(--transition-fast); }
.doithu.active { border-color: var(--brown-400); box-shadow: var(--focus-ring); }
.doithu.mine { background: var(--brown-50); }
.doithu-top { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-2); }
.doithu-name { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; min-width: 0; }
.doithu-domain { font-weight: 700; color: var(--brown-800); word-break: break-all; }
.doithu-domain:hover { text-decoration: underline; }
.doithu-ten { font-size: var(--font-size-xs); color: var(--text-subtle); margin-top: -4px; }

.badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: var(--radius-full); white-space: nowrap; }
.badge--comp { background: var(--brown-100); color: var(--brown-700); }
.badge--mine { background: #e3f2fd; color: #1565c0; }
.st--cho { background: #fff3e0; color: #e65100; }
.st--da_phan_tich { background: #e8f5e9; color: #2e7d32; }
.st--loi { background: var(--danger-bg); color: var(--danger); }

.stats { display: flex; gap: var(--space-3); flex-wrap: wrap; font-size: var(--font-size-xs); color: var(--text-muted); }
.stat b { color: var(--text); }
.stat--cho b { color: #e65100; }
.stat--ok b { color: #2e7d32; }
.stat--err b { color: var(--danger); }

.doithu-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }

/* Bảng URL */
.table-wrap { overflow-x: auto; }
.tbl { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
.tbl th, .tbl td { text-align: left; padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--gray-100); vertical-align: top; }
.tbl th { font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: .03em; color: var(--text-subtle); font-weight: 700; }
.col-url { max-width: 260px; }
.col-url a { color: var(--brown-700); word-break: break-all; }
.col-st { white-space: nowrap; }
.col-act { white-space: nowrap; text-align: right; display: flex; gap: 4px; justify-content: flex-end; }
.kw { color: var(--brown-700); }
.err-text { color: var(--danger); font-size: var(--font-size-xs); }

.filters, .doithu-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.chip-btn { height: 30px; padding: 0 var(--space-3); border-radius: var(--radius-full); border: 1px solid var(--border); font-size: var(--font-size-xs); color: var(--text-muted); }
.chip-btn.on { background: var(--brown-600); color: #fff; border-color: var(--brown-600); }

/* Cụm gợi ý */
.cum-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--space-3); }
.cum { border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); }
.cum-top { display: flex; align-items: center; gap: var(--space-3); }
.cum-score { width: 34px; height: 34px; flex-shrink: 0; border-radius: var(--radius-full); background: linear-gradient(135deg, var(--brown-500), var(--brown-700)); color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.cum-name { font-size: var(--font-size-sm); font-weight: 700; color: var(--brown-800); }
.cum-kw, .cum-idea { font-size: var(--font-size-xs); color: var(--text-muted); line-height: 1.5; }
.cum-kw b, .cum-idea b { color: var(--text); }
.cum-why { font-size: var(--font-size-xs); color: var(--text-subtle); font-style: italic; }

/* Tab */
.tabbar { display: flex; gap: var(--space-2); border-bottom: 1px solid var(--border); }
.tab { height: 42px; padding: 0 var(--space-5); font-size: var(--font-size-sm); font-weight: 700; color: var(--text-muted); border-bottom: 3px solid transparent; margin-bottom: -1px; }
.tab.on { color: var(--brown-800); border-bottom-color: var(--brown-600); }
.tab:not(.on):hover { color: var(--brown-700); }
.tabwrap { display: flex; flex-direction: column; gap: var(--space-5); }

/* Editor modal */
.ed-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(28,24,18,.5); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; padding: var(--space-4); }
.ed-modal { width: 100%; max-width: 760px; max-height: 92vh; background: var(--surface); border-radius: var(--radius-lg); box-shadow: var(--shadow-xl); display: flex; flex-direction: column; overflow: hidden; }
.ed-head { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--gray-100); }
.ed-head h3 { font-size: var(--font-size-md); font-weight: 700; }
.tc-close { width: 32px; height: 32px; border-radius: var(--radius-sm); font-size: 22px; line-height: 1; color: var(--gray-500); }
.tc-close:hover { background: var(--gray-100); color: var(--text); }
.ed-body { padding: var(--space-5); overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-3); }
.ed-field { display: flex; flex-direction: column; gap: 4px; }
.ed-field > span { font-size: var(--font-size-xs); font-weight: 600; color: var(--text-muted); }
.ed-row { display: flex; gap: var(--space-3); }
.ed-row .ed-field { flex: 1; }
.ta { padding: var(--space-2) var(--space-3); height: auto; resize: vertical; font-family: inherit; line-height: 1.5; }
.ta--big { min-height: 320px; font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 13px; }
.ed-foot { display: flex; justify-content: flex-end; gap: var(--space-3); padding: var(--space-4) var(--space-5); border-top: 1px solid var(--gray-100); background: var(--surface-2); }
.ymyl-warn { background: var(--danger-bg); color: var(--danger); padding: var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-sm); line-height: 1.5; }

/* Lưới chủ đề ứng viên (Xu Hướng) */
.cand-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-2); }
.cand { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-md); font-size: var(--font-size-sm); color: var(--text); cursor: pointer; transition: all var(--transition-fast); }
.cand:hover { background: var(--brown-50); }
.cand.on { background: var(--brown-50); border-color: var(--brown-400); color: var(--brown-800); font-weight: 600; }
.cand input { flex-shrink: 0; }

/* Tiến trình "Viết nháp" */
.gen-prog { background: var(--brown-50); border: 1px solid var(--brown-200); border-radius: var(--radius-md); padding: var(--space-4); }
.gen-prog-head { display: flex; align-items: center; gap: var(--space-2); }
.gen-prog-stage { flex: 1; font-size: var(--font-size-sm); font-weight: 600; color: var(--brown-800); }
.gen-prog-pct { font-size: var(--font-size-sm); font-weight: 800; color: var(--brown-700); font-variant-numeric: tabular-nums; }
.gen-bar { margin-top: var(--space-2); height: 8px; border-radius: var(--radius-full); background: var(--brown-100); overflow: hidden; }
.gen-bar-fill { height: 100%; border-radius: var(--radius-full); background: linear-gradient(90deg, var(--brown-500), var(--brown-700)); transition: width .35s ease; }
.gen-prog-note { margin-top: var(--space-2); font-size: var(--font-size-xs); color: var(--text-subtle); line-height: 1.5; }
.gen-spin { width: 16px; height: 16px; flex-shrink: 0; border: 2px solid var(--brown-200); border-top-color: var(--brown-600); border-radius: 50%; animation: gen-spin 0.8s linear infinite; }
@keyframes gen-spin { to { transform: rotate(360deg); } }

.fade-enter-active, .fade-leave-active { transition: opacity var(--transition-base); }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Ảnh bìa preview + checklist kiểm duyệt */
.cover-prev { display: flex; align-items: center; gap: var(--space-3); }
.cover-prev-img {
  width: 160px; height: 84px; object-fit: cover; border-radius: var(--radius-md);
  border: 1px solid var(--brown-200); background: var(--brown-50); flex-shrink: 0;
}
.cover-prev-path { font-size: var(--font-size-xs); color: var(--text-subtle); word-break: break-all; }

.kd-box {
  margin: var(--space-3) 0; padding: var(--space-3); border: 1px solid var(--brown-200);
  border-radius: var(--radius-md); background: var(--brown-50);
}
.kd-box--ok { border-color: var(--success, #2e7d32); background: color-mix(in srgb, var(--success, #2e7d32) 8%, transparent); }
.kd-box legend { font-weight: 600; font-size: var(--font-size-sm); padding: 0 var(--space-2); }
.kd-box legend small { font-weight: 400; color: var(--text-subtle); }
.kd-item { display: flex; align-items: flex-start; gap: var(--space-2); padding: var(--space-1) 0; font-size: var(--font-size-sm); cursor: pointer; }
.kd-item input { margin-top: 3px; flex-shrink: 0; }
.kd-status { margin: var(--space-2) 0 0; font-size: var(--font-size-xs); font-weight: 600; }
.kd-status--ok { color: var(--success, #2e7d32); }
.kd-status--warn { color: var(--warning, #b26a00); }

/* Overlay tiến trình khi Đăng */
.pub-card {
  width: min(440px, 92vw); background: var(--surface, #fff); border: 1px solid var(--brown-200);
  border-radius: var(--radius-lg); padding: var(--space-5); box-shadow: var(--shadow-lg, 0 12px 32px rgba(0,0,0,.18));
  display: flex; flex-direction: column; gap: var(--space-3);
}
.pub-title { font-size: var(--font-size-lg); font-weight: 800; color: var(--brown-800); }
.pub-name { font-size: var(--font-size-sm); color: var(--text-muted); font-weight: 600; margin-top: calc(-1 * var(--space-2)); }
.pub-err { font-size: var(--font-size-sm); color: var(--danger, #c0392b); line-height: 1.5; }
.pub-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-2); }

@media (max-width: 768px) {
  .add-form { flex-direction: column; align-items: stretch; }
  .inp--domain, .inp--ten { min-width: 0; }
}
</style>
