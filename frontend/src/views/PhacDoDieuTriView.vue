<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { api } from '@/services/api'

interface KinhMachLite {
  idKinhMach: number
  ten_kinh_mach: string | null
  ten_viet_tat: string | null
}

interface HuyetViLite {
  idHuyet: number
  ten_huyet: string | null
  ma_huyet: string | null
  idKinhMach: number
  kinhMach?: KinhMachLite | null
}

interface BenhLite {
  id: number
  code?: string | null
  name?: string | null
  tieuket?: string | null
  chung_trang?: string | null
}

interface PhacDoRow {
  idPhacDo: number
  idBenh: number
  idHuyet: number
  vai_tro_huyet: string | null
  phuong_phap_tac_dong: string | null
  ghi_chu_ky_thuat: string | null
  benh: BenhLite | null
  huyetVi: HuyetViLite | null
}

interface FormState {
  id_benh: number | null
  id_huyet: number | null
  vai_tro_huyet: string
  phuong_phap_tac_dong: string
  ghi_chu_ky_thuat: string
}

const VAI_TRO_OPTIONS = [
  'Chủ huyệt',
  'Phối huyệt',
  'A thị huyệt',
  'Hỗ trợ',
] as const

const PHUONG_PHAP_OPTIONS = [
  'Châm',
  'Cứu',
  'Châm + cứu',
  'Bấm huyệt',
  'Điện châm',
] as const

const isLoading = ref(true)
const isSubmitting = ref(false)
const error = ref<string | null>(null)
const formError = ref<string | null>(null)
const dataList = ref<PhacDoRow[]>([])
const huyetViOptions = ref<HuyetViLite[]>([])
const benhOptions = ref<BenhLite[]>([])
const searchQuery = ref('')
const huyetViSearch = ref('')
const benhSearch = ref('')

const showModal = ref(false)
const showDeleteConfirm = ref(false)
const editingId = ref<number | null>(null)
const deletingItem = ref<PhacDoRow | null>(null)

const emptyForm = (): FormState => ({
  id_benh: null,
  id_huyet: null,
  vai_tro_huyet: '',
  phuong_phap_tac_dong: '',
  ghi_chu_ky_thuat: '',
})

const form = ref<FormState>(emptyForm())

const currentPage = ref(1)
const itemsPerPage = ref(10)

onMounted(async () => {
  await Promise.all([fetchData(), fetchHuyetVi(), fetchBenh()])
})

watch(searchQuery, () => {
  currentPage.value = 1
})

async function fetchData() {
  isLoading.value = true
  error.value = null
  try {
    const res: any = await api.get('/phac-do-dieu-tri')
    dataList.value = Array.isArray(res) ? res : res?.data ?? []
  } catch (err: any) {
    console.error(err)
    error.value = 'Lỗi khi tải dữ liệu: ' + (err.message || String(err))
  } finally {
    isLoading.value = false
  }
}

async function fetchHuyetVi() {
  try {
    const res: any = await api.get('/huyet-vi')
    huyetViOptions.value = Array.isArray(res) ? res : res?.data ?? []
  } catch (err) {
    console.error('Không tải được danh sách huyệt vị', err)
  }
}

async function fetchBenh() {
  try {
    const res: any = await api.get('/benh-dong-y')
    benhOptions.value = Array.isArray(res) ? res : res?.data ?? []
  } catch (err) {
    console.error('Không tải được danh sách bệnh đông y', err)
  }
}

function huyetViLabel(h: HuyetViLite | null | undefined): string {
  if (!h) return '—'
  const parts = [h.ten_huyet, h.ma_huyet ? `(${h.ma_huyet})` : null].filter(Boolean)
  return parts.length ? parts.join(' ') : `#${h.idHuyet}`
}

function kinhMachLabel(k: KinhMachLite | null | undefined): string {
  if (!k) return ''
  return k.ten_kinh_mach || k.ten_viet_tat || `#${k.idKinhMach}`
}

function benhLabel(b: BenhLite | null | undefined, idBenh?: number): string {
  if (b) {
    return b.name || b.tieuket || b.chung_trang || b.code || `#${b.id}`
  }
  if (idBenh != null) {
    const matched = benhOptions.value.find((x) => x.id === idBenh)
    if (matched) return matched.name || matched.code || `#${matched.id}`
    return `#${idBenh}`
  }
  return '—'
}

const filteredBenhOptions = computed(() => {
  const q = benhSearch.value.trim().toLowerCase()
  if (!q) return benhOptions.value
  return benhOptions.value.filter((b) => {
    const hay = [b.name, b.code, b.tieuket, b.chung_trang]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
})

const filteredHuyetViOptions = computed(() => {
  const q = huyetViSearch.value.trim().toLowerCase()
  if (!q) return huyetViOptions.value
  return huyetViOptions.value.filter((h) => {
    const hay = [
      h.ten_huyet,
      h.ma_huyet,
      h.kinhMach?.ten_kinh_mach,
      h.kinhMach?.ten_viet_tat,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
})

const filteredList = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return dataList.value
  return dataList.value.filter((row) => {
    const hay = [
      benhLabel(row.benh, row.idBenh),
      huyetViLabel(row.huyetVi),
      row.huyetVi?.ma_huyet,
      kinhMachLabel(row.huyetVi?.kinhMach),
      row.vai_tro_huyet,
      row.phuong_phap_tac_dong,
      row.ghi_chu_ky_thuat,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
})

const pagedList = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return filteredList.value.slice(start, start + itemsPerPage.value)
})

const totalPages = computed(() => {
  const n = Math.ceil(filteredList.value.length / itemsPerPage.value)
  return n > 0 ? n : 1
})

function getPageNumbers() {
  const pages: number[] = []
  const start = Math.max(1, currentPage.value - 2)
  const end = Math.min(totalPages.value, currentPage.value + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
}

function openCreateModal() {
  editingId.value = null
  form.value = emptyForm()
  formError.value = null
  huyetViSearch.value = ''
  benhSearch.value = ''
  showModal.value = true
}

function openEditModal(row: PhacDoRow) {
  editingId.value = row.idPhacDo
  form.value = {
    id_benh: row.idBenh ?? null,
    id_huyet: row.idHuyet ?? null,
    vai_tro_huyet: row.vai_tro_huyet ?? '',
    phuong_phap_tac_dong: row.phuong_phap_tac_dong ?? '',
    ghi_chu_ky_thuat: row.ghi_chu_ky_thuat ?? '',
  }
  formError.value = null
  huyetViSearch.value = ''
  benhSearch.value = ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingId.value = null
}

async function handleSubmit() {
  if (isSubmitting.value) return
  formError.value = null
  const f = form.value
  if (f.id_benh == null || Number.isNaN(Number(f.id_benh))) {
    formError.value = 'Vui lòng nhập ID bệnh'
    return
  }
  if (f.id_huyet == null) {
    formError.value = 'Vui lòng chọn huyệt vị'
    return
  }
  const payload: Record<string, unknown> = {
    id_benh: Number(f.id_benh),
    id_huyet: f.id_huyet,
    vai_tro_huyet: f.vai_tro_huyet.trim() || null,
    phuong_phap_tac_dong: f.phuong_phap_tac_dong.trim() || null,
    ghi_chu_ky_thuat: f.ghi_chu_ky_thuat.trim() || null,
  }
  isSubmitting.value = true
  try {
    if (editingId.value != null) {
      await api.put(`/phac-do-dieu-tri/${editingId.value}`, payload)
    } else {
      await api.post('/phac-do-dieu-tri', payload)
    }
    await fetchData()
    closeModal()
  } catch (err: any) {
    formError.value = err.message || 'Không lưu được dữ liệu'
  } finally {
    isSubmitting.value = false
  }
}

function confirmDelete(row: PhacDoRow) {
  deletingItem.value = row
  showDeleteConfirm.value = true
}

async function handleDelete() {
  if (isSubmitting.value) return
  if (!deletingItem.value) return
  isSubmitting.value = true
  try {
    await api.delete(`/phac-do-dieu-tri/${deletingItem.value.idPhacDo}`)
    showDeleteConfirm.value = false
    deletingItem.value = null
    await fetchData()
    if (pagedList.value.length === 0 && currentPage.value > 1) {
      currentPage.value--
    }
  } catch (err: any) {
    error.value = err.message || 'Không xóa được bản ghi'
    showDeleteConfirm.value = false
    deletingItem.value = null
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="management-page">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">Quản Lý Phác Đồ Điều Trị</h1>
        <p class="page-subtitle">
          Liên kết bệnh ↔ huyệt vị — vai trò huyệt, phương pháp tác động, ghi chú kỹ thuật
        </p>
      </div>
      <button type="button" class="btn-primary" @click="openCreateModal">+ Thêm phác đồ</button>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Đang tải dữ liệu...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button class="btn-secondary mt-4" @click="fetchData">Thử lại</button>
    </div>

    <div v-else class="content-body">
      <div class="toolbar">
        <label class="search-wrap">
          <span class="search-label">Tìm kiếm</span>
          <input
            v-model="searchQuery"
            type="search"
            class="search-input"
            placeholder="Tìm theo bệnh, huyệt, vai trò, phương pháp..."
            autocomplete="off"
          />
        </label>
        <span class="toolbar-count">{{ filteredList.length }} / {{ dataList.length }} phác đồ</span>
      </div>

      <div class="data-card">
        <div class="card-header">
          <h3>Danh sách Phác Đồ Điều Trị</h3>
          <span class="badge badge-success">{{ filteredList.length }} bản ghi</span>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th width="64">ID</th>
                <th width="200">Bệnh</th>
                <th width="220">Huyệt vị</th>
                <th width="140">Vai trò</th>
                <th width="140">Phương pháp</th>
                <th>Ghi chú kỹ thuật</th>
                <th width="120" class="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="pagedList.length === 0">
                <td colspan="7" class="text-center py-8 text-gray-500">
                  {{ searchQuery.trim() ? 'Không khớp bản ghi nào' : 'Chưa có dữ liệu' }}
                </td>
              </tr>
              <tr v-for="item in pagedList" :key="item.idPhacDo">
                <td class="font-bold cell-id">#{{ item.idPhacDo }}</td>
                <td>
                  <div class="benh-cell">
                    <span class="chip chip-benh">{{ benhLabel(item.benh, item.idBenh) }}</span>
                    <small v-if="item.benh?.code" class="text-muted">{{ item.benh.code }}</small>
                  </div>
                </td>
                <td>
                  <div class="huyet-cell">
                    <span class="chip chip-huyet">{{ huyetViLabel(item.huyetVi) }}</span>
                    <small v-if="item.huyetVi?.kinhMach" class="text-muted">
                      {{ kinhMachLabel(item.huyetVi.kinhMach) }}
                    </small>
                  </div>
                </td>
                <td>
                  <span v-if="item.vai_tro_huyet" class="chip chip-role">{{ item.vai_tro_huyet }}</span>
                  <span v-else class="muted">—</span>
                </td>
                <td>
                  <span v-if="item.phuong_phap_tac_dong" class="chip chip-method">{{ item.phuong_phap_tac_dong }}</span>
                  <span v-else class="muted">—</span>
                </td>
                <td class="cell-wrap">{{ item.ghi_chu_ky_thuat || '—' }}</td>
                <td class="text-right">
                  <div class="row-actions">
                    <button type="button" class="btn-action btn-edit" @click="openEditModal(item)">Sửa</button>
                    <button type="button" class="btn-action btn-delete" @click="confirmDelete(item)">Xóa</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="filteredList.length > itemsPerPage" class="pagination">
          <button class="page-btn" :disabled="currentPage <= 1" @click="currentPage--">‹</button>
          <button
            v-for="pn in getPageNumbers()"
            :key="pn"
            class="page-btn"
            :class="{ active: pn === currentPage }"
            @click="currentPage = pn"
          >
            {{ pn }}
          </button>
          <button class="page-btn" :disabled="currentPage >= totalPages" @click="currentPage++">›</button>
          <span class="page-info">Trang {{ currentPage }} / {{ totalPages }}</span>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal modal--wide" @click.stop>
        <div class="modal-header">
          <h3>{{ editingId != null ? 'Sửa phác đồ' : 'Thêm phác đồ' }}</h3>
          <button type="button" class="modal-close" aria-label="Đóng" @click="closeModal">✕</button>
        </div>
        <form class="modal-body" @submit.prevent="handleSubmit">
          <p v-if="formError" class="form-error">{{ formError }}</p>
          <div class="form-grid">
            <div class="field field--full">
              <div class="field-head">
                <span class="field-label">Bệnh đông y <abbr title="bắt buộc">*</abbr></span>
                <span class="field-count">{{ form.id_benh != null ? 'Đã chọn' : 'Chưa chọn' }}</span>
              </div>
              <div v-if="benhOptions.length === 0" class="muted">Chưa có dữ liệu bệnh đông y</div>
              <template v-else>
                <div class="picker-search">
                  <input
                    v-model="benhSearch"
                    type="search"
                    class="input input--sm"
                    placeholder="Tìm bệnh theo tên, mã..."
                  />
                </div>
                <div class="chip-picker chip-picker--scroll">
                  <button
                    v-for="b in filteredBenhOptions"
                    :key="b.id"
                    type="button"
                    class="chip-toggle"
                    :class="{ active: form.id_benh === b.id }"
                    @click="form.id_benh = b.id"
                  >
                    {{ b.name || b.tieuket || b.chung_trang || `#${b.id}` }}
                    <span v-if="b.code" class="chip-sub">— {{ b.code }}</span>
                  </button>
                  <span v-if="filteredBenhOptions.length === 0" class="muted">
                    Không khớp "{{ benhSearch }}"
                  </span>
                </div>
              </template>
            </div>

            <div class="field field--full">
              <span class="field-label">Vai trò huyệt</span>
              <div class="chip-picker">
                <button
                  v-for="opt in VAI_TRO_OPTIONS"
                  :key="opt"
                  type="button"
                  class="chip-toggle"
                  :class="{ active: form.vai_tro_huyet === opt }"
                  @click="form.vai_tro_huyet = form.vai_tro_huyet === opt ? '' : opt"
                >
                  {{ opt }}
                </button>
              </div>
            </div>

            <div class="field field--full">
              <span class="field-label">Phương pháp tác động</span>
              <div class="chip-picker">
                <button
                  v-for="opt in PHUONG_PHAP_OPTIONS"
                  :key="opt"
                  type="button"
                  class="chip-toggle"
                  :class="{ active: form.phuong_phap_tac_dong === opt }"
                  @click="form.phuong_phap_tac_dong = form.phuong_phap_tac_dong === opt ? '' : opt"
                >
                  {{ opt }}
                </button>
              </div>
            </div>

            <label class="field field--full">
              <span>Ghi chú kỹ thuật</span>
              <textarea
                v-model="form.ghi_chu_ky_thuat"
                class="textarea"
                rows="3"
                placeholder="vd. Châm tả, sâu 0.5 thốn..."
              ></textarea>
            </label>

            <div class="field field--full">
              <div class="field-head">
                <span class="field-label">Huyệt vị <abbr title="bắt buộc">*</abbr></span>
                <span class="field-count">{{ form.id_huyet != null ? 'Đã chọn' : 'Chưa chọn' }}</span>
              </div>
              <div v-if="huyetViOptions.length === 0" class="muted">Chưa có dữ liệu huyệt vị</div>
              <template v-else>
                <div class="picker-search">
                  <input
                    v-model="huyetViSearch"
                    type="search"
                    class="input input--sm"
                    placeholder="Tìm huyệt, mã, kinh mạch..."
                  />
                </div>
                <div class="chip-picker chip-picker--scroll">
                  <button
                    v-for="h in filteredHuyetViOptions"
                    :key="h.idHuyet"
                    type="button"
                    class="chip-toggle"
                    :class="{ active: form.id_huyet === h.idHuyet }"
                    @click="form.id_huyet = h.idHuyet"
                  >
                    {{ huyetViLabel(h) }}
                    <span v-if="h.kinhMach" class="chip-sub">— {{ kinhMachLabel(h.kinhMach) }}</span>
                  </button>
                  <span v-if="filteredHuyetViOptions.length === 0" class="muted">
                    Không khớp "{{ huyetViSearch }}"
                  </span>
                </div>
              </template>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" :disabled="isSubmitting" @click="closeModal">Hủy</button>
            <button type="submit" class="btn-primary" :disabled="isSubmitting">
              {{ isSubmitting ? 'Đang lưu…' : 'Lưu' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal modal--sm" @click.stop>
        <div class="modal-header">
          <h3>Xác nhận xóa</h3>
          <button type="button" class="modal-close" @click="showDeleteConfirm = false">✕</button>
        </div>
        <div class="modal-body">
          <p>
            Xóa phác đồ
            <strong>#{{ deletingItem?.idPhacDo }} — {{ benhLabel(deletingItem?.benh ?? null, deletingItem?.idBenh) }} ↔ {{ huyetViLabel(deletingItem?.huyetVi ?? null) }}</strong>?
            Thao tác không hoàn tác.
          </p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-secondary" :disabled="isSubmitting" @click="showDeleteConfirm = false">Hủy</button>
          <button type="button" class="btn-danger" :disabled="isSubmitting" @click="handleDelete">
            {{ isSubmitting ? 'Đang xóa…' : 'Xóa' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.management-page {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-8);
  animation: fadeIn 0.4s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-4);
  border-bottom: 2px solid var(--brown-100);
}
.header-content { flex: 1; min-width: 200px; }
.page-title { font-size: var(--font-size-2xl); font-weight: 800; color: var(--brown-800); margin-bottom: var(--space-1); }
.page-subtitle { color: var(--gray-500); font-size: var(--font-size-md); }

.btn-primary {
  padding: var(--space-3) var(--space-5);
  background: var(--brown-600);
  color: var(--white);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.btn-primary:hover { background: var(--brown-700); }
.btn-secondary {
  padding: var(--space-3) var(--space-5);
  background: var(--white);
  color: var(--gray-700);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
}
.btn-secondary:hover { background: var(--gray-50); }
.btn-danger {
  padding: var(--space-3) var(--space-5);
  background: var(--danger);
  color: var(--white);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
}
.mt-4 { margin-top: var(--space-4); }

.toolbar { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-4); }
.search-wrap { display: flex; flex-direction: column; gap: var(--space-1); flex: 1; min-width: 200px; max-width: 420px; }
.search-label { font-size: var(--font-size-xs); font-weight: 600; color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.04em; }
.search-input { padding: var(--space-2) var(--space-3); border: 1px solid var(--gray-200); border-radius: var(--radius-md); font-size: var(--font-size-md); }
.toolbar-count { font-size: var(--font-size-sm); color: var(--gray-500); font-weight: 600; }

.data-card { background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-sm); }
.card-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-5); background: var(--brown-50); border-bottom: 1px solid var(--brown-100); }
.card-header h3 { font-size: var(--font-size-lg); font-weight: 700; color: var(--brown-900); margin: 0; }

.table-responsive { width: 100%; overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: var(--space-3) var(--space-4); text-align: left; border-bottom: 1px solid var(--gray-100); vertical-align: middle; }
.data-table th { background: #fdfbf9; font-weight: 600; font-size: var(--font-size-sm); color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.5px; }
.data-table tbody tr:hover { background: var(--gray-50); }
.data-table td { font-size: var(--font-size-md); color: var(--gray-800); }
.cell-id { color: var(--gray-500); font-weight: 600; font-size: var(--font-size-sm); }
.cell-wrap { white-space: normal; word-break: break-word; line-height: 1.4; max-width: 400px; }

.benh-cell, .huyet-cell { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; }
.text-muted { font-size: 11px; color: var(--gray-500); }

.chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  border: 1px solid transparent;
}
.chip-benh { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
.chip-huyet { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.chip-role { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
.chip-method { background: #fce7f3; color: #9d174d; border-color: #f9a8d4; }
.chip-sub { font-size: 11px; opacity: 0.85; font-weight: 500; }
.muted { color: var(--gray-400); font-style: italic; }

.row-actions { display: inline-flex; gap: 6px; flex-wrap: wrap; }
.btn-action {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 1px solid var(--gray-200);
  background: var(--white);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.btn-edit:hover { background: var(--brown-50); border-color: var(--brown-400); color: var(--brown-700); }
.btn-delete { color: var(--danger); }
.btn-delete:hover { background: #fef2f2; border-color: #fca5a5; }

.pagination { display: flex; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-4); background: var(--gray-50); border-top: 1px solid var(--gray-100); }
.page-btn { min-width: 32px; height: 32px; padding: 0 8px; display: flex; align-items: center; justify-content: center; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); font-size: var(--font-size-sm); font-weight: 600; color: var(--gray-600); cursor: pointer; transition: all var(--transition-fast); }
.page-btn:hover:not(:disabled) { border-color: var(--brown-400); color: var(--brown-700); background: var(--brown-50); }
.page-btn.active { background: var(--brown-600); border-color: var(--brown-600); color: var(--white); }
.page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { margin-left: var(--space-4); font-size: var(--font-size-xs); color: var(--gray-500); font-weight: 600; }

.text-center { text-align: center !important; }
.text-right { text-align: right !important; }
.py-8 { padding-top: 2rem !important; padding-bottom: 2rem !important; }
.font-bold { font-weight: 700 !important; }
.text-gray-500 { color: var(--gray-500) !important; }

.badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.badge-success { background: #d1fae5; color: #059669; }

.loading-state { display: flex; flex-direction: column; align-items: center; padding: var(--space-12) 0; color: var(--brown-600); }
.spinner { width: 32px; height: 32px; border: 3px solid var(--gray-200); border-top-color: var(--brown-500); border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.error-state { text-align: center; padding: var(--space-8); color: var(--danger); background: #fef2f2; border-radius: var(--radius-lg); }

.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 50; padding: var(--space-4);
}
.modal {
  background: var(--white);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 640px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.15);
  overflow: hidden;
}
.modal--wide { max-width: 880px; }
.modal--sm { max-width: 440px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--gray-100); }
.modal-header h3 { margin: 0; font-size: var(--font-size-lg); font-weight: 700; color: var(--brown-800); }
.modal-close { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--gray-500); }
.modal-close:hover { color: var(--gray-800); }
.modal-body { padding: var(--space-5); overflow-y: auto; flex: 1; }
.modal-footer {
  display: flex; gap: var(--space-2); justify-content: flex-end;
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--gray-100);
  background: var(--gray-50);
}

.form-error { background: #fef2f2; color: var(--danger); border: 1px solid #fecaca; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-3); font-size: var(--font-size-sm); }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.field { display: flex; flex-direction: column; gap: 4px; }
.field--full { grid-column: 1 / -1; }
.field > span, .field-label { font-size: var(--font-size-sm); font-weight: 600; color: var(--gray-700); }
.field-hint { font-size: 11px; color: var(--gray-500); margin-top: 2px; }
.field-hint code { background: var(--gray-100); padding: 1px 5px; border-radius: 3px; font-size: 11px; }
.field-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2); }
.field-count { font-size: 11px; font-weight: 600; color: var(--brown-600); background: var(--brown-50); padding: 1px 8px; border-radius: 999px; }

.input, .textarea {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-family: inherit;
}
.input:focus, .textarea:focus { outline: none; border-color: var(--brown-500); box-shadow: 0 0 0 3px rgba(146, 64, 14, 0.1); }
.textarea { resize: vertical; min-height: 60px; }
.input--sm { padding: 6px 10px; font-size: 13px; }
.picker-search { margin-bottom: 6px; }

.chip-picker { display: flex; flex-wrap: wrap; gap: 6px; padding: var(--space-2); border: 1px solid var(--gray-200); border-radius: var(--radius-md); background: var(--gray-50); }
.chip-picker--scroll { max-height: 220px; overflow-y: auto; }
.chip-toggle { padding: 4px 10px; font-size: 13px; font-weight: 600; border-radius: 999px; border: 1px solid var(--gray-300); background: var(--white); color: var(--gray-700); cursor: pointer; transition: all var(--transition-fast); }
.chip-toggle:hover { border-color: var(--brown-400); color: var(--brown-700); }
.chip-toggle.active { background: var(--brown-600); color: var(--white); border-color: var(--brown-600); }

@media (max-width: 640px) {
  .form-grid { grid-template-columns: 1fr; }
  .field--full { grid-column: 1; }
  .management-page { padding: var(--space-4); }
}
</style>
