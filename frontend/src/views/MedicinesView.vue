<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/services/api'

interface BaiThuoc {
  id: number
  ten_bai_thuoc: string
  cach_dung: string | null
  cong_dung_chinh: string | null
}

interface ViThuoc {
  id: number
  ten_vi_thuoc: string
  tinh_vi: string | null
  quy_kinh: string | null
}

const activeTab = ref<'bai-thuoc' | 'vi-thuoc'>('bai-thuoc')
const isLoading = ref(true)
const error = ref<string | null>(null)

const baiThuocList = ref<BaiThuoc[]>([])
const viThuocList = ref<ViThuoc[]>([])

onMounted(async () => {
  await fetchData()
})

async function fetchData() {
  isLoading.value = true
  error.value = null
  try {
    const [btRes, vtRes] = await Promise.all([
      api.get<any>('/bai-thuoc'),
      api.get<any>('/vi-thuoc')
    ])
    
    baiThuocList.value = Array.isArray(btRes) ? btRes : (btRes.data || [])
    viThuocList.value = Array.isArray(vtRes) ? vtRes : (vtRes.data || [])
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
        <h1 class="page-title">Quản Lý Thuốc</h1>
        <p class="page-subtitle">Quản lý hệ thống các bài thuốc và vị thuốc Đông Y</p>
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
      <!-- TAB BÀI THUỐC -->
      <div v-if="activeTab === 'bai-thuoc'" class="tab-content">
        <div class="data-card">
          <div class="card-header">
            <h3>Danh sách Bài Thuốc</h3>
            <span class="badge badge-info">{{ baiThuocList.length }} bài thuốc</span>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th width="80">ID</th>
                  <th width="250">Tên Bài Thuốc</th>
                  <th>Cách Dùng</th>
                  <th>Công Dụng Chính</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="baiThuocList.length === 0">
                  <td colspan="4" class="text-center py-8 text-gray-500">Chưa có dữ liệu bài thuốc</td>
                </tr>
                <tr v-for="bt in baiThuocList" :key="bt.id">
                  <td>#{{ bt.id }}</td>
                  <td class="font-bold text-brown-900">{{ bt.ten_bai_thuoc }}</td>
                  <td class="text-gray-600">{{ bt.cach_dung || '—' }}</td>
                  <td class="text-gray-600">{{ bt.cong_dung_chinh || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- TAB VỊ THUỐC -->
      <div v-else class="tab-content">
        <div class="data-card">
          <div class="card-header">
            <h3>Danh sách Vị Thuốc</h3>
            <span class="badge badge-success">{{ viThuocList.length }} vị thuốc</span>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th width="80">ID</th>
                  <th width="250">Tên Vị Thuốc</th>
                  <th>Tính Vị</th>
                  <th>Quy Kinh</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="viThuocList.length === 0">
                  <td colspan="4" class="text-center py-8 text-gray-500">Chưa có dữ liệu vị thuốc</td>
                </tr>
                <tr v-for="vt in viThuocList" :key="vt.id">
                  <td>#{{ vt.id }}</td>
                  <td class="font-bold text-brown-900">{{ vt.ten_vi_thuoc }}</td>
                  <td class="text-gray-600">{{ vt.tinh_vi || '—' }}</td>
                  <td class="text-gray-600">{{ vt.quy_kinh || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.management-page { animation: fadeIn 0.4s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* Header */
.page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: var(--space-6); padding-bottom: var(--space-4); border-bottom: 2px solid var(--brown-100); }
.page-title { font-size: var(--font-size-2xl); font-weight: 800; color: var(--brown-800); margin-bottom: var(--space-1); }
.page-subtitle { color: var(--gray-500); font-size: var(--font-size-md); }

/* Toggle */
.view-toggle { display: flex; background: var(--white); padding: 4px; border-radius: var(--radius-lg); border: 1px solid var(--brown-200); box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.toggle-btn { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-weight: 600; font-size: var(--font-size-sm); color: var(--gray-600); transition: all var(--transition-base); }
.toggle-btn:hover { color: var(--brown-600); }
.toggle-btn.active { background: var(--brown-600); color: var(--white); box-shadow: 0 2px 4px rgba(161, 98, 7, 0.2); }

/* Content */
.data-card { background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-sm); }
.card-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-5); background: var(--brown-50); border-bottom: 1px solid var(--brown-100); }
.card-header h3 { font-size: var(--font-size-lg); font-weight: 700; color: var(--brown-900); margin: 0; }

/* Table */
.table-responsive { width: 100%; overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: var(--space-3) var(--space-5); text-align: left; border-bottom: 1px solid var(--gray-100); }
.data-table th { background: #fdfbf9; font-weight: 600; font-size: var(--font-size-sm); color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.5px; }
.data-table tbody tr { transition: background 0.2s; }
.data-table tbody tr:hover { background: var(--gray-50); }
.data-table td { font-size: var(--font-size-md); color: var(--gray-800); vertical-align: middle; }

/* Utils */
.text-center { text-align: center !important; }
.py-8 { padding-top: 2rem !important; padding-bottom: 2rem !important; }
.font-bold { font-weight: 700 !important; }
.text-brown-900 { color: var(--brown-900) !important; }
.text-gray-600 { color: var(--gray-600) !important; }
.text-gray-500 { color: var(--gray-500) !important; }

/* Badges */
.badge { display: inline-block; padding: 4px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.badge-info { background: #e0f2fe; color: #0369a1; }
.badge-success { background: #d1fae5; color: #059669; }

.loading-state { display: flex; flex-direction: column; align-items: center; padding: var(--space-12) 0; color: var(--brown-600); }
.error-state { text-align: center; padding: var(--space-8); color: var(--danger); background: #fef2f2; border-radius: var(--radius-lg); }
</style>
