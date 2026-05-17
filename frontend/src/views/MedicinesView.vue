<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { api } from '@/services/api'
import PharmacologyManager from '@/components/PharmacologyManager.vue'

interface BaiThuocChiTietLite {
  id_vi_thuoc?: number
  lieu_luong: string | null
  viThuoc?: { id: number; ten_vi_thuoc: string } | null
}

interface PhapTriLite {
  id: number
  nguyen_tac: string | null
  chung_trang: string | null
}

interface BaiThuocPhapTriLink {
  idPhapTri: number
  thuTu?: number
  phapTri?: PhapTriLite | null
}

interface TrieuChungLite {
  id: number
  ten_trieu_chung: string
}

interface BaiThuoc {
  id: number
  ten_bai_thuoc: string
  nguon_goc: string | null
  cach_dung: string | null
  trieu_chung: string | null
  trieuChungList?: TrieuChungLite[] | null
  phapTriLinks?: BaiThuocPhapTriLink[] | null
  chiTietViThuoc?: BaiThuocChiTietLite[] | null
}

interface ViThuoc {
  id: number
  ten_vi_thuoc: string
  tinh: string | null
  vi: string | null
  quy_kinh: string | null
  lieu_dung?: string | null
}

interface BaiThuocFormChiTiet {
  id_vi_thuoc: number | null
  lieu_luong: string
}

interface BaiThuocForm {
  ten_bai_thuoc: string
  nguon_goc: string
  cach_dung: string
  phap_tri_ids: number[]
  trieu_chung_ids: number[]
  chi_tiet: BaiThuocFormChiTiet[]
}

interface ViThuocForm {
  ten_vi_thuoc: string
  tinh: string
  vi: string
  quy_kinh: string
}

const activeTab = ref<'bai-thuoc' | 'vi-thuoc' | 'duoc-ly'>('bai-thuoc')
const isLoading = ref(true)
const error = ref<string | null>(null)

const baiThuocList = ref<BaiThuoc[]>([])
const viThuocList = ref<ViThuoc[]>([])
const phapTriOptions = ref<PhapTriLite[]>([])
const trieuChungOptions = ref<TrieuChungLite[]>([])

// Pagination
const itemsPerPage = ref(10)
const baiThuocPage = ref(1)
const viThuocPage = ref(1)

const pagedBaiThuoc = computed(() => {
  const start = (baiThuocPage.value - 1) * itemsPerPage.value
  return baiThuocList.value.slice(start, start + itemsPerPage.value)
})

const pagedViThuoc = computed(() => {
  const start = (viThuocPage.value - 1) * itemsPerPage.value
  return viThuocList.value.slice(start, start + itemsPerPage.value)
})

const totalBTPage = computed(() => Math.ceil(baiThuocList.value.length / itemsPerPage.value))
const totalVTPage = computed(() => Math.ceil(viThuocList.value.length / itemsPerPage.value))

function getPageNumbers(current: number, total: number) {
  const pages: number[] = []
  const start = Math.max(1, current - 2)
  const end = Math.min(total, current + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
}

function phapTriLabel(p: PhapTriLite): string {
  return (p.nguyen_tac || p.chung_trang || `#${p.id}`).trim()
}

function phapTriLabels(bt: BaiThuoc): string[] {
  const links = (bt.phapTriLinks ?? [])
    .slice()
    .sort((a, b) => (a.thuTu ?? 0) - (b.thuTu ?? 0))
  return links
    .map((l) => (l.phapTri?.nguyen_tac || l.phapTri?.chung_trang || '').trim())
    .filter((s) => s.length > 0)
}

function trieuChungLabels(bt: BaiThuoc): string[] {
  if (bt.trieuChungList && bt.trieuChungList.length > 0) {
    return bt.trieuChungList.map((t) => t.ten_trieu_chung).filter(Boolean)
  }
  if (bt.trieu_chung) {
    return bt.trieu_chung.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

function thanhPhanItems(bt: BaiThuoc): { ten: string; lieu: string }[] {
  return (bt.chiTietViThuoc ?? [])
    .map((ct) => ({
      ten: ct.viThuoc?.ten_vi_thuoc?.trim() || '',
      lieu: (ct.lieu_luong ?? '').trim(),
    }))
    .filter((x) => x.ten.length > 0)
}

onMounted(async () => {
  await fetchData()
})

async function fetchData() {
  isLoading.value = true
  error.value = null
  try {
    const [btRes, vtRes, ptRes, tcRes] = await Promise.all([
      api.get<any>('/bai-thuoc'),
      api.get<any>('/vi-thuoc'),
      api.get<any>('/phap-tri'),
      api.get<any>('/trieu-chung'),
    ])
    baiThuocList.value = Array.isArray(btRes) ? btRes : (btRes.data || [])
    viThuocList.value = Array.isArray(vtRes) ? vtRes : (vtRes.data || [])
    phapTriOptions.value = Array.isArray(ptRes) ? ptRes : (ptRes.data || [])
    trieuChungOptions.value = Array.isArray(tcRes) ? tcRes : (tcRes.data || [])
  } catch (err: any) {
    console.error(err)
    error.value = 'Lỗi khi tải dữ liệu: ' + err.message
  } finally {
    isLoading.value = false
  }
}

// ─── BÀI THUỐC CRUD ───────────────────────────────────────────────────────
const btShowModal = ref(false)
const btEditingId = ref<number | null>(null)
const btSubmitting = ref(false)
const btFormError = ref<string | null>(null)
const btPhapTriSearch = ref('')
const btTrieuChungSearch = ref('')
const btViThuocSearch = ref<string[]>([])

const emptyBaiThuocForm = (): BaiThuocForm => ({
  ten_bai_thuoc: '',
  nguon_goc: '',
  cach_dung: '',
  phap_tri_ids: [],
  trieu_chung_ids: [],
  chi_tiet: [],
})

const btForm = ref<BaiThuocForm>(emptyBaiThuocForm())

const btShowDelete = ref(false)
const btDeleting = ref<BaiThuoc | null>(null)

const filteredBtPhapTri = computed(() => {
  const q = btPhapTriSearch.value.trim().toLowerCase()
  if (!q) return phapTriOptions.value
  return phapTriOptions.value.filter((p) => phapTriLabel(p).toLowerCase().includes(q))
})

const filteredBtTrieuChung = computed(() => {
  const q = btTrieuChungSearch.value.trim().toLowerCase()
  if (!q) return trieuChungOptions.value
  return trieuChungOptions.value.filter((t) => (t.ten_trieu_chung || '').toLowerCase().includes(q))
})

function filteredViThuocFor(index: number) {
  const q = (btViThuocSearch.value[index] || '').trim().toLowerCase()
  if (!q) return viThuocList.value
  return viThuocList.value.filter((v) => (v.ten_vi_thuoc || '').toLowerCase().includes(q))
}

function toggleId(list: number[], id: number): number[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

function openCreateBaiThuoc() {
  btEditingId.value = null
  btForm.value = emptyBaiThuocForm()
  btFormError.value = null
  btPhapTriSearch.value = ''
  btTrieuChungSearch.value = ''
  btViThuocSearch.value = []
  btShowModal.value = true
}

function openEditBaiThuoc(bt: BaiThuoc) {
  btEditingId.value = bt.id
  const phapIds = (bt.phapTriLinks ?? [])
    .slice()
    .sort((a, b) => (a.thuTu ?? 0) - (b.thuTu ?? 0))
    .map((l) => l.idPhapTri)
  const trieuIds = (bt.trieuChungList ?? []).map((t) => t.id)
  const chiTiet: BaiThuocFormChiTiet[] = (bt.chiTietViThuoc ?? []).map((ct) => ({
    id_vi_thuoc: ct.viThuoc?.id ?? ct.id_vi_thuoc ?? null,
    lieu_luong: ct.lieu_luong ?? '',
  }))
  btForm.value = {
    ten_bai_thuoc: bt.ten_bai_thuoc ?? '',
    nguon_goc: bt.nguon_goc ?? '',
    cach_dung: bt.cach_dung ?? '',
    phap_tri_ids: phapIds,
    trieu_chung_ids: trieuIds,
    chi_tiet: chiTiet,
  }
  btFormError.value = null
  btPhapTriSearch.value = ''
  btTrieuChungSearch.value = ''
  btViThuocSearch.value = chiTiet.map(() => '')
  btShowModal.value = true
}

function closeBaiThuocModal() {
  btShowModal.value = false
  btEditingId.value = null
}

function addChiTietRow() {
  btForm.value.chi_tiet.push({ id_vi_thuoc: null, lieu_luong: '' })
  btViThuocSearch.value.push('')
}

function removeChiTietRow(i: number) {
  btForm.value.chi_tiet.splice(i, 1)
  btViThuocSearch.value.splice(i, 1)
}

async function submitBaiThuoc() {
  if (btSubmitting.value) return
  btFormError.value = null
  const f = btForm.value
  if (!f.ten_bai_thuoc.trim()) {
    btFormError.value = 'Tên bài thuốc không được để trống'
    return
  }
  const chiTietClean = f.chi_tiet
    .filter((c) => c.id_vi_thuoc != null)
    .map((c) => ({
      id_vi_thuoc: c.id_vi_thuoc as number,
      lieu_luong: c.lieu_luong.trim() || undefined,
    }))
  const payload = {
    ten_bai_thuoc: f.ten_bai_thuoc.trim(),
    nguon_goc: f.nguon_goc.trim() || undefined,
    cach_dung: f.cach_dung.trim() || undefined,
    phap_tri_ids: f.phap_tri_ids,
    trieu_chung_ids: f.trieu_chung_ids,
    chi_tiet: chiTietClean,
  }
  btSubmitting.value = true
  try {
    if (btEditingId.value != null) {
      await api.put(`/bai-thuoc/${btEditingId.value}`, payload)
    } else {
      await api.post('/bai-thuoc', payload)
    }
    await fetchData()
    closeBaiThuocModal()
  } catch (err: any) {
    btFormError.value = err.message || 'Không lưu được bài thuốc'
  } finally {
    btSubmitting.value = false
  }
}

function confirmDeleteBaiThuoc(bt: BaiThuoc) {
  btDeleting.value = bt
  btShowDelete.value = true
}

async function deleteBaiThuoc() {
  if (!btDeleting.value || btSubmitting.value) return
  btSubmitting.value = true
  try {
    await api.delete(`/bai-thuoc/${btDeleting.value.id}`)
    btShowDelete.value = false
    btDeleting.value = null
    await fetchData()
    if (pagedBaiThuoc.value.length === 0 && baiThuocPage.value > 1) baiThuocPage.value--
  } catch (err: any) {
    error.value = err.message || 'Không xóa được bài thuốc'
    btShowDelete.value = false
  } finally {
    btSubmitting.value = false
  }
}

// ─── VỊ THUỐC CRUD ────────────────────────────────────────────────────────
const vtShowModal = ref(false)
const vtEditingId = ref<number | null>(null)
const vtSubmitting = ref(false)
const vtFormError = ref<string | null>(null)

const emptyViThuocForm = (): ViThuocForm => ({
  ten_vi_thuoc: '',
  tinh: '',
  vi: '',
  quy_kinh: '',
})

const vtForm = ref<ViThuocForm>(emptyViThuocForm())

const vtShowDelete = ref(false)
const vtDeleting = ref<ViThuoc | null>(null)

function openCreateViThuoc() {
  vtEditingId.value = null
  vtForm.value = emptyViThuocForm()
  vtFormError.value = null
  vtShowModal.value = true
}

function openEditViThuoc(vt: ViThuoc) {
  vtEditingId.value = vt.id
  vtForm.value = {
    ten_vi_thuoc: vt.ten_vi_thuoc ?? '',
    tinh: vt.tinh ?? '',
    vi: vt.vi ?? '',
    quy_kinh: vt.quy_kinh ?? '',
  }
  vtFormError.value = null
  vtShowModal.value = true
}

function closeViThuocModal() {
  vtShowModal.value = false
  vtEditingId.value = null
}

async function submitViThuoc() {
  if (vtSubmitting.value) return
  vtFormError.value = null
  const f = vtForm.value
  const isEdit = vtEditingId.value != null
  if (!isEdit && !f.ten_vi_thuoc.trim()) {
    vtFormError.value = 'Tên vị thuốc không được để trống'
    return
  }
  vtSubmitting.value = true
  try {
    if (isEdit) {
      // Edit: chỉ gửi tinh / vi / quy_kinh — không đổi tên
      const payload = {
        tinh: f.tinh.trim() || undefined,
        vi: f.vi.trim() || undefined,
        quy_kinh: f.quy_kinh.trim() || undefined,
      }
      await api.put(`/vi-thuoc/${vtEditingId.value}`, payload)
    } else {
      const payload = {
        ten_vi_thuoc: f.ten_vi_thuoc.trim(),
        tinh: f.tinh.trim() || undefined,
        vi: f.vi.trim() || undefined,
        quy_kinh: f.quy_kinh.trim() || undefined,
      }
      await api.post('/vi-thuoc', payload)
    }
    await fetchData()
    closeViThuocModal()
  } catch (err: any) {
    vtFormError.value = err.message || 'Không lưu được vị thuốc'
  } finally {
    vtSubmitting.value = false
  }
}

function confirmDeleteViThuoc(vt: ViThuoc) {
  vtDeleting.value = vt
  vtShowDelete.value = true
}

async function deleteViThuoc() {
  if (!vtDeleting.value || vtSubmitting.value) return
  vtSubmitting.value = true
  try {
    await api.delete(`/vi-thuoc/${vtDeleting.value.id}`)
    vtShowDelete.value = false
    vtDeleting.value = null
    await fetchData()
    if (pagedViThuoc.value.length === 0 && viThuocPage.value > 1) viThuocPage.value--
  } catch (err: any) {
    error.value = err.message || 'Không xóa được vị thuốc'
    vtShowDelete.value = false
  } finally {
    vtSubmitting.value = false
  }
}
</script>

<template>
  <div class="management-page">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">Quản Lý Thuốc</h1>
        <p class="page-subtitle">Quản lý bài thuốc, vị thuốc và phân loại dược lý Đông Y</p>
      </div>
      <div class="view-toggle">
        <button
          class="toggle-btn"
          :class="{ active: activeTab === 'bai-thuoc' }"
          @click="activeTab = 'bai-thuoc'"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          Bài Thuốc
        </button>
        <button
          class="toggle-btn"
          :class="{ active: activeTab === 'vi-thuoc' }"
          @click="activeTab = 'vi-thuoc'"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          Vị Thuốc
        </button>
        <button
          class="toggle-btn"
          :class="{ active: activeTab === 'duoc-ly' }"
          @click="activeTab = 'duoc-ly'"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2L2 7l10 5 10-5-10-5z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2 17l10 5 10-5"/><path stroke-linecap="round" stroke-linejoin="round" d="M2 12l10 5 10-5"/></svg>
          Dược Lý
        </button>
      </div>
    </div>

    <div v-if="activeTab === 'duoc-ly'" class="content-body">
      <PharmacologyManager />
    </div>

    <div v-else-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Đang tải dữ liệu...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button class="btn-secondary mt-4" @click="fetchData">Thử lại</button>
    </div>

    <div v-else class="content-body">
      <!-- TAB BÀI THUỐC -->
      <div v-if="activeTab === 'bai-thuoc'" class="tab-content">
        <div class="data-card">
          <div class="card-header">
            <div class="card-header-left">
              <h3>Danh sách Bài Thuốc</h3>
              <span class="badge badge-info">{{ baiThuocList.length }} bài thuốc</span>
            </div>
            <button type="button" class="btn-primary" @click="openCreateBaiThuoc">+ Thêm bài thuốc</button>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th width="200">Tên Bài Thuốc</th>
                  <th width="140">Nguồn Gốc</th>
                  <th width="200">Pháp Trị</th>
                  <th width="200">Triệu Chứng</th>
                  <th width="180">Cách Dùng</th>
                  <th>Thành Phần</th>
                  <th width="120">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="pagedBaiThuoc.length === 0">
                  <td colspan="7" class="text-center py-8 text-gray-500">Chưa có dữ liệu bài thuốc</td>
                </tr>
                <tr v-for="bt in pagedBaiThuoc" :key="bt.id">
                  <td class="font-bold text-brown-900">{{ bt.ten_bai_thuoc }}</td>
                  <td class="text-gray-600">{{ bt.nguon_goc || '—' }}</td>
                  <td>
                    <div v-if="phapTriLabels(bt).length" class="chip-row">
                      <span v-for="(p, i) in phapTriLabels(bt)" :key="i" class="chip chip-phap">{{ p }}</span>
                    </div>
                    <span v-else class="muted">—</span>
                  </td>
                  <td>
                    <div v-if="trieuChungLabels(bt).length" class="chip-row">
                      <span v-for="(t, i) in trieuChungLabels(bt)" :key="i" class="chip chip-trieu">{{ t }}</span>
                    </div>
                    <span v-else class="muted">—</span>
                  </td>
                  <td class="text-gray-600">{{ bt.cach_dung || '—' }}</td>
                  <td>
                    <ul v-if="thanhPhanItems(bt).length" class="thanh-phan-list">
                      <li v-for="(it, i) in thanhPhanItems(bt)" :key="i">
                        <span class="vt-name">{{ it.ten }}</span>
                        <span v-if="it.lieu" class="vt-lieu">{{ it.lieu }}</span>
                      </li>
                    </ul>
                    <span v-else class="muted">—</span>
                  </td>
                  <td>
                    <div class="row-actions">
                      <button type="button" class="btn-action btn-edit" @click="openEditBaiThuoc(bt)">Sửa</button>
                      <button type="button" class="btn-action btn-delete" @click="confirmDeleteBaiThuoc(bt)">Xóa</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="totalBTPage > 1" class="pagination">
            <button class="page-btn" :disabled="baiThuocPage <= 1" @click="baiThuocPage--">‹</button>
            <button v-for="pn in getPageNumbers(baiThuocPage, totalBTPage)" :key="pn" class="page-btn" :class="{ active: pn === baiThuocPage }" @click="baiThuocPage = pn">{{ pn }}</button>
            <button class="page-btn" :disabled="baiThuocPage >= totalBTPage" @click="baiThuocPage++">›</button>
            <span class="page-info">Trang {{ baiThuocPage }} / {{ totalBTPage }}</span>
          </div>
        </div>
      </div>

      <!-- TAB VỊ THUỐC -->
      <div v-else class="tab-content">
        <div class="data-card">
          <div class="card-header">
            <div class="card-header-left">
              <h3>Danh sách Vị Thuốc</h3>
              <span class="badge badge-success">{{ viThuocList.length }} vị thuốc</span>
            </div>
            <button type="button" class="btn-primary" @click="openCreateViThuoc">+ Thêm vị thuốc</button>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th width="80">ID</th>
                  <th width="250">Tên Vị Thuốc</th>
                  <th width="140">Tính</th>
                  <th width="140">Vị</th>
                  <th>Quy Kinh</th>
                  <th width="120">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="pagedViThuoc.length === 0">
                  <td colspan="6" class="text-center py-8 text-gray-500">Chưa có dữ liệu vị thuốc</td>
                </tr>
                <tr v-for="vt in pagedViThuoc" :key="vt.id">
                  <td>#{{ vt.id }}</td>
                  <td class="font-bold text-brown-900">{{ vt.ten_vi_thuoc }}</td>
                  <td class="text-gray-600">{{ vt.tinh || '—' }}</td>
                  <td class="text-gray-600">{{ vt.vi || '—' }}</td>
                  <td class="text-gray-600">{{ vt.quy_kinh || '—' }}</td>
                  <td>
                    <div class="row-actions">
                      <button type="button" class="btn-action btn-edit" @click="openEditViThuoc(vt)">Sửa</button>
                      <button type="button" class="btn-action btn-delete" @click="confirmDeleteViThuoc(vt)">Xóa</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="totalVTPage > 1" class="pagination">
            <button class="page-btn" :disabled="viThuocPage <= 1" @click="viThuocPage--">‹</button>
            <button v-for="pn in getPageNumbers(viThuocPage, totalVTPage)" :key="pn" class="page-btn" :class="{ active: pn === viThuocPage }" @click="viThuocPage = pn">{{ pn }}</button>
            <button class="page-btn" :disabled="viThuocPage >= totalVTPage" @click="viThuocPage++">›</button>
            <span class="page-info">Trang {{ viThuocPage }} / {{ totalVTPage }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- BÀI THUỐC MODAL -->
    <div v-if="btShowModal" class="modal-overlay" @click.self="closeBaiThuocModal">
      <div class="modal modal--wide" @click.stop>
        <div class="modal-header">
          <h3>{{ btEditingId != null ? 'Sửa bài thuốc' : 'Thêm bài thuốc' }}</h3>
          <button type="button" class="modal-close" @click="closeBaiThuocModal">✕</button>
        </div>
        <form class="modal-body" @submit.prevent="submitBaiThuoc">
          <p v-if="btFormError" class="form-error">{{ btFormError }}</p>

          <div class="form-grid">
            <label class="field field--full">
              <span>Tên bài thuốc *</span>
              <input v-model="btForm.ten_bai_thuoc" class="input" placeholder="vd. Quế Chi Thang" />
            </label>

            <label class="field">
              <span>Nguồn gốc</span>
              <input v-model="btForm.nguon_goc" class="input" placeholder="vd. Thương Hàn Luận / Trương Trọng Cảnh" />
            </label>

            <label class="field">
              <span>Cách dùng</span>
              <input v-model="btForm.cach_dung" class="input" placeholder="vd. Sắc uống ngày 1 thang" />
            </label>

            <div class="field field--full">
              <div class="field-head">
                <span class="field-label">Pháp trị</span>
                <span class="field-count">{{ btForm.phap_tri_ids.length }} đã chọn</span>
              </div>
              <div v-if="phapTriOptions.length === 0" class="muted">Chưa có pháp trị</div>
              <template v-else>
                <div class="picker-search">
                  <input v-model="btPhapTriSearch" type="search" class="input input--sm" placeholder="Tìm pháp trị..." />
                </div>
                <div class="chip-picker chip-picker--scroll">
                  <button
                    v-for="p in filteredBtPhapTri"
                    :key="p.id"
                    type="button"
                    class="chip-toggle"
                    :class="{ active: btForm.phap_tri_ids.includes(p.id) }"
                    @click="btForm.phap_tri_ids = toggleId(btForm.phap_tri_ids, p.id)"
                  >
                    {{ phapTriLabel(p) }}
                  </button>
                  <span v-if="filteredBtPhapTri.length === 0" class="muted">Không khớp</span>
                </div>
              </template>
            </div>

            <div class="field field--full">
              <div class="field-head">
                <span class="field-label">Triệu chứng</span>
                <span class="field-count">{{ btForm.trieu_chung_ids.length }} đã chọn</span>
              </div>
              <div v-if="trieuChungOptions.length === 0" class="muted">Chưa có triệu chứng</div>
              <template v-else>
                <div class="picker-search">
                  <input v-model="btTrieuChungSearch" type="search" class="input input--sm" placeholder="Tìm triệu chứng..." />
                </div>
                <div class="chip-picker chip-picker--scroll">
                  <button
                    v-for="t in filteredBtTrieuChung"
                    :key="t.id"
                    type="button"
                    class="chip-toggle"
                    :class="{ active: btForm.trieu_chung_ids.includes(t.id) }"
                    @click="btForm.trieu_chung_ids = toggleId(btForm.trieu_chung_ids, t.id)"
                  >
                    {{ t.ten_trieu_chung }}
                  </button>
                  <span v-if="filteredBtTrieuChung.length === 0" class="muted">Không khớp</span>
                </div>
              </template>
            </div>

            <div class="field field--full">
              <div class="field-head">
                <span class="field-label">Thành phần (vị thuốc, liều lượng)</span>
                <button type="button" class="btn-mini" @click="addChiTietRow">+ Thêm dòng</button>
              </div>
              <div v-if="btForm.chi_tiet.length === 0" class="muted">Chưa có vị thuốc nào — bấm "Thêm dòng" để thêm</div>
              <div v-for="(row, i) in btForm.chi_tiet" :key="i" class="chi-tiet-row">
                <div class="ct-vt">
                  <input
                    v-model="btViThuocSearch[i]"
                    type="search"
                    class="input input--sm"
                    placeholder="Tìm vị thuốc..."
                  />
                  <select v-model.number="row.id_vi_thuoc" class="input input--sm">
                    <option :value="null">— Chọn vị thuốc —</option>
                    <option v-for="v in filteredViThuocFor(i)" :key="v.id" :value="v.id">
                      {{ v.ten_vi_thuoc }}
                    </option>
                  </select>
                </div>
                <input
                  v-model="row.lieu_luong"
                  class="input input--sm ct-lieu"
                  placeholder="Liều (vd. 12g)"
                />
                <button type="button" class="btn-mini btn-mini-danger" @click="removeChiTietRow(i)">✕</button>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" :disabled="btSubmitting" @click="closeBaiThuocModal">Hủy</button>
            <button type="submit" class="btn-primary" :disabled="btSubmitting">
              {{ btSubmitting ? 'Đang lưu…' : 'Lưu' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="btShowDelete" class="modal-overlay" @click.self="btShowDelete = false">
      <div class="modal modal--sm" @click.stop>
        <div class="modal-header">
          <h3>Xác nhận xóa</h3>
          <button type="button" class="modal-close" @click="btShowDelete = false">✕</button>
        </div>
        <div class="modal-body">
          <p>Xóa bài thuốc <strong>{{ btDeleting?.ten_bai_thuoc }}</strong>? Thao tác không hoàn tác.</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-secondary" :disabled="btSubmitting" @click="btShowDelete = false">Hủy</button>
          <button type="button" class="btn-danger" :disabled="btSubmitting" @click="deleteBaiThuoc">
            {{ btSubmitting ? 'Đang xóa…' : 'Xóa' }}
          </button>
        </div>
      </div>
    </div>

    <!-- VỊ THUỐC MODAL -->
    <div v-if="vtShowModal" class="modal-overlay" @click.self="closeViThuocModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>{{ vtEditingId != null ? 'Sửa vị thuốc' : 'Thêm vị thuốc' }}</h3>
          <button type="button" class="modal-close" @click="closeViThuocModal">✕</button>
        </div>
        <form class="modal-body" @submit.prevent="submitViThuoc">
          <p v-if="vtFormError" class="form-error">{{ vtFormError }}</p>

          <div class="form-grid">
            <label class="field field--full">
              <span>Tên vị thuốc{{ vtEditingId != null ? '' : ' *' }}</span>
              <input
                v-model="vtForm.ten_vi_thuoc"
                class="input"
                placeholder="vd. Cam thảo"
                :readonly="vtEditingId != null"
                :disabled="vtEditingId != null"
              />
            </label>

            <label class="field">
              <span>Tính</span>
              <input v-model="vtForm.tinh" class="input" placeholder="vd. Ấm, Hàn, Bình..." />
            </label>

            <label class="field">
              <span>Vị</span>
              <input v-model="vtForm.vi" class="input" placeholder="vd. Ngọt, Cay, Đắng..." />
            </label>

            <label class="field field--full">
              <span>Quy kinh</span>
              <input v-model="vtForm.quy_kinh" class="input" placeholder="vd. Tỳ, Vị, Phế (cách nhau dấu phẩy)" />
            </label>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" :disabled="vtSubmitting" @click="closeViThuocModal">Hủy</button>
            <button type="submit" class="btn-primary" :disabled="vtSubmitting">
              {{ vtSubmitting ? 'Đang lưu…' : 'Lưu' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="vtShowDelete" class="modal-overlay" @click.self="vtShowDelete = false">
      <div class="modal modal--sm" @click.stop>
        <div class="modal-header">
          <h3>Xác nhận xóa</h3>
          <button type="button" class="modal-close" @click="vtShowDelete = false">✕</button>
        </div>
        <div class="modal-body">
          <p>Xóa vị thuốc <strong>{{ vtDeleting?.ten_vi_thuoc }}</strong>? Thao tác không hoàn tác.</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-secondary" :disabled="vtSubmitting" @click="vtShowDelete = false">Hủy</button>
          <button type="button" class="btn-danger" :disabled="vtSubmitting" @click="deleteViThuoc">
            {{ vtSubmitting ? 'Đang xóa…' : 'Xóa' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.management-page { width: 100%; animation: fadeIn 0.4s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* Header */
.page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: var(--space-6); padding-bottom: var(--space-4); border-bottom: 2px solid var(--brown-100); }
.page-title { font-size: var(--font-size-2xl); font-weight: 800; color: var(--brown-800); margin-bottom: var(--space-1); }
.page-subtitle { color: var(--gray-500); font-size: var(--font-size-md); }

.view-toggle { display: flex; background: var(--white); padding: 4px; border-radius: var(--radius-lg); border: 1px solid var(--brown-200); box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.toggle-btn { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-weight: 600; font-size: var(--font-size-sm); color: var(--gray-600); transition: all var(--transition-base); }
.toggle-btn:hover { color: var(--brown-600); }
.toggle-btn.active { background: var(--brown-600); color: var(--white); box-shadow: 0 2px 4px rgba(161, 98, 7, 0.2); }

.data-card { background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-sm); }
.card-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-5); background: var(--brown-50); border-bottom: 1px solid var(--brown-100); gap: var(--space-3); }
.card-header-left { display: flex; align-items: center; gap: var(--space-3); }
.card-header h3 { font-size: var(--font-size-lg); font-weight: 700; color: var(--brown-900); margin: 0; }

.table-responsive { width: 100%; overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: var(--space-3) var(--space-5); text-align: left; border-bottom: 1px solid var(--gray-100); }
.data-table th { background: #fdfbf9; font-weight: 600; font-size: var(--font-size-sm); color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.5px; }
.data-table tbody tr { transition: background 0.2s; }
.data-table tbody tr:hover { background: var(--gray-50); }
.data-table td { font-size: var(--font-size-md); color: var(--gray-800); vertical-align: top; }

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
.text-gray-600 { color: var(--gray-600) !important; }
.text-gray-500 { color: var(--gray-500) !important; }

.badge { display: inline-block; padding: 4px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.badge-info { background: #e0f2fe; color: #0369a1; }
.badge-success { background: #d1fae5; color: #059669; }

.chip-row { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; line-height: 1.4; border: 1px solid transparent; }
.chip-phap { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
.chip-trieu { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.muted { color: var(--gray-400); font-style: italic; }

.thanh-phan-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; }
.thanh-phan-list li { display: flex; gap: 8px; align-items: baseline; font-size: 13px; }
.vt-name { color: var(--brown-900); font-weight: 600; }
.vt-lieu { color: var(--gray-600); font-size: 12px; }

.loading-state { display: flex; flex-direction: column; align-items: center; padding: var(--space-12) 0; color: var(--brown-600); }
.spinner { width: 32px; height: 32px; border: 3px solid var(--gray-200); border-top-color: var(--brown-500); border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.error-state { text-align: center; padding: var(--space-8); color: var(--danger); background: #fef2f2; border-radius: var(--radius-lg); }

/* Buttons */
.btn-primary { padding: var(--space-2) var(--space-4); background: var(--brown-600); color: var(--white); border: none; border-radius: var(--radius-md); font-weight: 600; font-size: var(--font-size-sm); cursor: pointer; transition: background var(--transition-fast); }
.btn-primary:hover:not(:disabled) { background: var(--brown-700); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { padding: var(--space-2) var(--space-4); background: var(--white); color: var(--gray-700); border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-weight: 600; font-size: var(--font-size-sm); cursor: pointer; }
.btn-secondary:hover:not(:disabled) { background: var(--gray-50); }
.btn-danger { padding: var(--space-2) var(--space-4); background: var(--danger); color: var(--white); border: none; border-radius: var(--radius-md); font-weight: 600; font-size: var(--font-size-sm); cursor: pointer; }
.btn-danger:hover:not(:disabled) { background: #b91c1c; }
.mt-4 { margin-top: var(--space-4); }

.row-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.btn-action { padding: 4px 10px; font-size: 12px; font-weight: 600; border-radius: var(--radius-sm); border: 1px solid var(--gray-200); background: var(--white); cursor: pointer; transition: all var(--transition-fast); }
.btn-edit:hover { background: var(--brown-50); border-color: var(--brown-400); color: var(--brown-700); }
.btn-delete { color: var(--danger); }
.btn-delete:hover { background: #fef2f2; border-color: #fca5a5; }
.btn-mini { padding: 4px 10px; font-size: 12px; font-weight: 600; border-radius: var(--radius-sm); border: 1px solid var(--brown-300); background: var(--brown-50); color: var(--brown-700); cursor: pointer; }
.btn-mini:hover { background: var(--brown-100); }
.btn-mini-danger { border-color: #fca5a5; background: #fef2f2; color: var(--danger); }
.btn-mini-danger:hover { background: #fee2e2; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; z-index: 50; padding: var(--space-4); }
.modal { background: var(--white); border-radius: var(--radius-xl); width: 100%; max-width: 560px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.15); }
.modal--wide { max-width: 880px; }
.modal--sm { max-width: 440px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--gray-100); }
.modal-header h3 { margin: 0; font-size: var(--font-size-lg); font-weight: 700; color: var(--brown-800); }
.modal-close { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--gray-500); }
.modal-close:hover { color: var(--gray-800); }
.modal-body { padding: var(--space-5); overflow-y: auto; flex: 1; }
.modal-footer { display: flex; gap: var(--space-2); justify-content: flex-end; padding: var(--space-4) var(--space-5); border-top: 1px solid var(--gray-100); background: var(--gray-50); }

.form-error { background: #fef2f2; color: var(--danger); border: 1px solid #fecaca; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-3); font-size: var(--font-size-sm); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.field { display: flex; flex-direction: column; gap: 4px; }
.field--full { grid-column: 1 / -1; }
.field > span, .field-label { font-size: var(--font-size-sm); font-weight: 600; color: var(--gray-700); }

.input { width: 100%; padding: var(--space-2) var(--space-3); border: 1px solid var(--gray-200); border-radius: var(--radius-md); font-size: var(--font-size-md); font-family: inherit; background: var(--white); }
.input:focus { outline: none; border-color: var(--brown-500); box-shadow: 0 0 0 3px rgba(146, 64, 14, 0.1); }
.input[readonly], .input:disabled { background: var(--gray-100); color: var(--gray-600); cursor: not-allowed; }
.input--sm { padding: 6px 10px; font-size: 13px; }

.field-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-bottom: 4px; }
.field-count { font-size: 11px; font-weight: 600; color: var(--brown-600); background: var(--brown-50); padding: 1px 8px; border-radius: 999px; }

.picker-search { margin-bottom: 6px; }
.chip-picker { display: flex; flex-wrap: wrap; gap: 6px; padding: var(--space-2); border: 1px solid var(--gray-200); border-radius: var(--radius-md); background: var(--gray-50); }
.chip-picker--scroll { max-height: 180px; overflow-y: auto; }
.chip-toggle { padding: 4px 10px; font-size: 13px; font-weight: 600; border-radius: 999px; border: 1px solid var(--gray-300); background: var(--white); color: var(--gray-700); cursor: pointer; transition: all var(--transition-fast); }
.chip-toggle:hover { border-color: var(--brown-400); color: var(--brown-700); }
.chip-toggle.active { background: var(--brown-600); color: var(--white); border-color: var(--brown-600); }

.chi-tiet-row { display: grid; grid-template-columns: 1fr 140px 32px; gap: 6px; align-items: center; margin-top: 6px; }
.ct-vt { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.ct-lieu { }
</style>
