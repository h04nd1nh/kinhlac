<script setup lang="ts">
/**
 * DemoBaiThuocView — Trang "Phân Tích Bài Thuốc" CÔNG KHAI (khách chưa đăng nhập).
 *
 * Lấy THẬT từ DB qua endpoint @Public /demo/bai-thuoc (1 bài thuốc kinh điển).
 * Dùng lại ĐÚNG component phân tích thật (BaiThuocAnalysis): Tứ Khí + 3 radar
 * (Ngũ Vị · Quy Kinh · Thăng–Giáng–Phù–Trầm) + bảng Quân–Thần–Tá–Sứ — chế độ chỉ-xem.
 * Muốn tra cứu toàn bộ kho bài thuốc → mời đăng nhập.
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/services/api'
import PublicTopBar from '@/components/PublicTopBar.vue'
import BaiThuocAnalysis from '@/components/BaiThuocAnalysis.vue'

const router = useRouter()

interface BaiThuoc {
  id: number
  ten_bai_thuoc: string
  nguon_goc?: string | null
  cach_dung?: string | null
  chung_trang?: string | null
  chiTietViThuoc?: unknown[]
  phapTriLinks?: unknown[]
}

const loading = ref(true)
const error = ref<string | null>(null)
const baiThuoc = ref<BaiThuoc | null>(null)

function goLogin() {
  router.push({ name: 'login' })
}

onMounted(async () => {
  try {
    const res = await api.get<{ baiThuoc: BaiThuoc }>('/demo/bai-thuoc')
    baiThuoc.value = res.baiThuoc
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="dbt">
    <PublicTopBar title="Phân Tích Bài Thuốc" />

    <div class="dbt-body">
      <div v-if="loading" class="dbt-loading">
        <div class="dbt-spinner" aria-hidden="true"></div>
        <p>Đang tải bài thuốc mẫu…</p>
      </div>

      <div v-else-if="error" class="dbt-error">
        <p><strong>Không tải được bài thuốc mẫu.</strong></p>
        <p>{{ error }}</p>
      </div>

      <template v-else-if="baiThuoc">
        <header class="dbt-head">
          <span class="dbt-eyebrow">Kho Bài Thuốc · Bản Xem Thử</span>
          <h1 class="dbt-title">{{ baiThuoc.ten_bai_thuoc }}</h1>
          <p v-if="baiThuoc.nguon_goc" class="dbt-meta">Nguồn Gốc: <strong>{{ baiThuoc.nguon_goc }}</strong></p>
          <p v-if="baiThuoc.cach_dung" class="dbt-meta">Cách Dùng: {{ baiThuoc.cach_dung }}</p>
        </header>

        <!-- Phân tích thật (Tứ Khí + 3 radar + Quân–Thần–Tá–Sứ), chế độ chỉ-xem -->
        <BaiThuocAnalysis :bai-thuoc="(baiThuoc as any)" />

        <!-- CTA -->
        <div class="dbt-cta">
          <div>
            <h3 class="dbt-cta-title">Còn Hàng Trăm Bài Thuốc Khác</h3>
            <p class="dbt-cta-sub">Đăng nhập để tra cứu toàn bộ kho bài thuốc Đông Y · Tây Y, pháp trị và phân tích chi tiết.</p>
          </div>
          <button class="dbt-cta-btn" @click="goLogin">Đăng Nhập Để Xem Tất Cả →</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.dbt {
  min-height: 100vh;
  background: var(--bg-app);
  color: var(--text);
}
.dbt-body {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-5) var(--space-12);
}

.dbt-loading,
.dbt-error {
  text-align: center;
  padding: var(--space-12) var(--space-4);
  color: var(--text-muted);
}
.dbt-error {
  color: var(--danger);
}
.dbt-spinner {
  width: 36px;
  height: 36px;
  margin: 0 auto var(--space-3);
  border: 3px solid var(--gray-200);
  border-top-color: var(--brown-500);
  border-radius: 50%;
  animation: dbt-spin 0.7s linear infinite;
}
@keyframes dbt-spin {
  to {
    transform: rotate(360deg);
  }
}

.dbt-head {
  text-align: center;
  margin-bottom: var(--space-6);
}
.dbt-eyebrow {
  display: inline-block;
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--brown-600);
  margin-bottom: var(--space-2);
}
.dbt-title {
  font-size: var(--font-size-2xl);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-brand);
  margin-bottom: var(--space-2);
}
.dbt-meta {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  line-height: 1.6;
}
.dbt-meta strong {
  color: var(--text-brand);
}

.dbt-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
  padding: var(--space-6);
  background: linear-gradient(135deg, var(--brown-600) 0%, var(--brown-800) 100%);
  color: var(--white);
  border-radius: var(--radius-lg);
  margin-top: var(--space-6);
}
.dbt-cta-title {
  font-size: var(--font-size-lg);
  font-weight: 800;
  margin-bottom: 4px;
}
.dbt-cta-sub {
  font-size: var(--font-size-sm);
  color: rgba(255, 255, 255, 0.82);
}
.dbt-cta-btn {
  height: 48px;
  padding: 0 var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--white);
  color: var(--brown-700);
  font-size: var(--font-size-base);
  font-weight: 700;
  white-space: nowrap;
  transition: transform var(--transition-fast);
}
.dbt-cta-btn:hover {
  transform: translateY(-2px);
}
</style>
