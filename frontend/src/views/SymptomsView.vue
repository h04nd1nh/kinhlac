<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/services/api'

interface Symptom {
  id: number
  ma_trieu_chung: string
  ten_trieu_chung: string
  mo_ta: string | null
}

const isLoading = ref(true)
const error = ref<string | null>(null)
const dataList = ref<Symptom[]>([])

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
</script>

<template>
  <div class="management-page">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">Quản Lý Triệu Chứng</h1>
        <p class="page-subtitle">Danh sách phân loại các triệu chứng lâm sàng</p>
      </div>
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
                <th width="150">Mã</th>
                <th width="250">Tên Triệu Chứng</th>
                <th>Mô Tả</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="dataList.length === 0">
                <td colspan="4" class="text-center py-8 text-gray-500">Chưa có dữ liệu</td>
              </tr>
              <tr v-for="item in dataList" :key="item.id">
                <td>#{{ item.id }}</td>
                <td class="font-medium text-brown-700">{{ item.ma_trieu_chung }}</td>
                <td class="font-bold text-brown-900">{{ item.ten_trieu_chung }}</td>
                <td class="text-gray-600">{{ item.mo_ta || 'Không có mô tả' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.management-page { animation: fadeIn 0.4s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: var(--space-6); padding-bottom: var(--space-4); border-bottom: 2px solid var(--brown-100); }
.page-title { font-size: var(--font-size-2xl); font-weight: 800; color: var(--brown-800); margin-bottom: var(--space-1); }
.page-subtitle { color: var(--gray-500); font-size: var(--font-size-md); }

.data-card { background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-sm); }
.card-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-5); background: var(--brown-50); border-bottom: 1px solid var(--brown-100); }
.card-header h3 { font-size: var(--font-size-lg); font-weight: 700; color: var(--brown-900); margin: 0; }

.table-responsive { width: 100%; overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: var(--space-3) var(--space-5); text-align: left; border-bottom: 1px solid var(--gray-100); }
.data-table th { background: #fdfbf9; font-weight: 600; font-size: var(--font-size-sm); color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.5px; }
.data-table tbody tr { transition: background 0.2s; }
.data-table tbody tr:hover { background: var(--gray-50); }
.data-table td { font-size: var(--font-size-md); color: var(--gray-800); vertical-align: middle; }

.text-center { text-align: center !important; }
.py-8 { padding-top: 2rem !important; padding-bottom: 2rem !important; }
.font-bold { font-weight: 700 !important; }
.font-medium { font-weight: 600 !important; }
.text-brown-700 { color: var(--brown-700) !important; }
.text-brown-900 { color: var(--brown-900) !important; }
.text-gray-600 { color: var(--gray-600) !important; }
.text-gray-500 { color: var(--gray-500) !important; }

.badge { display: inline-block; padding: 4px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.badge-warning { background: #fef3c7; color: #b45309; }

.loading-state { display: flex; flex-direction: column; align-items: center; padding: var(--space-12) 0; color: var(--brown-600); }
.error-state { text-align: center; padding: var(--space-8); color: var(--danger); background: #fef2f2; border-radius: var(--radius-lg); }
</style>
