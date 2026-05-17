<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '@/services/api'

interface ViThuoc { id: number; ten_vi_thuoc: string }
interface ChuTri { id: number; ten_chu_tri: string }

interface NhomNho {
  id: number
  idNhomLon: number
  ten_nhom: string
  lieu_luong: string | null
  mo_ta: string | null
  thu_tu: number
  viThuocLinks?: { idViThuoc: number; viThuoc?: ViThuoc }[]
  chuTriLinks?: { idChuTri: number; chuTri?: ChuTri }[]
}

interface NhomLon {
  id: number
  ten_nhom: string
  mo_ta: string | null
  thu_tu: number
  nhomNhoList?: NhomNho[]
}

const isLoading = ref(true)
const error = ref<string | null>(null)

const nhomLonList = ref<NhomLon[]>([])
const viThuocCatalog = ref<ViThuoc[]>([])
const chuTriCatalog = ref<ChuTri[]>([])

const selectedNhomLonId = ref<number | null>(null)
const selectedNhomLon = computed(
  () => nhomLonList.value.find((n) => n.id === selectedNhomLonId.value) || null,
)

// ── Modals state ───────────────────────────────────────────────
const showNhomLonModal = ref(false)
const editingNhomLon = ref<NhomLon | null>(null)
const nhomLonForm = ref({ ten_nhom: '', mo_ta: '', thu_tu: 0 })

const showNhomNhoModal = ref(false)
const editingNhomNho = ref<NhomNho | null>(null)
const nhomNhoForm = ref({
  ten_nhom: '',
  lieu_luong: '',
  mo_ta: '',
  thu_tu: 0,
  vi_thuoc_ids: [] as number[],
  chu_tri_ids: [] as number[],
})

const viThuocFilter = ref('')
const chuTriFilter = ref('')

const filteredViThuoc = computed(() => {
  const q = viThuocFilter.value.trim().toLowerCase()
  const selected = new Set(nhomNhoForm.value.vi_thuoc_ids)
  return viThuocCatalog.value
    .filter((v) => !selected.has(v.id))
    .filter((v) => !q || v.ten_vi_thuoc.toLowerCase().includes(q))
    .slice(0, 20)
})

const filteredChuTri = computed(() => {
  const q = chuTriFilter.value.trim().toLowerCase()
  const selected = new Set(nhomNhoForm.value.chu_tri_ids)
  return chuTriCatalog.value
    .filter((c) => !selected.has(c.id))
    .filter((c) => !q || c.ten_chu_tri.toLowerCase().includes(q))
    .slice(0, 20)
})

function viThuocName(id: number): string {
  return viThuocCatalog.value.find((v) => v.id === id)?.ten_vi_thuoc || `#${id}`
}
function chuTriName(id: number): string {
  return chuTriCatalog.value.find((c) => c.id === id)?.ten_chu_tri || `#${id}`
}

onMounted(fetchAll)

async function fetchAll() {
  isLoading.value = true
  error.value = null
  try {
    const [nhomLonRes, viThuocRes, chuTriRes] = await Promise.all([
      api.get<NhomLon[] | { data: NhomLon[] }>('/nhom-lon-duoc-ly'),
      api.get<ViThuoc[] | { data: ViThuoc[] }>('/vi-thuoc'),
      api.get<ChuTri[] | { data: ChuTri[] }>('/chu-tri'),
    ])
    nhomLonList.value = Array.isArray(nhomLonRes) ? nhomLonRes : (nhomLonRes.data ?? [])
    viThuocCatalog.value = Array.isArray(viThuocRes) ? viThuocRes : (viThuocRes.data ?? [])
    chuTriCatalog.value = Array.isArray(chuTriRes) ? chuTriRes : (chuTriRes.data ?? [])
    if (!selectedNhomLonId.value && nhomLonList.value.length) {
      selectedNhomLonId.value = nhomLonList.value[0].id
    }
  } catch (err: any) {
    error.value = 'Lỗi khi tải dữ liệu: ' + err.message
  } finally {
    isLoading.value = false
  }
}

// ── Nhóm lớn CRUD ──────────────────────────────────────────────
function openCreateNhomLon() {
  editingNhomLon.value = null
  nhomLonForm.value = { ten_nhom: '', mo_ta: '', thu_tu: 0 }
  showNhomLonModal.value = true
}

function openEditNhomLon(nl: NhomLon) {
  editingNhomLon.value = nl
  nhomLonForm.value = {
    ten_nhom: nl.ten_nhom,
    mo_ta: nl.mo_ta ?? '',
    thu_tu: nl.thu_tu,
  }
  showNhomLonModal.value = true
}

async function saveNhomLon() {
  if (!nhomLonForm.value.ten_nhom.trim()) {
    alert('Vui lòng nhập tên nhóm lớn')
    return
  }
  try {
    const body = {
      ten_nhom: nhomLonForm.value.ten_nhom.trim(),
      mo_ta: nhomLonForm.value.mo_ta.trim() || null,
      thu_tu: Number(nhomLonForm.value.thu_tu) || 0,
    }
    if (editingNhomLon.value) {
      await api.put(`/nhom-lon-duoc-ly/${editingNhomLon.value.id}`, body)
    } else {
      const res: any = await api.post('/nhom-lon-duoc-ly', body)
      const newId = res?.id ?? res?.data?.id
      if (newId) selectedNhomLonId.value = newId
    }
    showNhomLonModal.value = false
    await fetchAll()
  } catch (err: any) {
    alert('Lưu thất bại: ' + err.message)
  }
}

async function deleteNhomLon(nl: NhomLon) {
  if (!confirm(`Xóa nhóm lớn «${nl.ten_nhom}»? Tất cả nhóm nhỏ thuộc nhóm này cũng bị xóa.`)) return
  try {
    await api.delete(`/nhom-lon-duoc-ly/${nl.id}`)
    if (selectedNhomLonId.value === nl.id) selectedNhomLonId.value = null
    await fetchAll()
  } catch (err: any) {
    alert('Xóa thất bại: ' + err.message)
  }
}

// ── Nhóm nhỏ CRUD ──────────────────────────────────────────────
function openCreateNhomNho() {
  if (!selectedNhomLonId.value) {
    alert('Chọn 1 nhóm lớn trước')
    return
  }
  editingNhomNho.value = null
  nhomNhoForm.value = {
    ten_nhom: '',
    lieu_luong: '',
    mo_ta: '',
    thu_tu: 0,
    vi_thuoc_ids: [],
    chu_tri_ids: [],
  }
  viThuocFilter.value = ''
  chuTriFilter.value = ''
  showNhomNhoModal.value = true
}

function openEditNhomNho(nn: NhomNho) {
  editingNhomNho.value = nn
  nhomNhoForm.value = {
    ten_nhom: nn.ten_nhom,
    lieu_luong: nn.lieu_luong ?? '',
    mo_ta: nn.mo_ta ?? '',
    thu_tu: nn.thu_tu,
    vi_thuoc_ids: (nn.viThuocLinks ?? []).map((l) => l.idViThuoc),
    chu_tri_ids: (nn.chuTriLinks ?? []).map((l) => l.idChuTri),
  }
  viThuocFilter.value = ''
  chuTriFilter.value = ''
  showNhomNhoModal.value = true
}

async function saveNhomNho() {
  if (!nhomNhoForm.value.ten_nhom.trim()) {
    alert('Vui lòng nhập tên nhóm nhỏ')
    return
  }
  if (!selectedNhomLonId.value) return
  try {
    const body = {
      id_nhom_lon: selectedNhomLonId.value,
      ten_nhom: nhomNhoForm.value.ten_nhom.trim(),
      lieu_luong: nhomNhoForm.value.lieu_luong.trim() || null,
      mo_ta: nhomNhoForm.value.mo_ta.trim() || null,
      thu_tu: Number(nhomNhoForm.value.thu_tu) || 0,
      vi_thuoc_ids: nhomNhoForm.value.vi_thuoc_ids,
      chu_tri_ids: nhomNhoForm.value.chu_tri_ids,
    }
    if (editingNhomNho.value) {
      await api.put(`/nhom-nho-duoc-ly/${editingNhomNho.value.id}`, body)
    } else {
      await api.post('/nhom-nho-duoc-ly', body)
    }
    showNhomNhoModal.value = false
    await fetchAll()
  } catch (err: any) {
    alert('Lưu thất bại: ' + err.message)
  }
}

async function deleteNhomNho(nn: NhomNho) {
  if (!confirm(`Xóa nhóm nhỏ «${nn.ten_nhom}»?`)) return
  try {
    await api.delete(`/nhom-nho-duoc-ly/${nn.id}`)
    await fetchAll()
  } catch (err: any) {
    alert('Xóa thất bại: ' + err.message)
  }
}

function addViThuoc(id: number) {
  if (!nhomNhoForm.value.vi_thuoc_ids.includes(id)) {
    nhomNhoForm.value.vi_thuoc_ids.push(id)
  }
  viThuocFilter.value = ''
}
function removeViThuoc(id: number) {
  nhomNhoForm.value.vi_thuoc_ids = nhomNhoForm.value.vi_thuoc_ids.filter((x) => x !== id)
}
function addChuTri(id: number) {
  if (!nhomNhoForm.value.chu_tri_ids.includes(id)) {
    nhomNhoForm.value.chu_tri_ids.push(id)
  }
  chuTriFilter.value = ''
}
function removeChuTri(id: number) {
  nhomNhoForm.value.chu_tri_ids = nhomNhoForm.value.chu_tri_ids.filter((x) => x !== id)
}
</script>

<template>
  <div class="duoc-ly-wrapper">
    <div v-if="isLoading" class="loading-state"><div class="spinner"></div><p>Đang tải...</p></div>
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button class="btn-secondary mt-4" @click="fetchAll">Thử lại</button>
    </div>

    <div v-else class="duoc-ly-grid">
      <!-- Cột trái: Nhóm lớn -->
      <aside class="nhom-lon-pane">
        <div class="pane-header">
          <div class="pane-title-row">
            <h3>Nhóm lớn</h3>
            <span class="badge">{{ nhomLonList.length }}</span>
          </div>
          <button class="btn-primary sm" @click="openCreateNhomLon">+ Nhóm lớn</button>
        </div>
        <ul class="nhom-lon-list">
          <li v-if="!nhomLonList.length" class="empty">Chưa có nhóm lớn</li>
          <li
            v-for="nl in nhomLonList"
            :key="nl.id"
            class="nhom-lon-item"
            :class="{ active: nl.id === selectedNhomLonId }"
            @click="selectedNhomLonId = nl.id"
          >
            <div class="nhom-lon-name">{{ nl.ten_nhom }}</div>
            <div class="nhom-lon-meta">{{ nl.nhomNhoList?.length || 0 }} nhóm nhỏ</div>
            <div class="row-actions">
              <button class="icon-btn" title="Sửa" @click.stop="openEditNhomLon(nl)">✎</button>
              <button class="icon-btn danger" title="Xóa" @click.stop="deleteNhomLon(nl)">×</button>
            </div>
          </li>
        </ul>
      </aside>

      <!-- Cột phải: Nhóm nhỏ thuộc nhóm lớn được chọn -->
      <section class="nhom-nho-pane">
        <div class="pane-header">
          <div>
            <h3>{{ selectedNhomLon ? selectedNhomLon.ten_nhom : 'Chọn 1 nhóm lớn' }}</h3>
            <p v-if="selectedNhomLon?.mo_ta" class="pane-subtitle">{{ selectedNhomLon.mo_ta }}</p>
          </div>
          <button v-if="selectedNhomLon" class="btn-primary sm" @click="openCreateNhomNho">+ Nhóm nhỏ</button>
        </div>

        <div v-if="!selectedNhomLon" class="empty-state">
          <p>Chọn 1 nhóm lớn ở cột bên trái để xem chi tiết.</p>
        </div>

        <div v-else-if="!selectedNhomLon.nhomNhoList?.length" class="empty-state">
          <p>Chưa có nhóm nhỏ. Nhấn «+ Nhóm nhỏ» để tạo.</p>
        </div>

        <div v-else class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th width="220">Nhóm nhỏ</th>
                <th width="120">Liều lượng</th>
                <th>Vị thuốc</th>
                <th>Chủ trị</th>
                <th width="100"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="nn in selectedNhomLon.nhomNhoList" :key="nn.id">
                <td>
                  <div class="cell-strong">{{ nn.ten_nhom }}</div>
                  <div v-if="nn.mo_ta" class="cell-sub">{{ nn.mo_ta }}</div>
                </td>
                <td>
                  <span v-if="nn.lieu_luong" class="lieu-chip">{{ nn.lieu_luong }}</span>
                  <span v-else class="muted">—</span>
                </td>
                <td>
                  <div class="chip-list">
                    <span v-if="!nn.viThuocLinks?.length" class="muted">—</span>
                    <span v-for="l in nn.viThuocLinks" :key="l.idViThuoc" class="chip chip-vi">
                      {{ l.viThuoc?.ten_vi_thuoc || viThuocName(l.idViThuoc) }}
                    </span>
                  </div>
                </td>
                <td>
                  <div class="chip-list">
                    <span v-if="!nn.chuTriLinks?.length" class="muted">—</span>
                    <span v-for="l in nn.chuTriLinks" :key="l.idChuTri" class="chip chip-ct">
                      {{ l.chuTri?.ten_chu_tri || chuTriName(l.idChuTri) }}
                    </span>
                  </div>
                </td>
                <td class="row-actions">
                  <button class="icon-btn" title="Sửa" @click="openEditNhomNho(nn)">✎</button>
                  <button class="icon-btn danger" title="Xóa" @click="deleteNhomNho(nn)">×</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- Modal: Nhóm lớn -->
    <div v-if="showNhomLonModal" class="modal-backdrop" @click.self="showNhomLonModal = false">
      <div class="modal">
        <header class="modal-header">
          <h3>{{ editingNhomLon ? 'Sửa nhóm lớn' : 'Tạo nhóm lớn' }}</h3>
          <button class="icon-btn" @click="showNhomLonModal = false">×</button>
        </header>
        <div class="modal-body">
          <label class="field">
            <span>Tên nhóm lớn *</span>
            <input v-model="nhomLonForm.ten_nhom" type="text" placeholder="VD: Giải biểu" />
          </label>
          <label class="field">
            <span>Mô tả</span>
            <textarea v-model="nhomLonForm.mo_ta" rows="3" />
          </label>
          <label class="field">
            <span>Thứ tự hiển thị</span>
            <input v-model.number="nhomLonForm.thu_tu" type="number" min="0" />
          </label>
        </div>
        <footer class="modal-footer">
          <button class="btn-secondary" @click="showNhomLonModal = false">Hủy</button>
          <button class="btn-primary" @click="saveNhomLon">Lưu</button>
        </footer>
      </div>
    </div>

    <!-- Modal: Nhóm nhỏ -->
    <div v-if="showNhomNhoModal" class="modal-backdrop" @click.self="showNhomNhoModal = false">
      <div class="modal modal-lg">
        <header class="modal-header">
          <h3>{{ editingNhomNho ? 'Sửa nhóm nhỏ' : 'Tạo nhóm nhỏ' }} – <small>{{ selectedNhomLon?.ten_nhom }}</small></h3>
          <button class="icon-btn" @click="showNhomNhoModal = false">×</button>
        </header>
        <div class="modal-body">
          <div class="grid-2">
            <label class="field">
              <span>Tên nhóm nhỏ *</span>
              <input v-model="nhomNhoForm.ten_nhom" type="text" placeholder="VD: Tân ôn giải biểu" />
            </label>
            <label class="field">
              <span>Liều lượng chung</span>
              <input v-model="nhomNhoForm.lieu_luong" type="text" placeholder="VD: 8-12g" />
            </label>
          </div>
          <label class="field">
            <span>Mô tả</span>
            <textarea v-model="nhomNhoForm.mo_ta" rows="2" />
          </label>
          <label class="field">
            <span>Thứ tự hiển thị</span>
            <input v-model.number="nhomNhoForm.thu_tu" type="number" min="0" />
          </label>

          <!-- Vị thuốc picker -->
          <div class="field">
            <span>Vị thuốc trong nhóm</span>
            <div class="chip-list selected">
              <span v-if="!nhomNhoForm.vi_thuoc_ids.length" class="muted">Chưa chọn vị thuốc nào</span>
              <span v-for="id in nhomNhoForm.vi_thuoc_ids" :key="id" class="chip chip-vi removable">
                {{ viThuocName(id) }}
                <button class="chip-x" @click="removeViThuoc(id)">×</button>
              </span>
            </div>
            <input v-model="viThuocFilter" class="picker-input" type="text" placeholder="Gõ để tìm vị thuốc..." />
            <div v-if="viThuocFilter && filteredViThuoc.length" class="picker-dropdown">
              <button v-for="v in filteredViThuoc" :key="v.id" class="picker-item" @click="addViThuoc(v.id)">
                {{ v.ten_vi_thuoc }}
              </button>
            </div>
          </div>

          <!-- Chủ trị picker -->
          <div class="field">
            <span>Chủ trị</span>
            <div class="chip-list selected">
              <span v-if="!nhomNhoForm.chu_tri_ids.length" class="muted">Chưa chọn chủ trị nào</span>
              <span v-for="id in nhomNhoForm.chu_tri_ids" :key="id" class="chip chip-ct removable">
                {{ chuTriName(id) }}
                <button class="chip-x" @click="removeChuTri(id)">×</button>
              </span>
            </div>
            <input v-model="chuTriFilter" class="picker-input" type="text" placeholder="Gõ để tìm chủ trị..." />
            <div v-if="chuTriFilter && filteredChuTri.length" class="picker-dropdown">
              <button v-for="c in filteredChuTri" :key="c.id" class="picker-item" @click="addChuTri(c.id)">
                {{ c.ten_chu_tri }}
              </button>
            </div>
          </div>
        </div>
        <footer class="modal-footer">
          <button class="btn-secondary" @click="showNhomNhoModal = false">Hủy</button>
          <button class="btn-primary" @click="saveNhomNho">Lưu</button>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.duoc-ly-wrapper { width: 100%; }

/* Layout */
.duoc-ly-grid { display: grid; grid-template-columns: 320px 1fr; gap: var(--space-5); align-items: start; }
@media (max-width: 900px) { .duoc-ly-grid { grid-template-columns: 1fr; } }

.nhom-lon-pane, .nhom-nho-pane { background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-sm); }

.pane-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4) var(--space-5); background: var(--brown-50); border-bottom: 1px solid var(--brown-100); }
.pane-header h3 { font-size: var(--font-size-lg); font-weight: 700; color: var(--brown-900); margin: 0; }
.pane-title-row { display: flex; align-items: center; gap: var(--space-3); }
.pane-subtitle { color: var(--gray-500); font-size: var(--font-size-sm); margin: 4px 0 0; }

/* Nhóm lớn list */
.nhom-lon-list { list-style: none; margin: 0; padding: var(--space-2); display: flex; flex-direction: column; gap: 4px; max-height: 70vh; overflow-y: auto; }
.nhom-lon-list .empty { text-align: center; color: var(--gray-500); padding: var(--space-6); }
.nhom-lon-item { position: relative; padding: 12px 14px; border-radius: var(--radius-md); cursor: pointer; transition: background .15s; }
.nhom-lon-item:hover { background: var(--brown-50); }
.nhom-lon-item.active { background: linear-gradient(135deg, var(--brown-50) 0%, rgba(192,139,66,.12) 100%); }
.nhom-lon-name { font-weight: 600; color: var(--brown-900); }
.nhom-lon-meta { font-size: var(--font-size-xs); color: var(--gray-500); margin-top: 2px; }
.nhom-lon-item .row-actions { position: absolute; right: 10px; top: 10px; opacity: 0; transition: opacity .15s; }
.nhom-lon-item:hover .row-actions, .nhom-lon-item.active .row-actions { opacity: 1; }

/* Table */
.table-responsive { width: 100%; overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: var(--space-3) var(--space-4); text-align: left; border-bottom: 1px solid var(--gray-100); vertical-align: top; }
.data-table th { background: #fdfbf9; font-weight: 600; font-size: var(--font-size-sm); color: var(--gray-500); text-transform: uppercase; letter-spacing: .5px; }
.data-table tbody tr:hover { background: var(--gray-50); }
.cell-strong { font-weight: 700; color: var(--brown-900); }
.cell-sub { font-size: var(--font-size-xs); color: var(--gray-500); margin-top: 2px; }
.muted { color: var(--gray-400); font-size: var(--font-size-sm); }

/* Chips */
.chip-list { display: flex; flex-wrap: wrap; gap: 6px; }
.chip-list.selected { padding: 8px; background: var(--gray-50); border-radius: var(--radius-md); min-height: 40px; margin-bottom: 8px; }
.chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: var(--radius-full); font-size: var(--font-size-xs); font-weight: 600; }
.chip-vi { background: #e0f2fe; color: #075985; }
.chip-ct { background: #fef3c7; color: #b45309; }
.lieu-chip { display: inline-block; padding: 3px 10px; background: var(--brown-100); color: var(--brown-800); border-radius: var(--radius-full); font-size: var(--font-size-xs); font-weight: 700; }
.chip.removable { padding-right: 4px; }
.chip-x { background: rgba(0,0,0,.08); border-radius: 999px; width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; line-height: 1; }
.chip-x:hover { background: rgba(0,0,0,.18); }

/* Picker */
.picker-input { width: 100%; padding: 8px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-md); font-size: var(--font-size-sm); }
.picker-dropdown { margin-top: 4px; max-height: 220px; overflow-y: auto; border: 1px solid var(--gray-200); border-radius: var(--radius-md); background: var(--white); box-shadow: var(--shadow-md); }
.picker-item { display: block; width: 100%; text-align: left; padding: 8px 12px; font-size: var(--font-size-sm); transition: background .12s; }
.picker-item:hover { background: var(--brown-50); }

/* Buttons */
.btn-primary { background: var(--brown-600); color: var(--white); padding: 10px 18px; border-radius: var(--radius-md); font-weight: 600; font-size: var(--font-size-sm); transition: all .2s; }
.btn-primary:hover { background: var(--brown-700); }
.btn-primary.sm { padding: 6px 12px; font-size: var(--font-size-xs); }
.btn-secondary { background: var(--gray-100); color: var(--gray-700); padding: 10px 18px; border-radius: var(--radius-md); font-weight: 600; font-size: var(--font-size-sm); }
.btn-secondary:hover { background: var(--gray-200); }
.icon-btn { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); color: var(--gray-600); font-size: 15px; }
.icon-btn:hover { background: var(--gray-100); color: var(--brown-700); }
.icon-btn.danger:hover { background: #fef2f2; color: var(--danger); }
.row-actions { display: flex; gap: 4px; }

.badge { display: inline-block; padding: 3px 10px; background: var(--brown-100); color: var(--brown-700); border-radius: var(--radius-full); font-size: 11px; font-weight: 700; }

.empty-state { text-align: center; padding: var(--space-12); color: var(--gray-500); }
.loading-state { display: flex; flex-direction: column; align-items: center; padding: var(--space-12) 0; color: var(--brown-600); }
.spinner { width: 32px; height: 32px; border: 3px solid var(--gray-200); border-top-color: var(--brown-500); border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.error-state { text-align: center; padding: var(--space-8); color: var(--danger); background: #fef2f2; border-radius: var(--radius-lg); }

/* Modal */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: var(--space-4); }
.modal { background: var(--white); border-radius: var(--radius-xl); width: 100%; max-width: 480px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--shadow-xl); }
.modal-lg { max-width: 720px; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--gray-200); }
.modal-header h3 { margin: 0; font-size: var(--font-size-lg); color: var(--brown-900); }
.modal-header small { color: var(--gray-500); font-weight: 400; }
.modal-body { padding: var(--space-5); overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-4); }
.modal-footer { display: flex; gap: var(--space-2); justify-content: flex-end; padding: var(--space-4) var(--space-5); border-top: 1px solid var(--gray-200); background: var(--gray-50); }

.field { display: flex; flex-direction: column; gap: 6px; }
.field > span { font-size: var(--font-size-sm); font-weight: 600; color: var(--gray-700); }
.field input, .field textarea { padding: 8px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-md); font-size: var(--font-size-sm); font-family: inherit; }
.field input:focus, .field textarea:focus { outline: none; border-color: var(--brown-400); }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
@media (max-width: 600px) { .grid-2 { grid-template-columns: 1fr; } }
</style>
