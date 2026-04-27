<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePatientStore, type Patient } from '@/stores/patient'
import { api } from '@/services/api'

const router = useRouter()
const route = useRoute()

const patientId = computed(() => Number(route.params.patientId))
const examId = computed(() => Number(route.params.examId))
const patient = ref<Patient | null>(null)
const examination = ref<any>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const syndromesList = computed(() => {
  return examination.value?.syndromes || []
})

const examDisplay = computed(() => {
  if (!examination.value) return {
    ticketNumber: '#' + examId.value,
    date: '—',
    time: '—',
    doctor: '—',
    symptoms: '—',
    conclusion: '—',
    treatment: '—',
    advices: []
  }
  
  const d = new Date(examination.value.createdAt)
  const synds = examination.value.syndromes || []
  const mainSynd = synds.length > 0 ? synds[0] : null
  
  // Extract advice string into array if it exists
  const rawAdvice = mainSynd?.loi_khuyen || ''
  const adviceList = rawAdvice ? rawAdvice.split('\n').filter(Boolean) : []

  return {
    ticketNumber: '#' + examination.value.id,
    date: d.toLocaleDateString('vi-VN'),
    time: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    doctor: '',
    symptoms: examination.value.notes || '',
    conclusion: mainSynd?.syndrome_name || '',
    treatment: mainSynd?.phap_tri || '',
    advices: adviceList
  }
})

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function calculateBounds(dataArr: any[]) {
  const allVals = dataArr.flatMap(d => [d.left, d.right]).filter(v => v > 0)
  if (!allVals.length) return { max: 0, min: 0, range: 0, mean: 0, sd: 0, upperBound: 0, lowerBound: 0 }
  
  const maxVal = Math.max(...allVals)
  const minVal = Math.min(...allVals)
  const range = maxVal - minVal
  
  // Trong phương pháp Lê Văn Sửu (theo Excel), trị số bình quân dùng (Max + Min) / 2
  const midPoint = round2((maxVal + minVal) / 2.0)
  const dungSai = round2(range / 6.0)
  
  return {
    max: maxVal,
    min: minVal,
    range: range,
    mean: midPoint, 
    sd: dungSai, 
    upperBound: round2(midPoint + dungSai),
    lowerBound: round2(midPoint - dungSai)
  }
}

const rawUpper = computed(() => {
  if (!examination.value?.inputData) return []
  const d = examination.value.inputData
  return [
    { name: 'Tiểu', left: d.tieutruongtrai || 0, right: d.tieutruongphai || 0 },
    { name: 'Tâm', left: d.tamtrai || 0, right: d.tamphai || 0 },
    { name: 'Tam', left: d.tamtieutrai || 0, right: d.tamtieuphai || 0 },
    { name: 'Bào', left: d.tambaotrai || 0, right: d.tambaophai || 0 },
    { name: 'Đại', left: d.daitrangtrai || 0, right: d.daitrangphai || 0 },
    { name: 'Phế', left: d.phetrai || 0, right: d.phephai || 0 },
  ]
})

const rawLower = computed(() => {
  if (!examination.value?.inputData) return []
  const d = examination.value.inputData
  return [
    { name: 'Bàng', left: d.bangquangtrai || 0, right: d.bangquangphai || 0 },
    { name: 'Thận', left: d.thantrai || 0, right: d.thanphai || 0 },
    { name: 'Đảm', left: d.damtrai || 0, right: d.damphai || 0 },
    { name: 'Vị', left: d.vitrai || 0, right: d.viphai || 0 },
    { name: 'Can', left: d.cantrai || 0, right: d.canphai || 0 },
    { name: 'Tỳ', left: d.tytrai || 0, right: d.typhai || 0 },
  ]
})

const upperStats = computed(() => calculateBounds(rawUpper.value))
const lowerStats = computed(() => calculateBounds(rawLower.value))

function getSign(val: number, lower: number, upper: number) {
  if (val > upper) return '+'
  if (val < lower) return '-'
  return '0'
}

function processRows(data: any[], stats: any) {
  return data.map(item => {
    const avg = round2((item.left + item.right) / 2)
    const diff = round2(avg - stats.mean)
    const absDiff = round2(Math.abs(item.left - item.right))
    return {
      ...item,
      leftSign: getSign(item.left, stats.lowerBound, stats.upperBound),
      rightSign: getSign(item.right, stats.lowerBound, stats.upperBound),
      avg,
      diff,
      absDiff
    }
  })
}

const upperRows = computed(() => processRows(rawUpper.value, upperStats.value))
const lowerRows = computed(() => processRows(rawLower.value, lowerStats.value))

const CHANNELS_FULL = {
  'Tiểu': 'Tiêu trường',
  'Tâm': 'Tâm',
  'Tam': 'Tam tiêu',
  'Bào': 'Tâm bào',
  'Đại': 'Đại tràng',
  'Phế': 'Phế',
  'Bàng': 'Bàng quang',
  'Thận': 'Thận',
  'Đảm': 'Đảm',
  'Vị': 'Vị',
  'Can': 'Can',
  'Tỳ': 'Tỳ'
}

const LY_LIST = ['Tiêu trường', 'Tâm', 'Can', 'Đảm']
const BIEU_LIST = ['Tam tiêu', 'Tâm bào', 'Đại tràng', 'Phế', 'Bàng quang', 'Thận', 'Vị', 'Tỳ']

function getSyndromeList(targetSign: string, channelNames: string[]) {
  const result: string[] = []
  
  channelNames.forEach(fullChName => {
     // Tìm mapping ngược từ tên đầy đủ sang tên ngắn dùng trong logic
     const shortName = Object.keys(CHANNELS_FULL).find(key => CHANNELS_FULL[key as keyof typeof CHANNELS_FULL] === fullChName)
     if (!shortName) return

     const row = upperRows.value.find((r: any) => r.name === shortName) || lowerRows.value.find((r: any) => r.name === shortName)
     if (!row) return
     
     const lMatch = row.leftSign === targetSign
     const rMatch = row.rightSign === targetSign
     
     if (lMatch && rMatch) {
        result.push(fullChName)
     } else if (lMatch) {
        result.push(`${fullChName} trái`)
     } else if (rMatch) {
        result.push(`${fullChName} phải`)
     }
  })
  
  return result.join(', ')
}

const diagnosis = computed(() => {
  if (!examination.value?.inputData) return { amDuong: '—', khi: '—', huyet: '—' }
  
  const lower = lowerStats.value

  // 1. Âm / Dương (Dựa trên kinh Đảm so với trị số bình quân nhóm Chi dưới)
  const d = examination.value.inputData
  const avgDam = round2(((d.damtrai || 0) + (d.damphai || 0)) / 2)
  const midTuc = lower.mean
  const diffAmDuong = round2(avgDam - midTuc)

  let amDuong = 'Bình thường'
  if (diffAmDuong < 0) amDuong = 'Dương hư'
  else if (diffAmDuong > 0) amDuong = 'Âm hư'
  
  // 2. Khí (Dựa trên 6 kinh Chi trên)
  let huTrenCount = 0
  let sumDiffTren = 0
  let allTrenZero = true

  upperRows.value.forEach(r => {
    const diff = round2(r.avg - upperStats.value.mean)
    sumDiffTren += diff
    if (r.avg !== 0) allTrenZero = false
    if (diff < 0) huTrenCount++
  })

  let khi = 'Bình thường'
  if (allTrenZero) {
    khi = ''
  } else {
    if (huTrenCount > 3) khi = 'Khí hư'
    else if (huTrenCount < 3) khi = 'Khí thịnh'
    else {
      if (sumDiffTren < 0) khi = 'Khí hư'
      else if (sumDiffTren > 0) khi = 'Khí thịnh'
      else khi = ''
    }
  }

  // 3. Huyết (Dựa trên 6 kinh Chi dưới)
  let huDuoiCount = 0
  let sumDiffDuoi = 0
  let allDuoiZero = true

  lowerRows.value.forEach(r => {
    const diff = round2(r.avg - lowerStats.value.mean)
    sumDiffDuoi += diff
    if (r.avg !== 0) allDuoiZero = false
    if (diff < 0) huDuoiCount++
  })

  let huyet = 'Bình thường'
  if (allDuoiZero) {
    huyet = ''
  } else {
    if (huDuoiCount > 3) huyet = 'Huyết hư'
    else if (huDuoiCount < 3) huyet = 'Huyết thịnh'
    else {
      if (sumDiffDuoi < 0) huyet = 'Huyết hư'
      else if (sumDiffDuoi > 0) huyet = 'Huyết thịnh'
      else huyet = ''
    }
  }
  
  return { amDuong, khi, huyet }
})

const batCuong = computed(() => {
  return {
    hanBieu: getSyndromeList('-', BIEU_LIST),
    hanLy: getSyndromeList('-', LY_LIST),
    nhietBieu: getSyndromeList('+', BIEU_LIST),
    nhietLy: getSyndromeList('+', LY_LIST),
  }
})

function getSignClass(sign: string) {
  if (sign === '+') return 'text-brown-600 font-bold text-center'
  if (sign === '-') return 'text-blue-600 font-bold text-center'
  return 'text-gray-500 font-bold text-center'
}

function fmt(val: number, decimals: number = 2) {
  return val.toFixed(decimals).replace('.', ',')
}

function getAge(dateStr?: string | null) {
  if (!dateStr) return '—'
  const birthYear = new Date(dateStr).getFullYear()
  const currentYear = new Date().getFullYear()
  const age = currentYear - birthYear
  return isNaN(age) ? '—' : age
}

onMounted(async () => {
  await loadData()
})

async function loadData() {
  isLoading.value = true
  try {
    const [patientRes, examRes] = await Promise.all([
      api.get<Patient>(`/patients/${patientId.value}`),
      api.get<any>(`/examinations/${examId.value}`)
    ])
    patient.value = patientRes
    examination.value = examRes
  } catch (err: any) {
    error.value = err.message
  } finally {
    isLoading.value = false
  }
}

function goBack() {
  router.push({ name: 'patient-detail', params: { id: patientId.value } })
}
</script>

<template>
  <div class="meridian-results-page">
    <!-- Header Area -->
    <div class="page-header">
      <button class="back-btn" @click="goBack">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
        <span>Quay lại hồ sơ</span>
      </button>
      
      <div v-if="patient" class="exam-summary">
        <h1 class="page-title">Kết quả Khám bệnh - {{ examDisplay.ticketNumber }}</h1>
        <div class="exam-meta">
          <span>Bệnh nhân: <strong>{{ patient.fullName }}</strong></span>
          <span class="divider">|</span>
          <span>Ngày khám: {{ examDisplay.date }} {{ examDisplay.time }}</span>
        </div>
      </div>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Đang tải thông tin...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button class="btn-secondary" @click="goBack">Quay lại</button>
    </div>

    <template v-else-if="patient">
      <!-- 65 / 35 Layout -->
      <div class="results-layout">
        
        <!-- Left Column: 65% -->
        <div class="layout-left">
          <section class="result-section">
            <h2 class="section-title">
              <span class="section-num">I</span> KẾT QUẢ ĐO KINH LẠC
            </h2>
            
            <div class="result-card p-0 overflow-hidden">
              <!-- Patient Info Header -->
              <div class="patient-table-header">
                <table class="data-table mb-0">
                  <tbody>
                    <tr>
                      <td class="font-medium text-gray-500 w-24">Họ và tên</td>
                      <td class="font-bold text-brown-800" colspan="2">{{ patient?.fullName }}</td>
                      <td class="font-medium text-gray-500 w-16">Tuổi</td>
                      <td class="font-bold">{{ getAge(patient?.dateOfBirth) }}</td>
                    </tr>
                    <tr>
                      <td class="font-medium text-gray-500">Địa chỉ</td>
                      <td colspan="4">{{ patient?.address || '—' }}</td>
                    </tr>
                    <tr>
                      <td class="font-medium text-gray-500">Giới tính</td>
                      <td colspan="4">{{ patient?.gender || '—' }}</td>
                    </tr>
                    <tr>
                      <td class="font-medium text-gray-500">Thời gian đo</td>
                      <td>{{ examDisplay.date }}</td>
                      <td class="font-medium text-gray-500 text-right pr-4">Huyết áp</td>
                      <td colspan="2">120/90</td>
                    </tr>
                    <tr>
                      <td class="font-medium text-gray-500">Chiều cao</td>
                      <td>—</td>
                      <td class="font-medium text-gray-500 text-right pr-4">Cân nặng <span class="text-black ml-2">—</span></td>
                      <td class="font-medium text-gray-500">BMI</td>
                      <td>—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Chi Trên -->
              <div class="table-section-title">Chi trên</div>
              <div class="stats-summary-row">
                <div class="stat-col"><span class="val max-val">{{ fmt(upperStats.max, 1) }}</span><br/><span class="val min-val">{{ fmt(upperStats.min, 1) }}</span></div>
                <div class="stat-col"><span class="val">{{ fmt(upperStats.range, 1) }}</span><br/><span>&nbsp;</span></div>
                <div class="stat-col"><span class="val bg-gray">{{ fmt(upperStats.mean, 2) }}</span><br/><span>&nbsp;</span></div>
                <div class="stat-col"><span class="val">{{ fmt(upperStats.sd, 2) }}</span><br/><span>&nbsp;</span></div>
                <div class="stat-col"><span class="val text-brown-600">{{ fmt(upperStats.upperBound, 2) }}</span><br/><span class="val text-brown-600">{{ fmt(upperStats.lowerBound, 2) }}</span></div>
              </div>

              <div class="table-responsive">
                <table class="data-table meridian-data-table">
                  <tbody>
                    <tr v-for="(item, idx) in upperRows" :key="'upper-'+idx">
                      <td class="font-bold">{{ item.name }}</td>
                      <td :class="getSignClass(item.leftSign)">{{ item.leftSign }}</td>
                      <td class="font-medium">{{ fmt(item.left, 1) }}</td>
                      <td class="bg-gray">{{ fmt(item.avg, 2) }}</td>
                      <td :class="item.diff > 0 ? 'text-brown-600' : (item.diff < 0 ? 'text-blue-600' : '')">{{ item.diff > 0 ? '+' : '' }}{{ fmt(item.diff, 2) }}</td>
                      <td class="font-medium">{{ fmt(item.right, 1) }}</td>
                      <td :class="getSignClass(item.rightSign)">{{ item.rightSign }}</td>
                      <td>{{ fmt(item.absDiff, 1) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Chi Dưới -->
              <div class="table-section-title">Chi dưới</div>
              <div class="stats-summary-row">
                <div class="stat-col"><span class="val max-val">{{ fmt(lowerStats.max, 1) }}</span><br/><span class="val min-val">{{ fmt(lowerStats.min, 1) }}</span></div>
                <div class="stat-col"><span class="val">{{ fmt(lowerStats.range, 1) }}</span><br/><span>&nbsp;</span></div>
                <div class="stat-col"><span class="val bg-gray">{{ fmt(lowerStats.mean, 2) }}</span><br/><span>&nbsp;</span></div>
                <div class="stat-col"><span class="val">{{ fmt(lowerStats.sd, 2) }}</span><br/><span>&nbsp;</span></div>
                <div class="stat-col"><span class="val text-brown-600">{{ fmt(lowerStats.upperBound, 2) }}</span><br/><span class="val text-brown-600">{{ fmt(lowerStats.lowerBound, 2) }}</span></div>
              </div>

              <div class="table-responsive">
                <table class="data-table meridian-data-table">
                  <tbody>
                    <tr v-for="(item, idx) in lowerRows" :key="'lower-'+idx">
                      <td class="font-bold">{{ item.name }}</td>
                      <td :class="getSignClass(item.leftSign)">{{ item.leftSign }}</td>
                      <td class="font-medium">{{ fmt(item.left, 1) }}</td>
                      <td class="bg-gray">{{ fmt(item.avg, 2) }}</td>
                      <td :class="item.diff > 0 ? 'text-brown-600' : (item.diff < 0 ? 'text-blue-600' : '')">{{ item.diff > 0 ? '+' : '' }}{{ fmt(item.diff, 2) }}</td>
                      <td class="font-medium">{{ fmt(item.right, 1) }}</td>
                      <td :class="getSignClass(item.rightSign)">{{ item.rightSign }}</td>
                      <td>{{ fmt(item.absDiff, 1) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Footer Stats -->
              <div class="table-footer-stat">
                <span>Chênh lệch trung bình chi trên và chi dưới:</span>
                <span class="font-bold text-brown-700 ml-4">{{ fmt(Math.abs(upperStats.mean - lowerStats.mean), 2) }}</span>
              </div>
            </div>
          </section>
        </div>

        <!-- Right Column: 35% -->
        <div class="layout-right">
          
          <section class="result-section">
            <h2 class="section-title">
              <span class="section-num">II</span> KẾT LUẬN BÁT CƯƠNG & CHẨN ĐOÁN
            </h2>
            <div class="result-card p-0">
              <div class="info-group p-5 border-b border-gray-100">
                <h4 class="info-label mb-3">Chẩn Đoán Bát Cương</h4>
                
                <div class="bc-summary-grid">
                  <div class="bc-summary-item">
                    <span class="bc-label">Âm / Dương:</span>
                    <span class="bc-value">{{ diagnosis.amDuong }}</span>
                  </div>
                  <div class="bc-summary-item">
                    <span class="bc-label">Hư / Thực:</span>
                    <span class="bc-value">{{ diagnosis.khi }}, {{ diagnosis.huyet }}</span>
                  </div>
                </div>

                <div class="bc-tieu-ket mt-4">
                  <h4 class="info-label mb-3">Tiểu kết Bát cương</h4>
                  <div class="tieu-ket-list">
                    <div class="tk-item">
                      <span class="tk-label">Lý Hàn:</span>
                      <span class="tk-val">{{ batCuong.hanLy || '—' }}</span>
                    </div>
                    <div class="tk-item">
                      <span class="tk-label">Biểu Hàn:</span>
                      <span class="tk-val">{{ batCuong.hanBieu || '—' }}</span>
                    </div>
                    <div class="tk-item">
                      <span class="tk-label">Biểu Nhiệt:</span>
                      <span class="tk-val">{{ batCuong.nhietBieu || '—' }}</span>
                    </div>
                    <div class="tk-item">
                      <span class="tk-label">Lý Nhiệt:</span>
                      <span class="tk-val">{{ batCuong.nhietLy || '—' }}</span>
                    </div>
                  </div>
                </div>
              </div>
              
            </div>
          </section>

          <section class="result-section mt-6">
            <h2 class="section-title">
              <span class="section-num">III</span> MÔ HÌNH BỆNH LÝ
            </h2>
            <div class="result-card p-5">
              <div class="info-group">
                <h4 class="info-label mb-3">Mô Hình Bệnh Lý</h4>
                <div v-if="syndromesList.length" class="flex flex-col gap-2">
                  <div v-for="(synd, idx) in syndromesList" :key="idx" class="syndrome-tag">
                    <span class="synd-idx">{{ Number(idx) + 1 }}</span>
                    <span class="synd-name">{{ synd.tieuket }}</span>
                    <span v-if="synd.rate" class="synd-rate">{{ Math.round(synd.rate * 100) }}%</span>
                  </div>
                </div>
                <div v-else class="pathology-placeholder">
                  <p>Không có mô hình bệnh lý nào được tìm thấy</p>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.meridian-results-page {
  animation: fadeIn 0.4s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Header */
.page-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-4);
  border-bottom: 2px solid var(--brown-100);
}

.back-btn { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-sm); color: var(--gray-600); font-weight: 500; padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); transition: all var(--transition-fast); align-self: flex-start; }
.back-btn:hover { color: var(--brown-700); background: var(--brown-50); }

.exam-summary { display: flex; flex-direction: column; gap: var(--space-1); }
.page-title { font-size: var(--font-size-2xl); font-weight: 700; color: var(--brown-800); }
.exam-meta { font-size: var(--font-size-sm); color: var(--gray-600); }
.exam-meta strong { color: var(--brown-700); font-weight: 600; }
.divider { margin: 0 var(--space-2); color: var(--gray-300); }

/* Layout 65 / 35 */
.results-layout {
  display: grid;
  grid-template-columns: 65fr 35fr;
  gap: var(--space-6);
  align-items: start;
}

/* Sections */
.result-section { display: flex; flex-direction: column; gap: var(--space-4); }
.section-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--brown-800);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  text-transform: uppercase;
}
.section-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--brown-600);
  color: var(--white);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}

.result-card {
  background: var(--white);
  border: 1px solid var(--brown-200);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}

/* Left Column Specifics */
.patient-table-header { padding: var(--space-4); border-bottom: 1px solid var(--brown-200); }
.data-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
.data-table td { padding: 6px 12px; border: 1px solid var(--gray-200); }
.data-table.mb-0 { margin-bottom: 0; }
.meridian-data-table td { text-align: center; border-color: var(--gray-100); }
.meridian-data-table td:first-child { text-align: left; }

.table-section-title { font-weight: 700; color: var(--brown-700); padding: var(--space-4) var(--space-4) var(--space-2); text-transform: uppercase; font-size: var(--font-size-sm); }
.stats-summary-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; border-top: 1px solid var(--brown-200); border-bottom: 1px solid var(--brown-200); background: #fdfbf8; }
.stat-col { padding: var(--space-2); text-align: center; font-size: var(--font-size-sm); font-weight: 600; border-right: 1px solid var(--gray-200); display: flex; flex-direction: column; justify-content: center; }
.stat-col:last-child { border-right: none; }
.stat-col .val { display: inline-block; }
.max-val { color: #dc2626; }
.min-val { color: #0284c7; }

.bg-gray { background-color: var(--gray-50); }
.text-brown-600 { color: var(--brown-600); }
/* Bat Cuong Design */
.bc-summary-grid { display: flex; flex-direction: column; gap: var(--space-2); background: var(--brown-50); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--brown-100); }
.bc-summary-item { display: flex; justify-content: space-between; align-items: center; font-size: var(--font-size-sm); }
.bc-label { color: var(--gray-600); font-weight: 600; }
.bc-value { color: var(--brown-800); font-weight: 700; }

.bc-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.bc-box { border: 1px solid; border-radius: var(--radius-md); overflow: hidden; }
.border-blue-200 { border-color: #bfdbfe; }
.border-red-200 { border-color: #fecaca; }
.box-header { display: flex; align-items: center; gap: var(--space-2); padding: 8px 12px; font-weight: 700; font-size: var(--font-size-xs); text-transform: uppercase; border-bottom: 1px solid; }
.text-blue-700 { color: #1d4ed8; }
.bg-blue-50 { background-color: #eff6ff; }
.text-red-700 { color: #b91c1c; }
.bg-red-50 { background-color: #fef2f2; }
.bg-white { background-color: #ffffff; }

.box-body { padding: var(--space-3); font-size: var(--font-size-sm); height: 100%; }
.bc-row { display: flex; flex-direction: column; gap: 2px; }
.bc-sub-label { font-weight: 600; font-size: var(--font-size-xs); text-transform: uppercase; opacity: 0.8; }
.bc-sub-val { color: var(--gray-800); font-weight: 500; min-height: 20px; }

.bc-tieu-ket { background: #fdfbf8; border: 1px solid var(--brown-100); border-radius: var(--radius-md); padding: var(--space-4); }
.tieu-ket-list { display: flex; flex-direction: column; gap: var(--space-3); }
.tk-item { display: flex; gap: var(--space-2); align-items: flex-start; font-size: var(--font-size-sm); line-height: 1.5; }
.tk-label { font-weight: 700; color: var(--brown-700); min-width: 85px; flex-shrink: 0; }
.tk-val { color: var(--gray-800); font-weight: 500; }

.text-blue-600 { color: #2563eb; }
.text-red-600 { color: #dc2626; }
.border-gray-100 { border-color: var(--gray-100); }
.border-b { border-bottom-width: 1px; border-bottom-style: solid; }
.mb-3 { margin-bottom: var(--space-3); }
.pt-4 { padding-top: var(--space-4); }
.mt-2 { margin-top: var(--space-2); }
.p-5 { padding: var(--space-5); }
.px-5 { padding-left: var(--space-5); padding-right: var(--space-5); }
.pb-5 { padding-bottom: var(--space-5); }

.table-footer-stat { padding: var(--space-4); background: var(--brown-50); border-top: 1px solid var(--brown-200); font-size: var(--font-size-sm); display: flex; align-items: center; justify-content: flex-end; }

/* Right Column Specifics */
.info-group { display: flex; flex-direction: column; gap: var(--space-2); }
.info-label { font-size: var(--font-size-sm); font-weight: 700; color: var(--gray-500); text-transform: uppercase; border-bottom: 1px solid var(--gray-100); padding-bottom: 4px; }
.info-text { font-size: var(--font-size-sm); color: var(--gray-800); line-height: 1.5; }
.font-medium { font-weight: 500; color: var(--brown-800); }

.tags-list { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.tag { padding: 4px 10px; border-radius: var(--radius-sm); font-size: var(--font-size-xs); font-weight: 600; }
.tag-yin { background: #e0f2fe; color: #0284c7; }
.tag-hot { background: #fee2e2; color: #dc2626; }
.tag-empty { background: var(--brown-100); color: var(--brown-700); }

.pathology-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--brown-50);
  border-radius: var(--radius-md);
  text-align: center;
  color: var(--brown-700);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.treatment-box {
  background: #fdfbf8;
  border-left: 3px solid var(--brown-500);
  padding: var(--space-3);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}

.syndrome-tag {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--white);
  border: 1px solid var(--brown-200);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
  transition: all var(--transition-fast);
}
.syndrome-tag:hover {
  border-color: var(--brown-400);
  background: var(--brown-50);
}
.synd-idx {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--brown-100);
  color: var(--brown-700);
  border-radius: 50%;
  font-size: var(--font-size-xs);
  font-weight: 700;
}
.synd-name {
  flex: 1;
  font-weight: 600;
  color: var(--gray-800);
}
.synd-rate {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: #059669; /* Green */
  background: #d1fae5;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}
.leading-relaxed { line-height: 1.625; }
.flex { display: flex; }
.flex-col { flex-direction: column; }
.gap-2 { gap: 0.5rem; }

/* Utilities */
.mt-3 { margin-top: var(--space-3); }
.mt-4 { margin-top: var(--space-4); }
.mt-6 { margin-top: var(--space-6); }

/* Loading & Error */
.loading-state { display: flex; flex-direction: column; align-items: center; gap: var(--space-4); padding: var(--space-16) 0; color: var(--gray-500); }
.spinner { width: 32px; height: 32px; border: 3px solid var(--gray-200); border-top-color: var(--brown-500); border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.error-state { text-align: center; padding: var(--space-10); color: var(--danger); }
.btn-secondary { padding: 10px 20px; background: var(--white); color: var(--gray-700); font-size: var(--font-size-sm); font-weight: 600; border-radius: var(--radius-md); border: 1px solid var(--gray-300); transition: all var(--transition-fast); cursor: pointer; }
.btn-secondary:hover { background: var(--gray-50); }

/* Responsive */
@media (max-width: 1024px) {
  .results-layout { grid-template-columns: 1fr; }
  .mock-stats-grid { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
}
</style>
