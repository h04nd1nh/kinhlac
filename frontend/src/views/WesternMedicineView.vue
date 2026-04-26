<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { api } from '@/services/api'

// Interfaces
interface ChungBenh {
  id: number
  ma_chung_benh: string
  ten_chung_benh: string
  mo_ta: string | null
}

interface BenhTayY {
  id: number
  ten_benh: string
  idChungBenh: number
  chungBenh: ChungBenh | null
  baiThuocList?: any[]
}

const activeTab = ref<'chung-benh' | 'benh-tay-y'>('chung-benh')
const isLoading = ref(true)
const error = ref<string | null>(null)

// Data
const chungBenhList = ref<ChungBenh[]>([])
const benhTayYList = ref<BenhTayY[]>([])

// Pagination state
const currentPage = ref(1)
const itemsPerPage = ref(10)

onMounted(async () => {
  await fetchData()
})

async function fetchData() {
  isLoading.value = true
  error.value = null
  try {
    const [cbRes, btyRes] = await Promise.all([
      api.get<any>('/chung-benh'),
      api.get<any>('/benh-tay-y')
    ])
    
    chungBenhList.value = Array.isArray(cbRes) ? cbRes : (cbRes.data || [])
    benhTayYList.value = Array.isArray(btyRes) ? btyRes : (btyRes.data || [])
    
  } catch (err: any) {
    console.error(err)
    error.value = 'Lỗi khi tải dữ liệu: ' + err.message
  } finally {
    isLoading.value = false
  }
}

const chungBenhMap = computed(() => {
  return chungBenhList.value.reduce((acc, cb) => {
    acc[cb.id] = cb
    return acc
  }, {} as Record<number, ChungBenh>)
})

// Flattened list to show one row per (Disease, Prescription) pair
const flattenedList = computed(() => {
  const result: any[] = []
  benhTayYList.value.forEach(bty => {
    if (!bty.baiThuocList || bty.baiThuocList.length === 0) {
      result.push({
        ...bty,
        currentBaiThuoc: null
      })
    } else {
      bty.baiThuocList.forEach(bt => {
        result.push({
          ...bty,
          currentBaiThuoc: bt
        })
      })
    }
  })
  return result
})

// Paged list for display
const pagedList = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return flattenedList.value.slice(start, end)
})

const totalPages = computed(() => Math.ceil(flattenedList.value.length / itemsPerPage.value))

const pageNumbers = computed(() => {
  const pages: number[] = []
  const tp = totalPages.value
  const cp = currentPage.value
  const start = Math.max(1, cp - 2)
  const end = Math.min(tp, cp + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

function setPage(p: number) {
  if (p >= 1 && p <= totalPages.value) {
    currentPage.value = p
    const table = document.querySelector('.data-card')
    if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function getPhapTriNames(bt: any) {
  if (!bt || !bt.phapTriLinks) return '—'
  return bt.phapTriLinks.map((link: any) => link.phapTri?.ten_phap_tri).filter(Boolean).join(', ') || '—'
}

function getThietChanNames(bty: any) {
  if (!bty.thietChanList) return '—'
  return bty.thietChanList.map((tc: any) => tc.ten_thiet_chan).join(', ') || '—'
}

function getMachChanNames(bty: any) {
  if (!bty.machChanList) return '—'
  return bty.machChanList.map((mc: any) => mc.ten_mach_chan).join(', ') || '—'
}
</script>

<template>
  <div class="western-medicine-page">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">Quản Lý Bệnh Tây Y</h1>
        <p class="page-subtitle">Quản lý hệ thống phân loại chủng bệnh và bệnh lý tây y</p>
      </div>
      <div class="view-toggle">
        <button class="toggle-btn" :class="{ active: activeTab === 'chung-benh' }" @click="activeTab = 'chung-benh'">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7" /></svg>
          Chủng Bệnh
        </button>
        <button class="toggle-btn" :class="{ active: activeTab === 'benh-tay-y' }" @click="activeTab = 'benh-tay-y'">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
          Bệnh Tây Y
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
      <!-- TAB CHỦNG BỆNH -->
      <div v-if="activeTab === 'chung-benh'" class="tab-content">
        <div class="data-card">
          <div class="card-header">
            <h3>Danh sách Chủng Bệnh</h3>
            <span class="badge badge-info">{{ chungBenhList.length }} chủng bệnh</span>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th width="80">ID</th>
                  <th width="200">Mã Chủng Bệnh</th>
                  <th>Tên Chủng Bệnh</th>
                  <th>Mô tả</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="chungBenhList.length === 0">
                  <td colspan="4" class="text-center py-8 text-gray-500">Chưa có dữ liệu chủng bệnh</td>
                </tr>
                <tr v-for="cb in chungBenhList" :key="cb.id">
                  <td>#{{ cb.id }}</td>
                  <td class="font-medium text-brown-700">{{ cb.ma_chung_benh }}</td>
                  <td class="font-bold">{{ cb.ten_chung_benh }}</td>
                  <td class="text-gray-600">{{ cb.mo_ta || 'Không có mô tả' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- TAB BỆNH TÂY Y -->
      <div v-else class="tab-content">
        <div class="data-card">
          <div class="card-header">
            <h3>Danh sách Bệnh Tây Y</h3>
            <span class="badge badge-success">{{ benhTayYList.length }} bệnh</span>
          </div>
          <div class="table-responsive">
            <table class="data-table data-table--full">
              <thead>
                <tr>
                  <th width="150">Tên Bệnh</th>
                  <th width="140">Chủng Bệnh</th>
                  <th width="150">Bài Thuốc</th>
                  <th width="150">Pháp Trị</th>
                  <th width="150">Thể Bệnh</th>
                  <th width="200">Triệu Chứng</th>
                  <th width="120">Thiệt Chẩn</th>
                  <th width="120">Mạch Chẩn</th>
                  <th class="text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="pagedList.length === 0">
                  <td colspan="9" class="text-center py-8 text-gray-500">Chưa có dữ liệu bệnh tây y</td>
                </tr>
                <tr v-for="(row, idx) in pagedList" :key="idx">
                  <td class="font-bold text-brown-900">{{ row.ten_benh }}</td>
                  <td>
                    <span class="chung-benh-badge" v-if="row.chungBenh || chungBenhMap[row.idChungBenh]">
                      {{ row.chungBenh?.ten_chung_benh || chungBenhMap[row.idChungBenh]?.ten_chung_benh }}
                    </span>
                    <span class="text-gray-400 italic" v-else>Chưa phân loại</span>
                  </td>
                  <td class="font-medium text-brown-700">{{ row.currentBaiThuoc?.ten_bai_thuoc || '—' }}</td>
                  <td class="text-gray-600 small-text">{{ getPhapTriNames(row.currentBaiThuoc) }}</td>
                  <td class="text-gray-600 small-text">{{ row.currentBaiThuoc?.the_benh || '—' }}</td>
                  <td class="text-gray-600 small-text trieu-chung-cell">{{ row.currentBaiThuoc?.trieu_chung || '—' }}</td>
                  <td class="text-gray-600 small-text">{{ getThietChanNames(row) }}</td>
                  <td class="text-gray-600 small-text">{{ getMachChanNames(row) }}</td>
                  <td class="text-right">
                    <button class="btn-action">Phân tu</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="pagination">
            <button class="page-btn" :disabled="currentPage <= 1" @click="setPage(currentPage - 1)">‹</button>
            <button v-for="pn in pageNumbers" :key="pn" class="page-btn" :class="{ active: pn === currentPage }" @click="setPage(pn)">{{ pn }}</button>
            <button class="page-btn" :disabled="currentPage >= totalPages" @click="setPage(currentPage + 1)">›</button>
            <span class="page-info">Trang {{ currentPage }} / {{ totalPages }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.western-medicine-page { width: 100%; animation: fadeIn 0.4s ease; }
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
.data-card { background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-sm); margin-bottom: var(--space-6); }
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

/* Table Expansions */
.data-table--full { min-width: 1200px; }
.small-text { font-size: var(--font-size-xs) !important; line-height: 1.4; }
.trieu-chung-cell { max-width: 250px; white-space: normal; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

/* Utils */
.text-right { text-align: right !important; }
.text-center { text-align: center !important; }
.py-8 { padding-top: 2rem !important; padding-bottom: 2rem !important; }
.font-bold { font-weight: 700 !important; }
.font-medium { font-weight: 600 !important; }
.text-brown-700 { color: var(--brown-700) !important; }
.text-brown-900 { color: var(--brown-900) !important; }
.text-gray-600 { color: var(--gray-600) !important; }
.text-gray-500 { color: var(--gray-500) !important; }
.text-gray-400 { color: var(--gray-400) !important; }
.italic { font-style: italic !important; }

/* Badges */
.badge { display: inline-block; padding: 4px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.badge-info { background: #e0f2fe; color: #0369a1; }
.badge-success { background: #d1fae5; color: #059669; }

.chung-benh-badge { display: inline-block; padding: 4px 10px; background: var(--brown-100); color: var(--brown-700); border-radius: var(--radius-md); font-size: var(--font-size-sm); font-weight: 600; }

/* Pagination */
.pagination { display: flex; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-4); background: var(--gray-50); border-top: 1px solid var(--gray-100); }
.page-btn { min-width: 32px; height: 32px; padding: 0 8px; display: flex; align-items: center; justify-content: center; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); font-size: var(--font-size-sm); font-weight: 600; color: var(--gray-600); cursor: pointer; transition: all var(--transition-fast); }
.page-btn:hover:not(:disabled) { border-color: var(--brown-400); color: var(--brown-700); background: var(--brown-50); }
.page-btn.active { background: var(--brown-600); border-color: var(--brown-600); color: var(--white); }
.page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { margin-left: var(--space-4); font-size: var(--font-size-xs); color: var(--gray-500); font-weight: 600; }

/* Actions */
.btn-action { padding: 6px 16px; background: var(--brown-600); color: var(--white); border: none; border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 700; cursor: pointer; transition: all var(--transition-fast); text-transform: uppercase; letter-spacing: 0.5px; }
.btn-action:hover { background: var(--brown-700); transform: translateY(-1px); box-shadow: var(--shadow-sm); }

.loading-state { display: flex; flex-direction: column; align-items: center; padding: var(--space-12) 0; color: var(--brown-600); }
.spinner { width: 32px; height: 32px; border: 3px solid var(--gray-200); border-top-color: var(--brown-500); border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.error-state { text-align: center; padding: var(--space-8); color: var(--danger); background: #fef2f2; border-radius: var(--radius-lg); }
</style>
