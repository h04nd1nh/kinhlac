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
  phuong_phap_tac_dong: string | null
  ghi_chu_ky_thuat: string | null
  benh: BenhLite | null
  huyetVi: HuyetViLite | null
}

interface FormState {
  id_benh: number | null
  id_huyet_list: number[]
  phuong_phap_tac_dong: string
  ghi_chu_ky_thuat: string
}

interface BenhGroup {
  idBenh: number
  benh: BenhLite | null
  items: PhacDoRow[]
}

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
const editingBenhId = ref<number | null>(null)
const editingItems = ref<PhacDoRow[]>([])
const deletingGroup = ref<BenhGroup | null>(null)

const emptyForm = (): FormState => ({
  id_benh: null,
  id_huyet_list: [],
  phuong_phap_tac_dong: '',
  ghi_chu_ky_thuat: '',
})

function toggleHuyet(id: number) {
  const idx = form.value.id_huyet_list.indexOf(id)
  if (idx >= 0) {
    form.value.id_huyet_list.splice(idx, 1)
  } else {
    form.value.id_huyet_list.push(id)
  }
}

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
    console.error('Không tải được danh sách Bệnh YHCT - Đông Y', err)
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

const groupedList = computed<BenhGroup[]>(() => {
  const map = new Map<number, BenhGroup>()
  for (const row of dataList.value) {
    let g = map.get(row.idBenh)
    if (!g) {
      g = { idBenh: row.idBenh, benh: row.benh, items: [] }
      map.set(row.idBenh, g)
    }
    if (!g.benh && row.benh) g.benh = row.benh
    g.items.push(row)
  }
  return Array.from(map.values()).sort((a, b) => a.idBenh - b.idBenh)
})

function uniqueStrings(list: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of list) {
    const v = (s ?? '').trim()
    if (!v || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

function groupPhuongPhap(g: BenhGroup): string[] {
  return uniqueStrings(g.items.map((i) => i.phuong_phap_tac_dong))
}

function groupGhiChu(g: BenhGroup): string[] {
  return uniqueStrings(g.items.map((i) => i.ghi_chu_ky_thuat))
}

const filteredList = computed<BenhGroup[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return groupedList.value
  return groupedList.value.filter((g) => {
    const hay = [
      benhLabel(g.benh, g.idBenh),
      g.benh?.code,
      ...g.items.flatMap((row) => [
        huyetViLabel(row.huyetVi),
        row.huyetVi?.ma_huyet,
        kinhMachLabel(row.huyetVi?.kinhMach),
        row.phuong_phap_tac_dong,
        row.ghi_chu_ky_thuat,
      ]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
})

const pagedList = computed<BenhGroup[]>(() => {
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
  editingBenhId.value = null
  editingItems.value = []
  form.value = emptyForm()
  formError.value = null
  huyetViSearch.value = ''
  benhSearch.value = ''
  showModal.value = true
}

function openEditModal(group: BenhGroup) {
  editingBenhId.value = group.idBenh
  editingItems.value = group.items.slice()
  const first = group.items[0]
  form.value = {
    id_benh: group.idBenh,
    id_huyet_list: group.items.map((r) => r.idHuyet).filter((id) => id != null),
    phuong_phap_tac_dong: first?.phuong_phap_tac_dong ?? '',
    ghi_chu_ky_thuat: first?.ghi_chu_ky_thuat ?? '',
  }
  formError.value = null
  huyetViSearch.value = ''
  benhSearch.value = ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingBenhId.value = null
  editingItems.value = []
}

async function handleSubmit() {
  if (isSubmitting.value) return
  formError.value = null
  const f = form.value
  if (f.id_benh == null || Number.isNaN(Number(f.id_benh))) {
    formError.value = 'Vui lòng chọn bệnh'
    return
  }
  if (f.id_huyet_list.length === 0) {
    formError.value = 'Vui lòng chọn ít nhất một huyệt vị'
    return
  }
  const basePayload = {
    id_benh: Number(f.id_benh),
    phuong_phap_tac_dong: f.phuong_phap_tac_dong.trim() || null,
    ghi_chu_ky_thuat: f.ghi_chu_ky_thuat.trim() || null,
  }
  isSubmitting.value = true
  try {
    if (editingBenhId.value != null) {
      const existingByHuyet = new Map<number, PhacDoRow>()
      for (const r of editingItems.value) existingByHuyet.set(r.idHuyet, r)
      const desiredSet = new Set(f.id_huyet_list)
      for (const r of editingItems.value) {
        if (!desiredSet.has(r.idHuyet)) {
          await api.delete(`/phac-do-dieu-tri/${r.idPhacDo}`)
        }
      }
      for (const idHuyet of f.id_huyet_list) {
        const existing = existingByHuyet.get(idHuyet)
        if (existing) {
          await api.put(`/phac-do-dieu-tri/${existing.idPhacDo}`, {
            ...basePayload,
            id_huyet: idHuyet,
          })
        } else {
          await api.post('/phac-do-dieu-tri', { ...basePayload, id_huyet: idHuyet })
        }
      }
    } else {
      for (const idHuyet of f.id_huyet_list) {
        await api.post('/phac-do-dieu-tri', { ...basePayload, id_huyet: idHuyet })
      }
    }
    await fetchData()
    closeModal()
  } catch (err: any) {
    formError.value = err.message || 'Không lưu được dữ liệu'
  } finally {
    isSubmitting.value = false
  }
}

function confirmDelete(group: BenhGroup) {
  deletingGroup.value = group
  showDeleteConfirm.value = true
}

async function handleDelete() {
  if (isSubmitting.value) return
  if (!deletingGroup.value) return
  isSubmitting.value = true
  try {
    for (const row of deletingGroup.value.items) {
      await api.delete(`/phac-do-dieu-tri/${row.idPhacDo}`)
    }
    showDeleteConfirm.value = false
    deletingGroup.value = null
    await fetchData()
    if (pagedList.value.length === 0 && currentPage.value > 1) {
      currentPage.value--
    }
  } catch (err: any) {
    error.value = err.message || 'Không xóa được bản ghi'
    showDeleteConfirm.value = false
    deletingGroup.value = null
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="management-page">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">Quản Lý Phương Huyệt</h1>
        <p class="page-subtitle">
          Liên kết bệnh ↔ huyệt vị — phương pháp tác động, ghi chú kỹ thuật
        </p>
      </div>
      <button type="button" class="btn-primary" @click="openCreateModal">+ Thêm phương huyệt</button>
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
            placeholder="Tìm theo bệnh, huyệt, phương pháp..."
            autocomplete="off"
          />
        </label>
        <span class="toolbar-count">{{ filteredList.length }} / {{ groupedList.length }} bệnh</span>
      </div>

      <div class="data-card">
        <div class="card-header">
          <h3>Danh sách Phương Huyệt</h3>
          <span class="badge badge-success">{{ filteredList.length }} bệnh · {{ dataList.length }} liên kết</span>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th width="64">ID bệnh</th>
                <th width="220">Bệnh</th>
                <th>Huyệt vị</th>
                <th width="160">Phương pháp</th>
                <th width="220">Ghi chú kỹ thuật</th>
                <th width="120" class="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="pagedList.length === 0">
                <td colspan="6" class="text-center py-8 text-gray-500">
                  {{ searchQuery.trim() ? 'Không khớp bản ghi nào' : 'Chưa có dữ liệu' }}
                </td>
              </tr>
              <tr v-for="group in pagedList" :key="group.idBenh">
                <td class="font-bold cell-id">#{{ group.idBenh }}</td>
                <td>
                  <div class="benh-cell">
                    <span class="chip chip-benh">{{ benhLabel(group.benh, group.idBenh) }}</span>
                    <small v-if="group.benh?.code" class="text-muted">{{ group.benh.code }}</small>
                  </div>
                </td>
                <td>
                  <div v-if="group.items.length" class="chip-row">
                    <span
                      v-for="row in group.items"
                      :key="row.idPhacDo"
                      class="chip chip-huyet"
                      :title="row.huyetVi?.kinhMach ? kinhMachLabel(row.huyetVi.kinhMach) : ''"
                    >
                      {{ huyetViLabel(row.huyetVi) }}
                    </span>
                  </div>
                  <span v-else class="muted">—</span>
                </td>
                <td>
                  <div v-if="groupPhuongPhap(group).length" class="chip-row">
                    <span
                      v-for="(pp, i) in groupPhuongPhap(group)"
                      :key="i"
                      class="chip chip-method"
                    >
                      {{ pp }}
                    </span>
                  </div>
                  <span v-else class="muted">—</span>
                </td>
                <td class="cell-wrap">
                  <template v-if="groupGhiChu(group).length">
                    <div v-for="(note, i) in groupGhiChu(group)" :key="i" class="note-line">
                      {{ note }}
                    </div>
                  </template>
                  <span v-else class="muted">—</span>
                </td>
                <td class="text-right">
                  <div class="row-actions">
                    <button type="button" class="btn-action btn-edit" @click="openEditModal(group)">Sửa</button>
                    <button type="button" class="btn-action btn-delete" @click="confirmDelete(group)">Xóa</button>
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
          <h3>{{ editingBenhId != null ? 'Sửa phương huyệt' : 'Thêm phương huyệt' }}</h3>
          <button type="button" class="modal-close" aria-label="Đóng" @click="closeModal">✕</button>
        </div>
        <form class="modal-body" @submit.prevent="handleSubmit">
          <p v-if="formError" class="form-error">{{ formError }}</p>
          <div class="form-grid">
            <div class="field field--full">
              <div class="field-head">
                <span class="field-label">Bệnh YHCT - Đông Y <abbr title="bắt buộc">*</abbr></span>
                <span class="field-count">{{ form.id_benh != null ? 'Đã chọn' : 'Chưa chọn' }}</span>
              </div>
              <div v-if="benhOptions.length === 0" class="muted">Chưa có dữ liệu Bệnh YHCT - Đông Y</div>
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
                <span class="field-count">{{ form.id_huyet_list.length }} đã chọn</span>
              </div>
              <small v-if="editingBenhId != null" class="field-hint">
                Khi lưu: huyệt bị bỏ chọn sẽ bị xóa khỏi bệnh, huyệt mới sẽ được thêm vào.
              </small>
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
                    :class="{ active: form.id_huyet_list.includes(h.idHuyet) }"
                    @click="toggleHuyet(h.idHuyet)"
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
            Xóa toàn bộ phương huyệt của bệnh
            <strong>{{ benhLabel(deletingGroup?.benh ?? null, deletingGroup?.idBenh) }}</strong>
            ({{ deletingGroup?.items.length ?? 0 }} huyệt)? Thao tác không hoàn tác.
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
.chip-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  overflow-x: auto;
  white-space: nowrap;
}
.chip-row .chip { flex: 0 0 auto; }
.note-line { padding: 2px 0; }
.note-line + .note-line { border-top: 1px dashed var(--gray-200); margin-top: 4px; padding-top: 6px; }

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
