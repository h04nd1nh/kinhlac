<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/services/api'

interface BenhTayYLite {
  id: number
  ten_benh: string
}
interface BaiThuocLite {
  id: number
  ten_bai_thuoc: string
}
interface Symptom {
  id: number
  ten_trieu_chung: string
  theBenhList?: string[]
  baiThuocList?: BaiThuocLite[]
  benhTayYList?: BenhTayYLite[]
  doPhoBien?: number
}

// ----- Chẩn đoán (diagnosis) -----
interface DiagnosisMatchedSymptom {
  id: number
  ten_trieu_chung: string
}
interface DiagnosisCandidate {
  id: number
  label: string
  subLabel: string | null
  groupLabel: string | null
  groupId: number | null
  score: number
  percent: number
  matchedCount: number
  total: number
  matched: DiagnosisMatchedSymptom[]
}
interface DiagnosisResult {
  input: DiagnosisMatchedSymptom[]
  phapTri: DiagnosisCandidate[]
  phapTriTotal: number
  benhTayY: DiagnosisCandidate[]
  benhTayYTotal: number
}

// Số chip tối đa hiển thị trong mỗi ô trước khi gộp phần còn lại thành "+N".
const CHIP_LIMIT = 6

const router = useRouter()

type MainTab = 'list' | 'diagnose'
const activeTab = ref<MainTab>('list')

const isLoading = ref(true)
const error = ref<string | null>(null)
const dataList = ref<Symptom[]>([])

// Modal state
const showModal = ref(false)
const isEditing = ref(false)
const editingId = ref<number | null>(null)
const formData = ref<{ ten_trieu_chung: string }>({ ten_trieu_chung: '' })
const isSaving = ref(false)

// Delete confirmation
const showDeleteModal = ref(false)
const deletingId = ref<number | null>(null)
const isDeleting = ref(false)

// Tìm kiếm danh sách
const searchQuery = ref('')

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(10)

// ----- Diagnosis state -----
const selectedSymptomIds = ref<number[]>([])
const symptomSearch = ref('')
const isDiagnosing = ref(false)
const diagError = ref<string | null>(null)
const diagResult = ref<DiagnosisResult | null>(null)
const hasRunDiagnosis = ref(false)

onMounted(async () => {
  await fetchData()
})

async function fetchData() {
  isLoading.value = true
  error.value = null
  try {
    // stats=1: trả kèm thể bệnh / bài thuốc / bệnh Tây Y và sắp xếp theo độ phổ biến giảm dần.
    const res: any = await api.get('/trieu-chung?stats=1')
    dataList.value = Array.isArray(res) ? res : (res.data || [])
  } catch (err: any) {
    console.error(err)
    error.value = 'Lỗi khi tải dữ liệu: ' + err.message
  } finally {
    isLoading.value = false
  }
}

function openCreateModal() {
  isEditing.value = false
  editingId.value = null
  formData.value = { ten_trieu_chung: '' }
  showModal.value = true
}

function openEditModal(item: Symptom) {
  isEditing.value = true
  editingId.value = item.id
  formData.value = { ten_trieu_chung: item.ten_trieu_chung }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

async function handleSave() {
  if (!formData.value.ten_trieu_chung.trim()) {
    alert('Vui lòng nhập tên triệu chứng')
    return
  }
  isSaving.value = true
  try {
    if (isEditing.value && editingId.value !== null) {
      await api.put(`/trieu-chung/${editingId.value}`, formData.value)
    } else {
      await api.post('/trieu-chung', formData.value)
    }
    closeModal()
    await fetchData()
  } catch (err: any) {
    console.error(err)
    alert('Lỗi khi lưu: ' + err.message)
  } finally {
    isSaving.value = false
  }
}

function openDeleteModal(id: number) {
  deletingId.value = id
  showDeleteModal.value = true
}

function closeDeleteModal() {
  showDeleteModal.value = false
  deletingId.value = null
}

async function handleDelete() {
  if (deletingId.value === null) return
  isDeleting.value = true
  try {
    await api.delete(`/trieu-chung/${deletingId.value}`)
    closeDeleteModal()
    await fetchData()
  } catch (err: any) {
    console.error(err)
    alert('Lỗi khi xóa: ' + err.message)
  } finally {
    isDeleting.value = false
  }
}

// Lọc theo tên triệu chứng kèm thể bệnh / bài thuốc / bệnh Tây Y hiển thị trong bảng.
const filteredList = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return dataList.value
  return dataList.value.filter((item) => {
    if (item.ten_trieu_chung.toLowerCase().includes(q)) return true
    if (item.theBenhList?.some((tb) => tb.toLowerCase().includes(q))) return true
    if (item.baiThuocList?.some((b) => b.ten_bai_thuoc.toLowerCase().includes(q))) return true
    if (item.benhTayYList?.some((b) => b.ten_benh.toLowerCase().includes(q))) return true
    return false
  })
})

const pagedList = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return filteredList.value.slice(start, start + itemsPerPage.value)
})

const totalPages = computed(() => Math.ceil(filteredList.value.length / itemsPerPage.value))

// Về trang đầu mỗi khi đổi từ khóa để không kẹt ở trang trống.
watch(searchQuery, () => {
  currentPage.value = 1
})

function getPageNumbers() {
  const pages: number[] = []
  const start = Math.max(1, currentPage.value - 2)
  const end = Math.min(totalPages.value, currentPage.value + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
}

// ----- Diagnosis logic -----
function phapTriHref(id: number): string {
  return router.resolve({ name: 'treatments', query: { ptId: id } }).href
}
function benhTayYHref(id: number): string {
  return router.resolve({
    name: 'western-medicine',
    query: { tab: 'benh-tay-y', btyId: id },
  }).href
}

const symptomOptions = computed<DiagnosisMatchedSymptom[]>(() =>
  dataList.value.map((s) => ({ id: s.id, ten_trieu_chung: s.ten_trieu_chung })),
)

const filteredSymptomOptions = computed(() => {
  const q = symptomSearch.value.trim().toLowerCase()
  if (!q) return symptomOptions.value
  return symptomOptions.value.filter((s) => s.ten_trieu_chung.toLowerCase().includes(q))
})

const selectedSymptoms = computed<DiagnosisMatchedSymptom[]>(() => {
  const map = new Map<number, DiagnosisMatchedSymptom>(
    symptomOptions.value.map((s) => [s.id, s]),
  )
  const out: DiagnosisMatchedSymptom[] = []
  for (const id of selectedSymptomIds.value) {
    const s = map.get(id)
    if (s) out.push(s)
  }
  return out
})

function toggleSymptom(id: number) {
  selectedSymptomIds.value = selectedSymptomIds.value.includes(id)
    ? selectedSymptomIds.value.filter((x) => x !== id)
    : [...selectedSymptomIds.value, id]
}

function clearSelectedSymptoms() {
  selectedSymptomIds.value = []
  diagResult.value = null
  hasRunDiagnosis.value = false
  diagError.value = null
}

async function runDiagnosis() {
  if (selectedSymptomIds.value.length === 0 || isDiagnosing.value) return
  isDiagnosing.value = true
  diagError.value = null
  try {
    const res = await api.post<DiagnosisResult>('/trieu-chung/chan-doan', {
      trieu_chung_ids: selectedSymptomIds.value,
    })
    diagResult.value = res
    hasRunDiagnosis.value = true
  } catch (err: any) {
    console.error(err)
    diagError.value = 'Lỗi khi chẩn đoán: ' + (err.message || String(err))
  } finally {
    isDiagnosing.value = false
  }
}

/** Phân nhóm màu theo độ tin cậy để tô badge + thanh tiến độ. */
function confidenceClass(percent: number): string {
  if (percent >= 60) return 'conf-high'
  if (percent >= 30) return 'conf-mid'
  return 'conf-low'
}

/** Nhãn chữ kèm theo % để bác sĩ đọc nhanh mức độ phù hợp. */
function confidenceLabel(percent: number): string {
  if (percent >= 60) return 'Rất phù hợp'
  if (percent >= 30) return 'Khá phù hợp'
  return 'Gợi ý'
}

const hasAnyResults = computed(
  () => !!diagResult.value && (diagResult.value.phapTri.length > 0 || diagResult.value.benhTayY.length > 0),
)

/** Các triệu chứng đã nhập nhưng không khớp với bất kỳ thể bệnh / bệnh Tây Y nào.
 *  Tín hiệu cho bác sĩ: dữ liệu chưa đầy đủ hoặc cần cân nhắc lại triệu chứng đó. */
const unexplainedSymptoms = computed<DiagnosisMatchedSymptom[]>(() => {
  const res = diagResult.value
  if (!res) return []
  const matchedIds = new Set<number>()
  for (const c of res.phapTri) for (const m of c.matched) matchedIds.add(m.id)
  for (const c of res.benhTayY) for (const m of c.matched) matchedIds.add(m.id)
  return res.input.filter((s) => !matchedIds.has(s.id))
})
</script>

<template>
  <div class="management-page">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">Quản Lý Triệu Chứng</h1>
        <p class="page-subtitle">Danh sách triệu chứng lâm sàng & công cụ gợi ý chẩn đoán</p>
      </div>
      <button v-if="activeTab === 'list'" class="btn-primary" @click="openCreateModal">+ Thêm mới</button>
    </div>

    <div class="main-tabs" role="tablist" aria-label="Chế độ xem triệu chứng">
      <button
        type="button"
        role="tab"
        class="main-tab"
        :class="{ active: activeTab === 'list' }"
        :aria-selected="activeTab === 'list'"
        @click="activeTab = 'list'"
      >
        Danh Sách
      </button>
      <button
        type="button"
        role="tab"
        class="main-tab"
        :class="{ active: activeTab === 'diagnose' }"
        :aria-selected="activeTab === 'diagnose'"
        @click="activeTab = 'diagnose'"
      >
        Chẩn Đoán
      </button>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Đang tải dữ liệu...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button class="btn-secondary mt-4" @click="fetchData">Thử lại</button>
    </div>

    <!-- TAB DANH SÁCH -->
    <div v-else-if="activeTab === 'list'" class="content-body">
      <div class="data-card">
        <div class="card-header">
          <h3>Danh sách Triệu Chứng</h3>
          <div class="picker-search list-search">
            <svg class="search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="2" />
              <path d="m17 17-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            <input
              v-model="searchQuery"
              type="search"
              class="search-input search-input--icon"
              placeholder="Tìm triệu chứng, thể bệnh, bài thuốc, bệnh Tây Y..."
              autocomplete="off"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="search-clear"
              aria-label="Xóa tìm kiếm"
              @click="searchQuery = ''"
            >×</button>
          </div>
          <span class="badge badge-warning">{{ filteredList.length }}<template v-if="searchQuery">/{{ dataList.length }}</template> triệu chứng</span>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th width="70">ID</th>
                <th width="220">Tên Triệu Chứng</th>
                <th>Thể Bệnh</th>
                <th>Bài Thuốc</th>
                <th>Bệnh Tây Y</th>
                <th width="140">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="pagedList.length === 0">
                <td colspan="6" class="text-center py-8 text-gray-500">
                  {{ searchQuery ? `Không tìm thấy triệu chứng khớp "${searchQuery}"` : 'Chưa có dữ liệu' }}
                </td>
              </tr>
              <tr v-for="item in pagedList" :key="item.id">
                <td>#{{ item.id }}</td>
                <td class="font-bold text-brown-900">
                  {{ item.ten_trieu_chung }}
                  <span v-if="item.doPhoBien" class="pho-bien" :title="`Tham chiếu bởi ${item.doPhoBien} bản ghi`">{{ item.doPhoBien }}</span>
                </td>
                <!-- Thể bệnh -->
                <td>
                  <div v-if="item.theBenhList && item.theBenhList.length" class="chip-row">
                    <span v-for="tb in item.theBenhList.slice(0, CHIP_LIMIT)" :key="tb" class="chip chip-the">{{ tb }}</span>
                    <span v-if="item.theBenhList.length > CHIP_LIMIT" class="chip chip-more">+{{ item.theBenhList.length - CHIP_LIMIT }}</span>
                  </div>
                  <span v-else class="empty-cell">—</span>
                </td>
                <!-- Bài thuốc -->
                <td>
                  <div v-if="item.baiThuocList && item.baiThuocList.length" class="chip-row">
                    <span v-for="b in item.baiThuocList.slice(0, CHIP_LIMIT)" :key="b.id" class="chip chip-bai">{{ b.ten_bai_thuoc }}</span>
                    <span v-if="item.baiThuocList.length > CHIP_LIMIT" class="chip chip-more">+{{ item.baiThuocList.length - CHIP_LIMIT }}</span>
                  </div>
                  <span v-else class="empty-cell">—</span>
                </td>
                <!-- Bệnh Tây Y -->
                <td>
                  <div v-if="item.benhTayYList && item.benhTayYList.length" class="chip-row">
                    <span v-for="b in item.benhTayYList.slice(0, CHIP_LIMIT)" :key="b.id" class="chip chip-benh">{{ b.ten_benh }}</span>
                    <span v-if="item.benhTayYList.length > CHIP_LIMIT" class="chip chip-more">+{{ item.benhTayYList.length - CHIP_LIMIT }}</span>
                  </div>
                  <span v-else class="empty-cell">—</span>
                </td>
                <td>
                  <div class="action-buttons">
                    <button class="btn-action btn-edit" @click="openEditModal(item)">Sửa</button>
                    <button class="btn-action btn-delete" @click="openDeleteModal(item.id)">Xóa</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Pagination -->
        <div v-if="totalPages > 1" class="pagination">
          <button class="page-btn" :disabled="currentPage <= 1" @click="currentPage--">‹</button>
          <button v-for="pn in getPageNumbers()" :key="pn" class="page-btn" :class="{ active: pn === currentPage }" @click="currentPage = pn">{{ pn }}</button>
          <button class="page-btn" :disabled="currentPage >= totalPages" @click="currentPage++">›</button>
          <span class="page-info">Trang {{ currentPage }} / {{ totalPages }}</span>
        </div>
      </div>
    </div>

    <!-- TAB CHẨN ĐOÁN -->
    <div v-else class="content-body diagnose-body">
      <div class="diagnose-grid">
        <!-- Cột trái: nhập triệu chứng -->
        <section class="panel input-panel">
          <header class="panel-head">
            <div class="panel-head__title">
              <span class="step-badge">1</span>
              <h3>Triệu chứng của bệnh nhân</h3>
            </div>
            <span class="pill-count" :class="{ 'pill-count--on': selectedSymptomIds.length > 0 }">
              {{ selectedSymptomIds.length }}
            </span>
          </header>
          <div class="panel-body">
            <div class="picker-search">
              <svg class="search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="2" />
                <path d="m17 17-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <input
                v-model="symptomSearch"
                type="search"
                class="search-input search-input--icon"
                placeholder="Tìm triệu chứng..."
                autocomplete="off"
              />
              <button
                v-if="symptomSearch"
                type="button"
                class="search-clear"
                aria-label="Xóa tìm kiếm"
                @click="symptomSearch = ''"
              >×</button>
            </div>

            <div v-if="selectedSymptoms.length" class="selected-box">
              <div class="selected-box__head">
                <span class="selected-box__title">Đã chọn ({{ selectedSymptoms.length }})</span>
                <button type="button" class="link-clear" @click="clearSelectedSymptoms">Bỏ chọn tất cả</button>
              </div>
              <div class="selected-chips">
                <span v-for="s in selectedSymptoms" :key="s.id" class="chip chip-selected">
                  {{ s.ten_trieu_chung }}
                  <button
                    type="button"
                    class="chip-x"
                    aria-label="Bỏ chọn"
                    @click="toggleSymptom(s.id)"
                  >×</button>
                </span>
              </div>
            </div>
            <p v-else class="selected-empty">Chưa chọn triệu chứng nào — chọn từ danh sách bên dưới.</p>

            <div class="picker-label">
              Danh sách triệu chứng
              <span class="muted-count">{{ filteredSymptomOptions.length }}</span>
            </div>
            <div class="chip-picker chip-picker--scroll">
              <button
                v-for="s in filteredSymptomOptions"
                :key="s.id"
                type="button"
                class="chip-toggle"
                :class="{ active: selectedSymptomIds.includes(s.id) }"
                @click="toggleSymptom(s.id)"
              >
                {{ s.ten_trieu_chung }}
              </button>
              <span v-if="filteredSymptomOptions.length === 0" class="muted">
                {{ symptomOptions.length === 0 ? 'Chưa có triệu chứng nào' : `Không khớp "${symptomSearch}"` }}
              </span>
            </div>

            <button
              type="button"
              class="btn-primary btn-diagnose"
              :disabled="selectedSymptomIds.length === 0 || isDiagnosing"
              @click="runDiagnosis"
            >
              <span v-if="isDiagnosing" class="btn-spinner" aria-hidden="true"></span>
              {{ isDiagnosing ? 'Đang phân tích…' : selectedSymptomIds.length ? `Chẩn đoán (${selectedSymptomIds.length})` : 'Chẩn đoán' }}
            </button>

            <p class="hint">
              Hệ thống so khớp triệu chứng đã chọn với dữ liệu pháp trị (Đông Y) và bệnh Tây Y bằng
              độ tương đồng có trọng số — triệu chứng càng đặc hiệu (ít gặp) càng có ý nghĩa chẩn đoán cao.
            </p>
          </div>
        </section>

        <!-- Cột phải: kết quả -->
        <section class="panel results-panel">
          <header class="panel-head">
            <div class="panel-head__title">
              <span class="step-badge">2</span>
              <h3>Kết quả gợi ý chẩn đoán</h3>
            </div>
          </header>

          <div class="results-body">
            <div v-if="diagError" class="error-state">{{ diagError }}</div>

            <!-- Đang phân tích: skeleton -->
            <div v-else-if="isDiagnosing" class="results-loading">
              <div class="spinner"></div>
              <p>Đang phân tích {{ selectedSymptomIds.length }} triệu chứng…</p>
              <div class="skeleton-card" v-for="n in 3" :key="n"></div>
            </div>

            <!-- Chưa chạy -->
            <div v-else-if="!hasRunDiagnosis" class="results-empty">
              <div class="results-empty__icon" aria-hidden="true">🔍</div>
              <p class="results-empty__title">Chọn triệu chứng rồi bấm <strong>Chẩn đoán</strong></p>
              <p class="muted">Kết quả gồm % thể bệnh / pháp trị (Đông Y) và % bệnh Tây Y phù hợp nhất.</p>
            </div>

            <!-- Không có kết quả -->
            <div v-else-if="!hasAnyResults" class="results-empty">
              <div class="results-empty__icon" aria-hidden="true">∅</div>
              <p class="results-empty__title">Không tìm thấy thể bệnh / bệnh Tây Y phù hợp</p>
              <p class="muted">Thử chọn thêm hoặc thay đổi các triệu chứng.</p>
              <div v-if="unexplainedSymptoms.length" class="chip-row" style="justify-content: center; margin-top: 8px">
                <span v-for="s in unexplainedSymptoms" :key="s.id" class="chip chip-unmatched">{{ s.ten_trieu_chung }}</span>
              </div>
            </div>

            <template v-else>
              <div class="result-summary">
                <span class="result-summary__text">
                  Dựa trên <strong>{{ diagResult?.input.length || 0 }}</strong> triệu chứng đã chọn
                </span>
              </div>

              <div v-if="unexplainedSymptoms.length" class="unexplained-note">
                <span class="unexplained-label">⚠ Triệu chứng chưa được giải thích</span>
                <div class="chip-row">
                  <span v-for="s in unexplainedSymptoms" :key="s.id" class="chip chip-unmatched">{{ s.ten_trieu_chung }}</span>
                </div>
              </div>

              <div class="result-columns">
              <!-- Thể bệnh & pháp trị (Đông Y) -->
              <div class="result-group result-group--dongy">
                <h4 class="result-group__title">
                  <span class="result-group__dot"></span>
                  Thể bệnh &amp; Pháp trị (Đông Y)
                  <span class="result-count">
                    {{ diagResult?.phapTri.length || 0 }}<template v-if="(diagResult?.phapTriTotal || 0) > (diagResult?.phapTri.length || 0)">/{{ diagResult?.phapTriTotal }}</template>
                  </span>
                </h4>
                <p v-if="!diagResult?.phapTri.length" class="muted result-none">Không có thể bệnh phù hợp.</p>
                <a
                  v-for="(c, i) in diagResult?.phapTri"
                  :key="'pt-' + c.id"
                  :href="phapTriHref(c.id)"
                  target="_blank"
                  rel="noopener"
                  class="result-card"
                  :class="{ 'result-card--top': i === 0 }"
                  :title="`Mở pháp trị: ${c.label}`"
                >
                  <div class="result-card__rank" :class="`rank--${Math.min(i + 1, 4)}`">{{ i + 1 }}</div>
                  <div class="result-card__main">
                    <div class="result-card__head">
                      <h5 class="result-card__name">{{ c.label }}</h5>
                      <span v-if="i === 0" class="top-tag">Phù hợp nhất</span>
                    </div>
                    <p v-if="c.subLabel" class="result-card__sub">{{ c.subLabel }}</p>
                    <div class="result-card__matched">
                      <span class="matched-pill">{{ c.matchedCount }}/{{ c.total }} triệu chứng</span>
                      <span v-for="m in c.matched" :key="m.id" class="chip chip-trieu">{{ m.ten_trieu_chung }}</span>
                    </div>
                  </div>
                  <div class="result-card__score">
                    <span class="score-pct" :class="confidenceClass(c.percent)">{{ c.percent }}<small>%</small></span>
                    <span class="score-label" :class="confidenceClass(c.percent)">{{ confidenceLabel(c.percent) }}</span>
                  </div>
                  <div class="conf-bar">
                    <span :class="confidenceClass(c.percent)" :style="{ width: c.percent + '%' }"></span>
                  </div>
                </a>
              </div>

              <!-- Bệnh Tây Y -->
              <div class="result-group result-group--tayy">
                <h4 class="result-group__title">
                  <span class="result-group__dot"></span>
                  Bệnh Tây Y
                  <span class="result-count">
                    {{ diagResult?.benhTayY.length || 0 }}<template v-if="(diagResult?.benhTayYTotal || 0) > (diagResult?.benhTayY.length || 0)">/{{ diagResult?.benhTayYTotal }}</template>
                  </span>
                </h4>
                <p v-if="!diagResult?.benhTayY.length" class="muted result-none">Không có bệnh Tây Y phù hợp.</p>
                <a
                  v-for="(c, i) in diagResult?.benhTayY"
                  :key="'bty-' + c.id"
                  :href="benhTayYHref(c.id)"
                  target="_blank"
                  rel="noopener"
                  class="result-card"
                  :class="{ 'result-card--top': i === 0 }"
                  :title="`Mở bệnh Tây Y: ${c.label}`"
                >
                  <div class="result-card__rank" :class="`rank--${Math.min(i + 1, 4)}`">{{ i + 1 }}</div>
                  <div class="result-card__main">
                    <div class="result-card__head">
                      <h5 class="result-card__name">{{ c.label }}</h5>
                      <span v-if="c.groupLabel" class="chip chip-chungbenh">{{ c.groupLabel }}</span>
                      <span v-if="i === 0" class="top-tag">Phù hợp nhất</span>
                    </div>
                    <div class="result-card__matched">
                      <span class="matched-pill">{{ c.matchedCount }}/{{ c.total }} triệu chứng</span>
                      <span v-for="m in c.matched" :key="m.id" class="chip chip-trieu">{{ m.ten_trieu_chung }}</span>
                    </div>
                  </div>
                  <div class="result-card__score">
                    <span class="score-pct" :class="confidenceClass(c.percent)">{{ c.percent }}<small>%</small></span>
                    <span class="score-label" :class="confidenceClass(c.percent)">{{ confidenceLabel(c.percent) }}</span>
                  </div>
                  <div class="conf-bar">
                    <span :class="confidenceClass(c.percent)" :style="{ width: c.percent + '%' }"></span>
                  </div>
                </a>
              </div>
              </div>
            </template>
          </div>
        </section>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ isEditing ? 'Chỉnh sửa' : 'Thêm mới' }} Triệu Chứng</h3>
          <button class="modal-close" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Tên Triệu Chứng <span class="required">*</span></label>
            <input
              v-model="formData.ten_trieu_chung"
              type="text"
              placeholder="Nhập tên triệu chứng..."
              @keyup.enter="handleSave"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeModal">Hủy</button>
          <button class="btn-primary" :disabled="isSaving" @click="handleSave">{{ isSaving ? 'Đang lưu...' : 'Lưu' }}</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeDeleteModal">
      <div class="modal-content modal-sm">
        <div class="modal-header">
          <h3>Xác nhận xóa</h3>
          <button class="modal-close" @click="closeDeleteModal">×</button>
        </div>
        <div class="modal-body">
          <p>Bạn có chắc chắn muốn xóa triệu chứng này? Hành động này không thể hoàn tác.</p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeDeleteModal">Hủy</button>
          <button class="btn-danger" :disabled="isDeleting" @click="handleDelete">{{ isDeleting ? 'Đang xóa...' : 'Xóa' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.management-page { width: 100%; animation: fadeIn 0.4s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: var(--space-6); padding-bottom: var(--space-4); border-bottom: 2px solid var(--brown-100); }
.page-title { font-size: var(--font-size-2xl); font-weight: 800; color: var(--brown-800); margin-bottom: var(--space-1); }
.page-subtitle { color: var(--gray-500); font-size: var(--font-size-md); }

/* Main tabs (Danh sách / Chẩn đoán) */
.main-tabs { display: flex; gap: var(--space-2); margin-bottom: var(--space-5); border-bottom: 1px solid var(--brown-100); flex-wrap: wrap; }
.main-tab {
  padding: var(--space-3) var(--space-5);
  border: 1px solid transparent;
  border-bottom: none;
  background: transparent;
  color: var(--gray-600);
  font-weight: 700;
  font-size: var(--font-size-md);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  cursor: pointer;
  transition: all var(--transition-base);
  margin-bottom: -1px;
}
.main-tab:hover { color: var(--brown-600); background: var(--brown-50); }
.main-tab.active {
  background: var(--white);
  color: var(--brown-700);
  border-color: var(--brown-200);
  border-bottom-color: var(--white);
}

.data-card { background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-sm); margin-bottom: var(--space-6); }
.card-header { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); flex-wrap: wrap; padding: var(--space-4) var(--space-5); background: var(--brown-50); border-bottom: 1px solid var(--brown-100); }
.card-header h3 { font-size: var(--font-size-lg); font-weight: 700; color: var(--brown-900); margin: 0; }
.list-search { flex: 1 1 240px; max-width: 420px; }

.table-responsive { width: 100%; overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: var(--space-3) var(--space-5); text-align: left; border-bottom: 1px solid var(--gray-100); }
.data-table th { background: #fdfbf9; font-weight: 600; font-size: var(--font-size-sm); color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.5px; }
.data-table tbody tr { transition: background 0.2s; }
.data-table tbody tr:hover { background: var(--gray-50); }
.data-table td { font-size: var(--font-size-md); color: var(--gray-800); vertical-align: middle; }

/* Chip cells (Thể bệnh / Bài thuốc / Bệnh Tây Y) */
.chip-row { display: flex; flex-wrap: wrap; gap: 4px; max-width: 360px; }
.chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; line-height: 1.4; border: 1px solid transparent; }
.chip-the { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
.chip-bai { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
.chip-benh { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.chip-more { background: var(--gray-100); color: var(--gray-600); border-color: var(--gray-200); }
.empty-cell { color: var(--gray-300); }
.pho-bien { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; margin-left: 6px; padding: 0 6px; border-radius: 999px; background: var(--brown-100); color: var(--brown-700); font-size: 11px; font-weight: 700; vertical-align: middle; }

.action-buttons { display: inline-flex; gap: 6px; flex-wrap: wrap; }
.btn-action { padding: 4px 10px; font-size: 12px; font-weight: 600; border-radius: var(--radius-sm); border: 1px solid var(--gray-200); background: var(--white); cursor: pointer; transition: all var(--transition-fast); }
.btn-edit:hover { background: var(--brown-50); border-color: var(--brown-400); color: var(--brown-700); }
.btn-delete { color: var(--danger); }
.btn-delete:hover { background: #fef2f2; border-color: #fca5a5; }

/* Pagination */
.pagination { display: flex; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-4); background: var(--gray-50); border-top: 1px solid var(--gray-100); }
.page-btn { min-width: 32px; height: 32px; padding: 0 8px; display: flex; align-items: center; justify-content: center; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); font-size: var(--font-size-sm); font-weight: 600; color: var(--gray-600); cursor: pointer; transition: all var(--transition-fast); }
.page-btn:hover:not(:disabled) { border-color: var(--brown-400); color: var(--brown-700); background: var(--brown-50); }
.page-btn.active { background: var(--brown-600); border-color: var(--brown-600); color: var(--white); }
.page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { margin-left: var(--space-4); font-size: var(--font-size-xs); color: var(--gray-500); font-weight: 600; }

.text-center { text-align: center !important; }
.py-8 { padding-top: 2rem !important; padding-bottom: 2rem !important; }
.font-bold { font-weight: 700 !important; }
.text-brown-900 { color: var(--brown-900) !important; }
.text-gray-500 { color: var(--gray-500) !important; }

.badge { display: inline-block; padding: 4px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.badge-warning { background: #fef3c7; color: #b45309; }

.loading-state { display: flex; flex-direction: column; align-items: center; padding: var(--space-12) 0; color: var(--brown-600); }
.spinner { width: 32px; height: 32px; border: 3px solid var(--gray-200); border-top-color: var(--brown-500); border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.error-state { text-align: center; padding: var(--space-8); color: var(--danger); background: #fef2f2; border-radius: var(--radius-lg); }

/* ---------- Chẩn đoán ---------- */
.diagnose-grid {
  display: grid;
  grid-template-columns: minmax(300px, 380px) 1fr;
  gap: var(--space-5);
  align-items: start;
}
.panel { background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-sm); }
.input-panel { position: sticky; top: var(--space-4); }
.panel-head { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); padding: var(--space-4) var(--space-5); background: var(--brown-50); border-bottom: 1px solid var(--brown-100); }
.panel-head__title { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
.panel-head h3 { margin: 0; font-size: var(--font-size-md); font-weight: 700; color: var(--brown-900); }
.step-badge { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: var(--brown-600); color: var(--white); font-size: 13px; font-weight: 800; }
.pill-count { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 24px; padding: 0 8px; border-radius: 999px; background: var(--gray-100); color: var(--gray-500); font-size: 13px; font-weight: 800; transition: all var(--transition-fast); }
.pill-count--on { background: var(--brown-600); color: var(--white); }
.panel-body { padding: var(--space-4) var(--space-5); display: flex; flex-direction: column; gap: var(--space-3); }

.picker-search { position: relative; display: flex; align-items: center; }
.search-icon { position: absolute; left: 12px; width: 16px; height: 16px; color: var(--gray-400); pointer-events: none; }
.search-input { width: 100%; padding: var(--space-3); border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-size: var(--font-size-md); font-family: inherit; box-sizing: border-box; }
.search-input--icon { padding-left: 36px; padding-right: 32px; }
.search-input:focus { outline: none; border-color: var(--brown-500); box-shadow: 0 0 0 3px rgba(146, 64, 14, 0.1); }
.search-clear { position: absolute; right: 8px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border: none; background: var(--gray-100); color: var(--gray-600); border-radius: 50%; font-size: 14px; line-height: 1; cursor: pointer; }
.search-clear:hover { background: var(--gray-200); color: var(--gray-800); }

.selected-box { display: flex; flex-direction: column; gap: 8px; padding: var(--space-3); background: var(--brown-50); border: 1px solid var(--brown-100); border-radius: var(--radius-md); }
.selected-box__head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.selected-box__title { font-size: 12px; font-weight: 700; color: var(--brown-700); text-transform: uppercase; letter-spacing: 0.03em; }
.selected-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.selected-empty { margin: 0; font-size: 13px; color: var(--gray-400); font-style: italic; padding: 2px; }
.chip-selected { display: inline-flex; align-items: center; gap: 5px; background: var(--brown-600); color: var(--white); border-color: var(--brown-600); }
.chip-x { background: rgba(255,255,255,0.25); border: none; color: var(--white); width: 16px; height: 16px; border-radius: 50%; line-height: 1; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0; }
.chip-x:hover { background: rgba(255,255,255,0.5); }
.link-clear { background: none; border: none; color: var(--brown-700); font-size: 12px; font-weight: 600; cursor: pointer; text-decoration: underline; padding: 0; }
.link-clear:hover { color: var(--brown-900); }

.picker-label { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.03em; margin-top: 2px; }
.muted-count { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 18px; padding: 0 6px; background: var(--gray-100); color: var(--gray-500); border-radius: 9px; font-size: 10px; font-weight: 700; }

.chip-picker { display: flex; flex-wrap: wrap; gap: 6px; padding: var(--space-2); border: 1px solid var(--gray-200); border-radius: var(--radius-md); background: var(--gray-50); }
.chip-picker--scroll { max-height: 300px; overflow-y: auto; }
.chip-toggle { padding: 5px 11px; font-size: 13px; font-weight: 600; border-radius: 999px; border: 1px solid var(--gray-300); background: var(--white); color: var(--gray-700); cursor: pointer; transition: all var(--transition-fast); }
.chip-toggle:hover { border-color: var(--brown-400); color: var(--brown-700); background: var(--brown-50); }
.chip-toggle.active { background: var(--brown-600); color: var(--white); border-color: var(--brown-600); }

.btn-diagnose { width: 100%; padding: var(--space-3); font-size: var(--font-size-md); font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 8px; margin-top: 2px; }
.btn-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: var(--white); border-radius: 50%; animation: spin .7s linear infinite; }
.hint { margin: 0; font-size: 12px; color: var(--gray-500); line-height: 1.5; }

.results-panel { min-height: 360px; }
.results-body { padding: var(--space-5); }

.results-loading { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); padding: var(--space-6) var(--space-4); color: var(--brown-600); }
.results-loading p { margin: 0 0 var(--space-2); font-size: var(--font-size-sm); font-weight: 600; }
.skeleton-card { width: 100%; height: 64px; border-radius: var(--radius-lg); background: linear-gradient(90deg, var(--gray-100) 25%, #f3f4f6 37%, var(--gray-100) 63%); background-size: 400% 100%; animation: shimmer 1.4s ease infinite; }
@keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

.results-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-2); text-align: center; padding: var(--space-12) var(--space-5); color: var(--gray-600); }
.results-empty p { margin: 0; }
.results-empty__icon { font-size: 40px; line-height: 1; opacity: 0.6; margin-bottom: var(--space-2); }
.results-empty__title { font-size: var(--font-size-md); font-weight: 600; color: var(--gray-700); }

.result-summary { margin: 0 0 var(--space-4); padding-bottom: var(--space-3); border-bottom: 1px dashed var(--gray-200); }
.result-summary__text { font-size: var(--font-size-sm); color: var(--gray-600); }

.unexplained-note { display: flex; flex-direction: column; gap: 6px; margin-bottom: var(--space-5); padding: var(--space-3) var(--space-4); background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-md); }
.unexplained-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #b45309; }
.unexplained-note .chip-row { max-width: none; }
.chip-unmatched { background: #fff7ed; color: #9a3412; border-color: #fed7aa; border-style: dashed; }

/* Hai cột Đông Y / Tây Y cạnh nhau; tự xuống 1 cột khi không đủ rộng. */
.result-columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-5); align-items: start; }
.result-columns .result-group { margin-bottom: 0; }

.result-group { margin-bottom: var(--space-6); }
.result-group:last-child { margin-bottom: 0; }
.result-group__title { display: flex; align-items: center; gap: var(--space-2); margin: 0 0 var(--space-3); font-size: var(--font-size-md); font-weight: 700; color: var(--gray-800); padding-bottom: var(--space-2); border-bottom: 1px solid var(--gray-100); }
.result-group__dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; }
.result-group--dongy .result-group__dot { background: #10b981; }
.result-group--tayy .result-group__dot { background: #2563eb; }
.result-count { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 20px; padding: 0 7px; border-radius: 10px; font-size: 11px; font-weight: 700; }
.result-group--dongy .result-count { background: #d1fae5; color: #047857; }
.result-group--tayy .result-count { background: #dbeafe; color: #1d4ed8; }
.result-none { margin: 0; padding: var(--space-2) 0; }

.result-card {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas: "rank main score" "bar bar bar";
  gap: 8px var(--space-3);
  align-items: start;
  text-decoration: none;
  color: inherit;
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-3);
  box-shadow: 0 1px 2px rgba(74, 47, 23, 0.04);
  transition: box-shadow var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);
}
.result-card:hover { box-shadow: 0 6px 18px rgba(74, 47, 23, 0.1); border-color: var(--brown-300); transform: translateY(-1px); }
.result-card:last-child { margin-bottom: 0; }
.result-card--top { border-color: #fcd34d; background: linear-gradient(180deg, #fffdf5 0%, #fff 60%); box-shadow: 0 2px 10px rgba(217, 119, 6, 0.1); }

.result-card__rank { grid-area: rank; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; font-size: 12px; font-weight: 800; background: var(--gray-100); color: var(--gray-600); }
.rank--1 { background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #fff; box-shadow: 0 2px 6px rgba(245,158,11,0.4); }
.rank--2 { background: #e5e7eb; color: #4b5563; }
.rank--3 { background: #fde7d3; color: #b45309; }

.result-card__main { grid-area: main; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.result-card__head { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.result-card__name { margin: 0; font-weight: 700; color: var(--brown-900); font-size: var(--font-size-md); line-height: 1.35; word-break: break-word; }
.top-tag { flex: 0 0 auto; padding: 1px 8px; border-radius: 999px; background: #fef3c7; color: #b45309; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
.result-card__sub { margin: 0; font-size: var(--font-size-sm); color: var(--gray-700); line-height: 1.5; }
.result-card__matched { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
.matched-pill { flex: 0 0 auto; padding: 2px 9px; border-radius: 999px; background: var(--brown-50); color: var(--brown-700); border: 1px solid var(--brown-100); font-size: 11px; font-weight: 700; }

.result-card__score { grid-area: score; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; text-align: right; }
.score-pct { font-size: 22px; font-weight: 800; line-height: 1; }
.score-pct small { font-size: 12px; font-weight: 700; margin-left: 1px; }
.score-pct.conf-high { color: #059669; }
.score-pct.conf-mid { color: #d97706; }
.score-pct.conf-low { color: var(--gray-400); }
.score-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap; }
.score-label.conf-high { color: #059669; }
.score-label.conf-mid { color: #d97706; }
.score-label.conf-low { color: var(--gray-400); }

.conf-bar { grid-area: bar; height: 6px; background: var(--gray-100); border-radius: 999px; overflow: hidden; }
.conf-bar > span { display: block; height: 100%; border-radius: 999px; transition: width 0.4s ease; }
.conf-bar > span.conf-high { background: #10b981; }
.conf-bar > span.conf-mid { background: #f59e0b; }
.conf-bar > span.conf-low { background: var(--gray-400); }

.chip-trieu { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.chip-chungbenh { background: var(--brown-100); color: var(--brown-800); border-color: var(--brown-200); }
.result-card .chip-row { max-width: none; gap: 5px; }
.muted { color: var(--gray-400); font-style: italic; }

@media (max-width: 900px) {
  .diagnose-grid { grid-template-columns: 1fr; }
  .input-panel { position: static; }
}
@media (max-width: 560px) {
  .result-card { grid-template-columns: auto 1fr; grid-template-areas: "rank main" "score score" "bar bar"; }
  .result-card__score { flex-direction: row; align-items: baseline; gap: 6px; }
}

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s ease; padding: var(--space-4); }
.modal-content { background: var(--white); border-radius: var(--radius-xl); width: 100%; max-width: 520px; box-shadow: var(--shadow-xl); animation: slideUp 0.25s ease; }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.modal-sm { max-width: 400px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-5); border-bottom: 1px solid var(--gray-200); }
.modal-header h3 { margin: 0; font-size: var(--font-size-lg); font-weight: 700; color: var(--brown-900); }
.modal-close { background: none; border: none; font-size: 28px; line-height: 1; color: var(--gray-400); cursor: pointer; padding: 0; width: 32px; height: 32px; }
.modal-close:hover { color: var(--gray-700); }
.modal-body { padding: var(--space-5); }
.modal-footer { display: flex; justify-content: flex-end; gap: var(--space-3); padding: var(--space-5); border-top: 1px solid var(--gray-200); }

.form-group { margin-bottom: var(--space-4); }
.form-group label { display: block; margin-bottom: var(--space-2); font-weight: 600; font-size: var(--font-size-sm); color: var(--gray-700); }
.form-group input, .form-group textarea { width: 100%; padding: var(--space-3); border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-size: var(--font-size-md); font-family: inherit; transition: border-color var(--transition-fast); box-sizing: border-box; }
.form-group input:focus, .form-group textarea:focus { outline: none; border-color: var(--brown-500); }
.required { color: var(--danger); }

.btn-primary { padding: var(--space-3) var(--space-5); background: var(--brown-600); color: var(--white); border: none; border-radius: var(--radius-md); font-weight: 600; font-size: var(--font-size-md); cursor: pointer; transition: all var(--transition-fast); }
.btn-primary:hover:not(:disabled) { background: var(--brown-700); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { padding: var(--space-3) var(--space-5); background: var(--white); color: var(--gray-700); border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-weight: 600; font-size: var(--font-size-md); cursor: pointer; transition: all var(--transition-fast); }
.btn-secondary:hover { background: var(--gray-50); }
.btn-danger { padding: var(--space-3) var(--space-5); background: var(--danger); color: var(--white); border: none; border-radius: var(--radius-md); font-weight: 600; font-size: var(--font-size-md); cursor: pointer; transition: all var(--transition-fast); }
.btn-danger:hover:not(:disabled) { opacity: 0.9; }
.btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
.mt-4 { margin-top: var(--space-4); }
</style>
