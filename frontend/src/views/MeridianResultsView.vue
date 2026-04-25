<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePatientStore, type Patient } from '@/stores/patient'
import { api } from '@/services/api'

const router = useRouter()
const route = useRoute()
const patientStore = usePatientStore()

const patientId = computed(() => Number(route.params.patientId))
const examId = computed(() => Number(route.params.examId))
const patient = ref<Patient | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

// Placeholder exam data
const examData = ref({
  ticketNumber: '#' + examId.value,
  date: new Date().toLocaleDateString('vi-VN'),
  time: '08:30',
  doctor: 'BS. Lê Trọng',
  symptoms: 'Đau đầu, hoa mắt, mất ngủ kéo dài',
  conclusion: 'Can khí uất kết, Tâm tỳ lưỡng hư',
  treatment: 'Bình can giải uất, kiện tỳ an thần'
})

onMounted(async () => {
  await loadPatient()
})

async function loadPatient() {
  isLoading.value = true
  try {
    patient.value = await api.get<Patient>(`/patients/${patientId.value}`)
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
        <h1 class="page-title">Kết quả Khám bệnh - {{ examData.ticketNumber }}</h1>
        <div class="exam-meta">
          <span>Bệnh nhân: <strong>{{ patient.fullName }}</strong></span>
          <span class="divider">|</span>
          <span>Ngày khám: {{ examData.date }} {{ examData.time }}</span>
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
            <div class="result-card chart-placeholder">
              <!-- Placeholder for Meridian Chart -->
              <div class="placeholder-content">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--brown-300)" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                <p>Biểu đồ phân tích kinh lạc đang được xây dựng</p>
                <span class="placeholder-sub">Khu vực này sẽ hiển thị đồ thị 12 đường kinh lạc, đường trung bình, giá trị Tỉnh Huyệt, v.v.</span>
              </div>
            </div>

            <!-- Temporary Mock Tables to fill space -->
            <div class="mock-stats-grid mt-4">
              <div class="stat-box">
                <span class="stat-label">Tổng Nhiệt Độ</span>
                <span class="stat-value">36.5°C</span>
              </div>
              <div class="stat-box">
                <span class="stat-label">Chênh lệch Trái/Phải</span>
                <span class="stat-value text-warning">0.5°C</span>
              </div>
              <div class="stat-box">
                <span class="stat-label">Chênh lệch Trên/Dưới</span>
                <span class="stat-value">0.2°C</span>
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
            <div class="result-card">
              <div class="info-group">
                <h4 class="info-label">Bát Cương</h4>
                <div class="tags-list">
                  <span class="tag tag-yin">Âm Hư</span>
                  <span class="tag tag-hot">Nội Nhiệt</span>
                  <span class="tag tag-empty">Hư Chứng</span>
                </div>
              </div>
              
              <div class="info-group mt-3">
                <h4 class="info-label">Chẩn Đoán Tạng Phủ</h4>
                <p class="info-text">{{ examData.conclusion }}</p>
              </div>

              <div class="info-group mt-3">
                <h4 class="info-label">Triệu Chứng Bệnh Nhân</h4>
                <p class="info-text">{{ examData.symptoms }}</p>
              </div>
            </div>
          </section>

          <section class="result-section mt-6">
            <h2 class="section-title">
              <span class="section-num">III</span> MÔ HÌNH BỆNH LÝ & PHÁP TRỊ
            </h2>
            <div class="result-card">
              <div class="info-group">
                <h4 class="info-label">Mô Hình Bệnh Lý</h4>
                <div class="pathology-placeholder">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--brown-400)" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" /></svg>
                  <p>Mô hình Tương Sinh Tương Khắc</p>
                </div>
              </div>
              
              <div class="info-group mt-3">
                <h4 class="info-label">Pháp Trị Đề Xuất</h4>
                <div class="treatment-box">
                  <p class="info-text font-medium">{{ examData.treatment }}</p>
                </div>
              </div>

              <div class="info-group mt-3">
                <h4 class="info-label">Lời Khuyên</h4>
                <ul class="advice-list">
                  <li>Ăn uống thanh đạm, tránh đồ cay nóng.</li>
                  <li>Ngủ sớm trước 11h đêm.</li>
                  <li>Tập dưỡng sinh, xoa bóp huyệt vị.</li>
                </ul>
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
.chart-placeholder {
  min-height: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  background: linear-gradient(to bottom right, var(--white), var(--brown-50));
  border: 1px dashed var(--brown-300);
  text-align: center;
}
.placeholder-content { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); color: var(--brown-600); }
.placeholder-content p { font-size: var(--font-size-lg); font-weight: 600; }
.placeholder-sub { font-size: var(--font-size-sm); color: var(--gray-500); max-width: 300px; }

.mock-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}
.stat-box {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.stat-label { font-size: var(--font-size-xs); color: var(--gray-500); text-transform: uppercase; font-weight: 600; }
.stat-value { font-size: var(--font-size-xl); font-weight: 700; color: var(--brown-700); }
.text-warning { color: var(--warning); }

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

.advice-list {
  padding-left: var(--space-4);
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--gray-700);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.advice-list li { margin-bottom: 2px; }

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
