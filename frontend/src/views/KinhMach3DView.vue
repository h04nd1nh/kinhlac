<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mountAcuMap, unmountAcuMap } from '@/lib/acuMap3d'

const route = useRoute()
const router = useRouter()
const mountPoint = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

/**
 * Cầu nối engine → SPA: drawer 3D có sẵn 2 link "Xem thêm" (href #acu/<id>) và "Lý thuyết kinh
 * đầy đủ" (href #meridian/<mã>) — di sản từ webapp gốc, không tự điều hướng trong SPA. Bắt sự kiện
 * hashchange để đẩy sang trang "Từ Điển" đúng mục huyệt / đúng đường kinh.
 */
function onHashNav() {
  const h = location.hash
  let m: RegExpExecArray | null
  if ((m = /^#acu\/(\d+)/.exec(h))) {
    router.push({ name: 'tu-dien', query: { acu: m[1] } })
  } else if ((m = /^#meridian\/([A-Za-z]+)/.exec(h))) {
    router.push({ name: 'tu-dien', query: { mer: m[1] } })
  }
}

onMounted(async () => {
  try {
    if (mountPoint.value) await mountAcuMap(mountPoint.value)
    window.addEventListener('hashchange', onHashNav)
    // Mở từ "Từ Điển" với ?focus=<mã huyệt> → bay tới huyệt đó (engine đã sẵn sàng sau mountAcuMap).
    const focus = route.query.focus
    const code = Array.isArray(focus) ? focus[0] : focus
    if (code) (window as unknown as { AcuMap?: { focus: (c: string) => void } }).AcuMap?.focus(code)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', onHashNav)
  unmountAcuMap()
})
</script>

<template>
  <div class="km3d-page">
    <div v-if="error" class="km3d-error">
      <p><strong>Không tải được đồ hình 3D.</strong></p>
      <p>{{ error }}</p>
    </div>

    <div class="km3d-mount" ref="mountPoint">
      <div v-if="loading" class="km3d-loading">
        <div class="km3d-spinner" aria-hidden="true"></div>
        <p>Đang tải đồ hình kinh lạc 3D…</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.km3d-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: fadeIn 0.4s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.km3d-error {
  flex: none;
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5);
  font-size: var(--font-size-sm);
}
.km3d-error p { margin: 0 0 var(--space-1); }

/* Khung chứa đồ hình — engine 3D (.acu3d) gắn vào đây. Đặt chiều cao CỐ ĐỊNH (calc) để
 * .acu3d{height:100%} luôn resolve chắc chắn (tránh bẫy percentage-height của flexbox).
 * 140px ≈ header 64 + padding trên/dưới của content-area. */
.km3d-mount {
  flex: none;
  height: calc(100vh - 140px);
  min-height: 440px;
  position: relative;
}

.km3d-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  color: var(--brown-600);
  background: var(--surface);
  border: 1px solid var(--gray-200);
  border-radius: 14px;
  z-index: 5;
}
.km3d-spinner {
  width: 36px; height: 36px;
  border: 3px solid var(--gray-200);
  border-top-color: var(--brown-500);
  border-radius: 50%;
  animation: km3d-spin 0.7s linear infinite;
}
@keyframes km3d-spin { to { transform: rotate(360deg); } }

@media (max-width: 768px) {
  /* Padding content-area nhỏ hơn ở mobile → bù lại để khung không bị cụt. */
  .km3d-mount { height: calc(100vh - 108px); }
}
@media (max-width: 480px) {
  /* Điện thoại nhỏ: hạ chiều cao tối thiểu để đồ hình không lấn quá nhiều. */
  .km3d-mount { min-height: 360px; }
}
@media (max-height: 480px) {
  /* Điện thoại xoay NGANG (màn thấp): không ép khung cao hơn viewport. */
  .km3d-mount { height: calc(100vh - 90px); min-height: 260px; }
}
</style>
