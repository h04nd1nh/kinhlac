<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { api } from '@/services/api'

interface KinhMachLite {
  idKinhMach: number
  ten_kinh_mach: string | null
  ten_viet_tat: string | null
}

interface TrieuChungLite {
  id: number
  ten_trieu_chung: string
}

interface BaiThuocLite {
  id: number
  ten_bai_thuoc: string
}

interface BaiThuocPhapTriLink {
  idBaiThuoc: number
  idPhapTri: number
  thuTu: number
  baiThuoc?: BaiThuocLite | null
}

interface PhapTriRow {
  id: number
  chung_trang: string | null
  nguyen_tac: string | null
  trieu_chung_mo_ta: string | null
  luc_kinh: string | null
  kinh_mach_list: KinhMachLite[]
  trieu_chung_list: TrieuChungLite[]
  bai_thuoc: BaiThuocLite | null
  bai_thuoc_links: BaiThuocPhapTriLink[]
}

interface FormState {
  chung_trang: string
  nguyen_tac: string
  luc_kinh: string
  id_kinh_mach_list: number[]
  id_trieu_chung_list: number[]
  id_bai_thuoc_list: number[]
}

const isLoading = ref(true)
const isSubmitting = ref(false)
const error = ref<string | null>(null)
const formError = ref<string | null>(null)
const dataList = ref<PhapTriRow[]>([])
const searchQuery = ref('')

const kinhMachOptions = ref<KinhMachLite[]>([])
const trieuChungOptions = ref<TrieuChungLite[]>([])
const baiThuocOptions = ref<BaiThuocLite[]>([])

const kinhMachSearch = ref('')
const trieuChungSearch = ref('')
const baiThuocSearch = ref('')

const LUC_KINH_OPTIONS = [
  'Thái Dương Kinh Chứng',
  'Dương Minh Kinh Chứng',
  'Thái Âm Kinh Chứng',
  'Quyết Âm Kinh Chứng',
  'Thiếu Âm Kinh Chứng',
  'Vệ Phận',
  'Khí Phận',
  'Dinh Phận',
  'Huyết Phận',
] as const

const showModal = ref(false)
const showDeleteConfirm = ref(false)
const editingId = ref<number | null>(null)
const deletingItem = ref<PhapTriRow | null>(null)

const emptyForm = (): FormState => ({
  chung_trang: '',
  nguyen_tac: '',
  luc_kinh: '',
  id_kinh_mach_list: [],
  id_trieu_chung_list: [],
  id_bai_thuoc_list: [],
})

const form = ref<FormState>(emptyForm())

const currentPage = ref(1)
const itemsPerPage = ref(10)

onMounted(async () => {
  await Promise.all([fetchData(), fetchKinhMach(), fetchTrieuChung(), fetchBaiThuoc()])
})

watch(searchQuery, () => {
  currentPage.value = 1
})

async function fetchData() {
  isLoading.value = true
  error.value = null
  try {
    const res: any = await api.get('/phap-tri')
    dataList.value = Array.isArray(res) ? res : res?.data ?? []
  } catch (err: any) {
    console.error(err)
    error.value = 'Lỗi khi tải dữ liệu: ' + (err.message || String(err))
  } finally {
    isLoading.value = false
  }
}

async function fetchKinhMach() {
  try {
    const res: any = await api.get('/kinh-mach')
    kinhMachOptions.value = Array.isArray(res) ? res : res?.data ?? []
  } catch (err) {
    console.error('Không tải được danh sách kinh mạch', err)
  }
}

async function fetchTrieuChung() {
  try {
    const res: any = await api.get('/trieu-chung')
    trieuChungOptions.value = Array.isArray(res) ? res : res?.data ?? []
  } catch (err) {
    console.error('Không tải được danh sách triệu chứng', err)
  }
}

async function fetchBaiThuoc() {
  try {
    const res: any = await api.get('/bai-thuoc')
    baiThuocOptions.value = Array.isArray(res) ? res : res?.data ?? []
  } catch (err) {
    console.error('Không tải được danh sách bài thuốc', err)
  }
}

const filteredList = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return dataList.value
  return dataList.value.filter((row) => {
    const hay = [
      row.chung_trang,
      row.nguyen_tac,
      row.trieu_chung_mo_ta,
      row.luc_kinh,
      (row.kinh_mach_list ?? []).map((k) => k.ten_kinh_mach || k.ten_viet_tat || '').join(' '),
      (row.bai_thuoc_links ?? []).map((l) => l.baiThuoc?.ten_bai_thuoc || '').join(' '),
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

function kinhMachLabel(k: KinhMachLite) {
  return k.ten_kinh_mach || k.ten_viet_tat || `#${k.idKinhMach}`
}

const filteredKinhMachOptions = computed(() => {
  const q = kinhMachSearch.value.trim().toLowerCase()
  if (!q) return kinhMachOptions.value
  return kinhMachOptions.value.filter((k) => {
    const hay = [k.ten_kinh_mach, k.ten_viet_tat].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })
})

const filteredTrieuChungOptions = computed(() => {
  const q = trieuChungSearch.value.trim().toLowerCase()
  if (!q) return trieuChungOptions.value
  return trieuChungOptions.value.filter((t) =>
    (t.ten_trieu_chung || '').toLowerCase().includes(q),
  )
})

const filteredBaiThuocOptions = computed(() => {
  const q = baiThuocSearch.value.trim().toLowerCase()
  if (!q) return baiThuocOptions.value
  return baiThuocOptions.value.filter((b) =>
    (b.ten_bai_thuoc || '').toLowerCase().includes(q),
  )
})

function baiThuocCellLabels(row: PhapTriRow): string[] {
  const links = (row.bai_thuoc_links ?? [])
    .slice()
    .sort((a, b) => (a.thuTu ?? 0) - (b.thuTu ?? 0))
  const names = links
    .map((l) => l.baiThuoc?.ten_bai_thuoc)
    .filter((n): n is string => !!n)
  if (names.length > 0) return names
  if (row.bai_thuoc?.ten_bai_thuoc) return [row.bai_thuoc.ten_bai_thuoc]
  return []
}

function trieuChungCellLabels(row: PhapTriRow): string[] {
  if (row.trieu_chung_list?.length) {
    return row.trieu_chung_list.map((t) => t.ten_trieu_chung).filter(Boolean)
  }
  if (row.trieu_chung_mo_ta) {
    return row.trieu_chung_mo_ta
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

function resetPickerSearches() {
  kinhMachSearch.value = ''
  trieuChungSearch.value = ''
  baiThuocSearch.value = ''
}

function openCreateModal() {
  editingId.value = null
  form.value = emptyForm()
  formError.value = null
  resetPickerSearches()
  showModal.value = true
}

function openEditModal(row: PhapTriRow) {
  editingId.value = row.id
  const baiThuocIds = (row.bai_thuoc_links ?? [])
    .slice()
    .sort((a, b) => (a.thuTu ?? 0) - (b.thuTu ?? 0))
    .map((l) => l.idBaiThuoc)
  form.value = {
    chung_trang: row.chung_trang ?? '',
    nguyen_tac: row.nguyen_tac ?? '',
    luc_kinh: row.luc_kinh ?? '',
    id_kinh_mach_list: (row.kinh_mach_list ?? []).map((k) => k.idKinhMach),
    id_trieu_chung_list: (row.trieu_chung_list ?? []).map((t) => t.id),
    id_bai_thuoc_list:
      baiThuocIds.length > 0 ? baiThuocIds : row.bai_thuoc ? [row.bai_thuoc.id] : [],
  }
  formError.value = null
  resetPickerSearches()
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingId.value = null
  resetPickerSearches()
}

function toggleMultiId(list: number[], id: number): number[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

async function handleSubmit() {
  if (isSubmitting.value) return
  formError.value = null
  const f = form.value
  if (!f.chung_trang.trim() && !f.nguyen_tac.trim()) {
    formError.value = 'Cần nhập ít nhất Thể bệnh hoặc Pháp trị'
    return
  }
  const payload = {
    the_benh: f.chung_trang.trim() || null,
    nguyen_tac: f.nguyen_tac.trim() || null,
    luc_kinh: f.luc_kinh.trim() || null,
    id_kinh_mach_list: f.id_kinh_mach_list,
    id_trieu_chung_list: f.id_trieu_chung_list,
    id_bai_thuoc_list: f.id_bai_thuoc_list,
  }
  isSubmitting.value = true
  try {
    if (editingId.value != null) {
      await api.put(`/phap-tri/${editingId.value}`, payload)
    } else {
      await api.post('/phap-tri', payload)
    }
    await fetchData()
    closeModal()
  } catch (err: any) {
    formError.value = err.message || 'Không lưu được dữ liệu'
  } finally {
    isSubmitting.value = false
  }
}

function confirmDelete(row: PhapTriRow) {
  deletingItem.value = row
  showDeleteConfirm.value = true
}

async function handleDelete() {
  if (isSubmitting.value) return
  if (!deletingItem.value) return
  isSubmitting.value = true
  try {
    await api.delete(`/phap-tri/${deletingItem.value.id}`)
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
        <h1 class="page-title">Quản Lý Pháp Trị</h1>
        <p class="page-subtitle">Danh sách các phương pháp điều trị theo Tạng phủ — Thể bệnh — Lục kinh</p>
      </div>
      <button type="button" class="btn-primary" @click="openCreateModal">+ Thêm pháp trị</button>
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
        <div class="search-wrap">
          <label class="search-label" for="phap-tri-search">Tìm kiếm</label>
          <input
            id="phap-tri-search"
            v-model="searchQuery"
            type="search"
            class="search-input"
            placeholder="Tìm theo Tạng phủ, Thể bệnh, Pháp trị, Triệu chứng, Bài thuốc, Lục kinh..."
          />
        </div>
        <div class="toolbar-count">{{ filteredList.length }} / {{ dataList.length }} pháp trị</div>
      </div>

      <div class="data-card">
        <div class="card-header">
          <h3>Danh sách Pháp Trị</h3>
          <span class="badge badge-success">{{ filteredList.length }} bản ghi</span>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th width="60">ID</th>
                <th width="160">Tạng phủ</th>
                <th width="200">Thể bệnh</th>
                <th width="220">Pháp trị</th>
                <th width="220">Triệu chứng</th>
                <th width="200">Bài thuốc tiêu biểu</th>
                <th width="140">Lục kinh</th>
                <th width="120">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="pagedList.length === 0">
                <td colspan="8" class="text-center py-8 text-gray-500">Chưa có dữ liệu</td>
              </tr>
              <tr v-for="item in pagedList" :key="item.id">
                <td class="font-bold">#{{ item.id }}</td>
                <td>
                  <div v-if="item.kinh_mach_list?.length" class="chip-row">
                    <span v-for="k in item.kinh_mach_list" :key="k.idKinhMach" class="chip chip-tang">
                      {{ kinhMachLabel(k) }}
                    </span>
                  </div>
                  <span v-else class="muted">—</span>
                </td>
                <td class="text-brown-900">{{ item.chung_trang || '—' }}</td>
                <td>{{ item.nguyen_tac || '—' }}</td>
                <td>
                  <div v-if="trieuChungCellLabels(item).length" class="chip-row">
                    <span v-for="(t, i) in trieuChungCellLabels(item)" :key="i" class="chip chip-trieu">
                      {{ t }}
                    </span>
                  </div>
                  <span v-else class="muted">—</span>
                </td>
                <td>
                  <div v-if="baiThuocCellLabels(item).length" class="chip-row">
                    <span v-for="(b, i) in baiThuocCellLabels(item)" :key="i" class="chip chip-bai">
                      {{ b }}
                    </span>
                  </div>
                  <span v-else class="muted">—</span>
                </td>
                <td>
                  <span v-if="item.luc_kinh" class="chip chip-luckinh">{{ item.luc_kinh }}</span>
                  <span v-else class="muted">—</span>
                </td>
                <td>
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
          <h3>{{ editingId != null ? 'Sửa pháp trị' : 'Thêm pháp trị' }}</h3>
          <button type="button" class="modal-close" aria-label="Đóng" @click="closeModal">✕</button>
        </div>
        <form class="modal-body" @submit.prevent="handleSubmit">
          <p v-if="formError" class="form-error">{{ formError }}</p>

          <div class="form-grid">
            <label class="field field--full">
              <span>Thể bệnh</span>
              <input v-model="form.chung_trang" class="input" placeholder="vd. Phong hàn xâm nhập biểu" />
            </label>

            <label class="field field--full">
              <span>Pháp trị</span>
              <textarea
                v-model="form.nguyen_tac"
                class="textarea"
                rows="2"
                placeholder="vd. Khu phong, tán hàn, giải biểu"
              ></textarea>
            </label>

            <div class="field field--full">
              <div class="field-head">
                <span class="field-label">Lục kinh</span>
                <span v-if="form.luc_kinh" class="field-count">Đã chọn</span>
              </div>
              <div class="chip-picker">
                <button
                  v-for="opt in LUC_KINH_OPTIONS"
                  :key="opt"
                  type="button"
                  class="chip-toggle"
                  :class="{ active: form.luc_kinh === opt }"
                  @click="form.luc_kinh = form.luc_kinh === opt ? '' : opt"
                >
                  {{ opt }}
                </button>
              </div>
              <small class="field-hint">Chọn 1 giá trị. Bấm lại lựa chọn đang chọn để bỏ.</small>
            </div>

            <div class="field field--full">
              <div class="field-head">
                <span class="field-label">Tạng phủ (Kinh mạch)</span>
                <span class="field-count">{{ form.id_kinh_mach_list.length }} đã chọn</span>
              </div>
              <div v-if="kinhMachOptions.length === 0" class="muted">Chưa có dữ liệu kinh mạch</div>
              <template v-else>
                <div class="picker-search">
                  <input
                    v-model="kinhMachSearch"
                    type="search"
                    class="input input--sm"
                    placeholder="Tìm tạng phủ..."
                  />
                  <button
                    v-if="kinhMachSearch"
                    type="button"
                    class="picker-clear"
                    @click="kinhMachSearch = ''"
                    aria-label="Xóa tìm kiếm"
                  >
                    ✕
                  </button>
                </div>
                <div class="chip-picker chip-picker--scroll">
                  <button
                    v-for="k in filteredKinhMachOptions"
                    :key="k.idKinhMach"
                    type="button"
                    class="chip-toggle"
                    :class="{ active: form.id_kinh_mach_list.includes(k.idKinhMach) }"
                    @click="form.id_kinh_mach_list = toggleMultiId(form.id_kinh_mach_list, k.idKinhMach)"
                  >
                    {{ kinhMachLabel(k) }}
                  </button>
                  <span v-if="filteredKinhMachOptions.length === 0" class="muted">
                    Không khớp "{{ kinhMachSearch }}"
                  </span>
                </div>
              </template>
            </div>

            <div class="field field--full">
              <div class="field-head">
                <span class="field-label">Triệu chứng</span>
                <span class="field-count">{{ form.id_trieu_chung_list.length }} đã chọn</span>
              </div>
              <div v-if="trieuChungOptions.length === 0" class="muted">Chưa có dữ liệu triệu chứng</div>
              <template v-else>
                <div class="picker-search">
                  <input
                    v-model="trieuChungSearch"
                    type="search"
                    class="input input--sm"
                    placeholder="Tìm triệu chứng..."
                  />
                  <button
                    v-if="trieuChungSearch"
                    type="button"
                    class="picker-clear"
                    @click="trieuChungSearch = ''"
                    aria-label="Xóa tìm kiếm"
                  >
                    ✕
                  </button>
                </div>
                <div class="chip-picker chip-picker--scroll">
                  <button
                    v-for="t in filteredTrieuChungOptions"
                    :key="t.id"
                    type="button"
                    class="chip-toggle"
                    :class="{ active: form.id_trieu_chung_list.includes(t.id) }"
                    @click="form.id_trieu_chung_list = toggleMultiId(form.id_trieu_chung_list, t.id)"
                  >
                    {{ t.ten_trieu_chung }}
                  </button>
                  <span v-if="filteredTrieuChungOptions.length === 0" class="muted">
                    Không khớp "{{ trieuChungSearch }}"
                  </span>
                </div>
              </template>
            </div>

            <div class="field field--full">
              <div class="field-head">
                <span class="field-label">Bài thuốc tiêu biểu</span>
                <span class="field-count">{{ form.id_bai_thuoc_list.length }} đã chọn</span>
              </div>
              <div v-if="baiThuocOptions.length === 0" class="muted">Chưa có dữ liệu bài thuốc</div>
              <template v-else>
                <div class="picker-search">
                  <input
                    v-model="baiThuocSearch"
                    type="search"
                    class="input input--sm"
                    placeholder="Tìm bài thuốc..."
                  />
                  <button
                    v-if="baiThuocSearch"
                    type="button"
                    class="picker-clear"
                    @click="baiThuocSearch = ''"
                    aria-label="Xóa tìm kiếm"
                  >
                    ✕
                  </button>
                </div>
                <div class="chip-picker chip-picker--scroll">
                  <button
                    v-for="b in filteredBaiThuocOptions"
                    :key="b.id"
                    type="button"
                    class="chip-toggle"
                    :class="{ active: form.id_bai_thuoc_list.includes(b.id) }"
                    @click="form.id_bai_thuoc_list = toggleMultiId(form.id_bai_thuoc_list, b.id)"
                  >
                    {{ b.ten_bai_thuoc }}
                  </button>
                  <span v-if="filteredBaiThuocOptions.length === 0" class="muted">
                    Không khớp "{{ baiThuocSearch }}"
                  </span>
                </div>
              </template>
              <small class="field-hint">Bài đầu tiên được chọn sẽ là "bài thuốc chính" liên kết với pháp trị.</small>
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
            Xóa pháp trị
            <strong>#{{ deletingItem?.id }} — {{ deletingItem?.chung_trang || deletingItem?.nguyen_tac || '(không tên)' }}</strong>?
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

.toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-4);
}
.search-wrap { display: flex; flex-direction: column; gap: var(--space-1); flex: 1; min-width: 200px; max-width: 520px; }
.search-label { font-size: var(--font-size-xs); font-weight: 600; color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.04em; }
.search-input { padding: var(--space-2) var(--space-3); border: 1px solid var(--gray-200); border-radius: var(--radius-md); font-size: var(--font-size-md); }
.toolbar-count { font-size: var(--font-size-sm); color: var(--gray-500); font-weight: 600; }

.data-card { background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-sm); }
.card-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-5); background: var(--brown-50); border-bottom: 1px solid var(--brown-100); }
.card-header h3 { font-size: var(--font-size-lg); font-weight: 700; color: var(--brown-900); margin: 0; }

.table-responsive { width: 100%; overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: var(--space-3) var(--space-4); text-align: left; border-bottom: 1px solid var(--gray-100); vertical-align: top; }
.data-table th { background: #fdfbf9; font-weight: 600; font-size: var(--font-size-sm); color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.5px; }
.data-table tbody tr:hover { background: var(--gray-50); }
.data-table td { font-size: var(--font-size-md); color: var(--gray-800); }

.chip-row { display: flex; flex-wrap: wrap; gap: 4px; }
.chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-full, 999px);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  border: 1px solid transparent;
}
.chip-tang { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
.chip-trieu { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.chip-bai { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
.chip-luckinh { background: #fce7f3; color: #9d174d; border-color: #f9a8d4; }
.muted { color: var(--gray-400); font-style: italic; }

.row-actions { display: flex; gap: 6px; flex-wrap: wrap; }
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
.py-8 { padding-top: 2rem !important; padding-bottom: 2rem !important; }
.font-bold { font-weight: 700 !important; }
.text-brown-900 { color: var(--brown-900) !important; font-weight: 600; }
.text-gray-500 { color: var(--gray-500) !important; }

.badge { display: inline-block; padding: 4px 10px; border-radius: var(--radius-full, 999px); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.badge-success { background: #d1fae5; color: #059669; }

.loading-state { display: flex; flex-direction: column; align-items: center; padding: var(--space-12) 0; color: var(--brown-600); }
.spinner { width: 32px; height: 32px; border: 3px solid var(--gray-200); border-top-color: var(--brown-500); border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.error-state { text-align: center; padding: var(--space-8); color: var(--danger); background: #fef2f2; border-radius: var(--radius-lg); }

/* Modal */
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
  max-width: 720px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg, 0 20px 25px -5px rgba(0,0,0,0.1));
  overflow: hidden;
}
.modal--wide { max-width: 880px; }
.modal--sm { max-width: 440px; }
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--gray-100);
}
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

.form-error {
  background: #fef2f2;
  color: var(--danger);
  border: 1px solid #fecaca;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
  font-size: var(--font-size-sm);
}

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.field { display: flex; flex-direction: column; gap: 4px; }
.field--full { grid-column: 1 / -1; }
.field > span,
.field-label { font-size: var(--font-size-sm); font-weight: 600; color: var(--gray-700); }
.field-hint { font-size: 11px; color: var(--gray-500); margin-top: 2px; }

.input, .textarea {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-family: inherit;
}
.input:focus, .textarea:focus {
  outline: none;
  border-color: var(--brown-500);
  box-shadow: 0 0 0 3px rgba(146, 64, 14, 0.1);
}
.textarea { resize: vertical; min-height: 60px; }

.field-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}
.field-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--brown-600);
  background: var(--brown-50);
  padding: 1px 8px;
  border-radius: var(--radius-full, 999px);
}

.picker-search {
  position: relative;
  margin-bottom: 6px;
}
.picker-search .input--sm {
  padding-right: 28px;
}
.input--sm {
  padding: 6px 10px;
  font-size: 13px;
}
.picker-clear {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gray-100);
  border: none;
  border-radius: 50%;
  color: var(--gray-600);
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
}
.picker-clear:hover { background: var(--gray-200); color: var(--gray-800); }

.chip-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: var(--space-2);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  background: var(--gray-50);
}
.chip-picker--scroll { max-height: 180px; overflow-y: auto; }
.chip-toggle {
  padding: 4px 10px;
  font-size: 13px;
  font-weight: 600;
  border-radius: var(--radius-full, 999px);
  border: 1px solid var(--gray-300);
  background: var(--white);
  color: var(--gray-700);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.chip-toggle:hover { border-color: var(--brown-400); color: var(--brown-700); }
.chip-toggle.active {
  background: var(--brown-600);
  color: var(--white);
  border-color: var(--brown-600);
}
</style>
