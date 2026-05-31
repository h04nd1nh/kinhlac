<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { api } from '@/services/api'

interface Symptom {
  id: number
  ten_trieu_chung: string
}

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

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(10)

onMounted(async () => {
  await fetchData()
})

async function fetchData() {
  isLoading.value = true
  error.value = null
  try {
    const res: any = await api.get('/trieu-chung')
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

const pagedList = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return dataList.value.slice(start, start + itemsPerPage.value)
})

const totalPages = computed(() => Math.ceil(dataList.value.length / itemsPerPage.value))

function getPageNumbers() {
  const pages: number[] = []
  const start = Math.max(1, currentPage.value - 2)
  const end = Math.min(totalPages.value, currentPage.value + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
}
</script>

<template>
  <div class="management-page">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">Quản Lý Triệu Chứng</h1>
        <p class="page-subtitle">Danh sách phân loại các triệu chứng lâm sàng</p>
      </div>
      <button class="btn-primary" @click="openCreateModal">+ Thêm mới</button>
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
      <div class="data-card">
        <div class="card-header">
          <h3>Danh sách Triệu Chứng</h3>
          <span class="badge badge-warning">{{ dataList.length }} triệu chứng</span>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th width="80">ID</th>
                <th>Tên Triệu Chứng</th>
                <th width="140">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="pagedList.length === 0">
                <td colspan="3" class="text-center py-8 text-gray-500">Chưa có dữ liệu</td>
              </tr>
              <tr v-for="item in pagedList" :key="item.id">
                <td>#{{ item.id }}</td>
                <td class="font-bold text-brown-900">{{ item.ten_trieu_chung }}</td>
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

.data-card { background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-sm); margin-bottom: var(--space-6); }
.card-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-5); background: var(--brown-50); border-bottom: 1px solid var(--brown-100); }
.card-header h3 { font-size: var(--font-size-lg); font-weight: 700; color: var(--brown-900); margin: 0; }

.table-responsive { width: 100%; overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: var(--space-3) var(--space-5); text-align: left; border-bottom: 1px solid var(--gray-100); }
.data-table th { background: #fdfbf9; font-weight: 600; font-size: var(--font-size-sm); color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.5px; }
.data-table tbody tr { transition: background 0.2s; }
.data-table tbody tr:hover { background: var(--gray-50); }
.data-table td { font-size: var(--font-size-md); color: var(--gray-800); vertical-align: middle; }

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
</style>
