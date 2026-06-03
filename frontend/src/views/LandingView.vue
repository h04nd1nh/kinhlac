<script setup lang="ts">
/**
 * LandingView — Trang chủ CÔNG KHAI (chưa cần đăng nhập).
 *
 * "Mặt tiền" giới thiệu phần mềm Y Học Cổ Truyền cho 3 nhóm người xem:
 *   • Sinh viên & giảng viên Y Học Cổ Truyền
 *   • Y sỹ, bác sỹ tại bệnh viện / phòng khám
 * Chiến thuật marketing: "nhá hàng" trực tiếp các tính năng thật ở chế độ CHỈ-XEM để hấp dẫn:
 *   • Đồ hình kinh lạc 3D — kéo xoay, xem đường kinh + huyệt, KHÔNG có công cụ chỉnh sửa.
 *   • Một bản kết quả đo kinh lạc mẫu (biểu đồ 12 đường kinh + gợi ý chẩn đoán).
 *   • Kho tri thức: vài bài thuốc / thể bệnh / pháp trị thật, phần còn lại "khoá" → mời đăng nhập.
 *
 * Trang nằm NGOÀI DashboardLayout (không có .content-area) nên tự viết Title Case.
 * Hiệu năng: hero dùng vòng CosmicWheel (SVG nhẹ); hình người 3D nặng đặt ở khu "Đồ Hình 3D" phía
 * dưới, tự lazy-load khi cuộn tới, và chỉ dựng trên màn hình rộng (mobile dùng vòng SVG).
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/services/api'
import CosmicWheel from '@/components/CosmicWheel.vue'
import HeroMeridianFigure from '@/components/HeroMeridianFigure.vue'
import BaiThuocAnalysis from '@/components/BaiThuocAnalysis.vue'

const router = useRouter()
const auth = useAuthStore()

// Đã đăng nhập rồi thì nút dẫn thẳng vào app; chưa thì ra trang đăng nhập.
const isAuthed = computed(() => auth.isAuthenticated)
const ctaLabel = computed(() => (isAuthed.value ? 'Vào Hệ Thống' : 'Đăng Nhập'))

function enter() {
  router.push({ name: isAuthed.value ? 'dashboard' : 'login' })
}
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
// Mở một trang "xem thử" CÔNG KHAI (không cần đăng nhập): 3D, kết quả đo, bài thuốc.
function openDemo(name: 'xem-3d' | 'xem-ket-qua-do' | 'xem-bai-thuoc' | 'thu-vien') {
  router.push({ name })
}

// ── Phân tích bài thuốc THẬT, nhúng ngay trên landing (lấy /demo/bai-thuoc, KHÔNG cần đăng nhập) ──
// Dùng lại đúng component phân tích thật (BaiThuocAnalysis) — chỉ cần truyền nguyên bài thuốc.
const formulaLoading = ref(true)
const demoFormula = ref<any>(null)

onMounted(async () => {
  try {
    const res = await api.get<{ baiThuoc: any }>('/demo/bai-thuoc')
    demoFormula.value = res.baiThuoc
  } catch {
    // Backend chưa sẵn sàng → ẩn khối phân tích, giữ nguyên các panel tĩnh bên dưới.
  } finally {
    formulaLoading.value = false
  }
})

// Chỉ dựng hình người 3D trên màn hình rộng (mobile dùng vòng SVG nhẹ).
const showFigure = ref(false)
let mq: MediaQueryList | null = null
function syncFigure() {
  showFigure.value = !!mq?.matches
}
onMounted(() => {
  mq = window.matchMedia('(min-width: 769px)')
  syncFigure()
  mq.addEventListener?.('change', syncFigure)
})
onBeforeUnmount(() => mq?.removeEventListener?.('change', syncFigure))

// ── "Nhá hàng" đồ hình 3D ──
const model3d = [
  'Xoay 360° — quan sát đường kinh từ mọi góc, ngay trên màn hình.',
  '14 đường kinh chính phát sáng cùng hệ thống huyệt vị định vị chính xác.',
  'Chế độ chỉ-xem: kéo để xoay, không lo chỉnh sửa nhầm dữ liệu.',
  'Giáo cụ trực quan cho học – giảng dạy và tra cứu tại phòng khám.',
]

// ── "Nhá hàng" kết quả đo kinh lạc (số liệu mẫu kiểu Ryodoraku, thang tương đối 0–100) ──
const NORMAL_LOW = 45
const NORMAL_HIGH = 75
type MStatus = 'normal' | 'high' | 'low'
const meridianChart: { ten: string; value: number; status: MStatus }[] = [
  { ten: 'Phế', value: 58, status: 'normal' },
  { ten: 'Đại Trường', value: 55, status: 'normal' },
  { ten: 'Tâm Bào', value: 64, status: 'normal' },
  { ten: 'Tam Tiêu', value: 60, status: 'normal' },
  { ten: 'Tâm', value: 67, status: 'normal' },
  { ten: 'Tiểu Trường', value: 62, status: 'normal' },
  { ten: 'Tỳ', value: 33, status: 'low' },
  { ten: 'Vị', value: 37, status: 'low' },
  { ten: 'Can', value: 88, status: 'high' },
  { ten: 'Đởm', value: 84, status: 'high' },
  { ten: 'Thận', value: 52, status: 'normal' },
  { ten: 'Bàng Quang', value: 57, status: 'normal' },
]
const statusShort: Record<MStatus, string> = { normal: 'Cân Bằng', high: 'Cao', low: 'Thấp' }

// ── "Nhá hàng" kho tri thức (dữ liệu Đông Y cổ điển — thật & chính xác) ──
interface KItem {
  name: string
  sub: string
}
interface KPanel {
  icon: string
  title: string
  tone: string
  items: KItem[]
  more: string
}
const knowledge: KPanel[] = [
  {
    icon: 'flask',
    title: 'Bài Thuốc',
    tone: 'k-herb',
    items: [
      { name: 'Lục Vị Địa Hoàng Hoàn', sub: 'Tư Bổ Can Thận' },
      { name: 'Bổ Trung Ích Khí Thang', sub: 'Kiện Tỳ Ích Khí' },
      { name: 'Tiêu Dao Tán', sub: 'Sơ Can Giải Uất' },
    ],
    more: '500+ Bài Thuốc Đông Y · Tây Y',
  },
  {
    icon: 'pattern',
    title: 'Thể Bệnh',
    tone: 'k-pattern',
    items: [
      { name: 'Can Thận Âm Hư', sub: 'Âm Dịch Suy Tổn' },
      { name: 'Tỳ Vị Khí Hư', sub: 'Vận Hoá Suy Giảm' },
      { name: 'Khí Trệ Huyết Ứ', sub: 'Kinh Mạch Ứ Trở' },
    ],
    more: '100+ Thể Bệnh',
  },
  {
    icon: 'shield',
    title: 'Pháp Trị',
    tone: 'k-method',
    items: [
      { name: 'Tư Âm Giáng Hỏa', sub: 'Bổ Âm Tiềm Dương' },
      { name: 'Kiện Tỳ Hoà Vị', sub: 'Củng Cố Trung Tiêu' },
      { name: 'Hoạt Huyết Hoá Ứ', sub: 'Thông Kinh Tán Ứ' },
    ],
    more: 'Hàng Trăm Pháp Trị',
  },
]

const stats = [
  { value: '14', label: 'Đường Kinh Chính' },
  { value: '5.000+', label: 'Hồ Sơ Bệnh Nhân' },
  { value: '9.000+', label: 'Lần Đo Kinh Lạc' },
]

const features = [
  { icon: 'book', label: 'Từ Điển Huyệt Vị', desc: 'Tra cứu huyệt, kinh mạch, châm cứu trị bệnh và bệnh học một cách trực quan.' },
  { icon: 'clipboard', label: 'Triệu Chứng → Pháp Trị', desc: 'Từ triệu chứng suy ra pháp trị, bài thuốc và thể bệnh theo lý luận Đông Y.' },
  { icon: 'rules', label: 'Bệnh Đo Kinh Lạc', desc: 'Phân tích chỉ số đo kinh lạc và gợi ý chẩn đoán theo bộ quy tắc tự động.' },
  { icon: 'stethoscope', label: 'Bệnh Tây Y', desc: 'Đối chiếu bệnh danh Tây Y với chẩn đoán Đông Y, kết hợp hai nền y học.' },
  { icon: 'patients', label: 'Quản Lý Bệnh Nhân', desc: 'Hồ sơ, tiền sử bệnh và lịch sử điều trị tập trung một nơi, tra cứu vài giây.' },
  { icon: 'calendar', label: 'Lịch Trị Liệu', desc: 'Đặt lịch, cấu hình giờ khám và theo dõi tình trạng từng lần hẹn dễ dàng.' },
]

// ── Các mục trong Thư Viện · Từ Điển (mở miễn phí ở /thu-vien) ──
const libraryCats = [
  { icon: 'acu', title: 'Huyệt Vị · Châm Cứu', count: '1.058 Huyệt', desc: 'Vị trí, chủ trị, cách châm cứu và giải phẫu từng huyệt.' },
  { icon: 'meridian', title: 'Lý Thuyết Kinh Mạch', count: '12 Chính Kinh + 8 Mạch', desc: 'Đường vận hành, chủ trị, đồ hình và danh sách huyệt mỗi đường kinh.' },
  { icon: 'needle', title: 'Châm Cứu Trị Bệnh', count: '100 Bệnh', desc: 'Phác đồ châm cứu theo từng bệnh, công thức huyệt cụ thể.' },
  { icon: 'book', title: 'Bệnh Học', count: '99 Bệnh', desc: 'Bệnh học Đông Y, đối chiếu với bệnh danh hiện đại.' },
  { icon: 'source', title: 'Thư Mục Nguồn', count: '93 Nguồn', desc: 'Trích dẫn xuất xứ từ các y thư kinh điển.' },
]

interface Audience {
  icon: string
  title: string
  desc: string
}
const audiences: Audience[] = [
  {
    icon: 'grad',
    title: 'Sinh Viên & Giảng Viên',
    desc: 'Giáo cụ trực quan cho việc học và giảng dạy kinh lạc, huyệt vị, bệnh học Đông Y — sinh động hơn hẳn hình vẽ trên giấy.',
  },
  {
    icon: 'stethoscope',
    title: 'Y Sỹ & Bác Sỹ',
    desc: 'Hỗ trợ chẩn đoán, kê đơn và tra cứu huyệt vị nhanh chóng, chính xác trong thực hành lâm sàng hằng ngày.',
  },
  {
    icon: 'hospital',
    title: 'Phòng Khám & Bệnh Viện',
    desc: 'Quản lý bệnh nhân, lịch trị liệu và hồ sơ điều trị tập trung, chuyên nghiệp và an toàn dữ liệu.',
  },
]
</script>

<template>
  <div class="landing">
    <!-- ============ Thanh điều hướng ============ -->
    <header class="lp-nav">
      <div class="lp-nav-inner">
        <div class="lp-brand" @click="scrollTo('top')">
          <svg width="34" height="34" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="30" stroke="var(--brown-300)" stroke-width="2" />
            <path d="M32 12C32 12 20 22 20 32C20 38.627 25.373 44 32 44C38.627 44 44 38.627 44 32C44 22 32 12 32 12Z" fill="var(--brown-600)" />
            <circle cx="32" cy="32" r="4" fill="var(--white)" />
          </svg>
          <span class="lp-brand-text">Y Học Cổ Truyền</span>
        </div>
        <nav class="lp-nav-links">
          <button @click="scrollTo('model3d')">Đồ Hình 3D</button>
          <button @click="scrollTo('measure')">Kết Quả Đo</button>
          <button @click="scrollTo('knowledge')">Kho Tri Thức</button>
          <button @click="scrollTo('thu-vien')">Thư Viện</button>
          <button @click="scrollTo('audience')">Dành Cho Ai</button>
        </nav>
        <button class="lp-btn lp-btn--primary" @click="enter">{{ ctaLabel }}</button>
      </div>
    </header>

    <!-- ============ Hero ============ -->
    <section class="lp-hero" id="top">
      <div class="lp-hero-inner">
        <div class="lp-hero-copy">
          <span class="lp-badge">Phần Mềm Y Học Cổ Truyền · Đào Tạo & Lâm Sàng</span>
          <h1 class="lp-title">
            <span class="hl">Y Học Cổ Truyền</span><br />Từ Giảng Đường Đến Phòng Khám
          </h1>
          <p class="lp-hero-sub">
            Phần mềm quản lý phòng khám kết hợp <strong>đồ hình kinh lạc 3D</strong> — công cụ học tập, giảng dạy và thực hành lâm sàng dành cho sinh viên, giảng viên, y sỹ và bác sỹ Đông Y.
          </p>
          <div class="lp-cta-row">
            <button class="lp-btn lp-btn--primary lp-btn--lg" @click="enter">{{ ctaLabel }} →</button>
            <button class="lp-btn lp-btn--ghost-light lp-btn--lg" @click="openDemo('xem-3d')">Trải Nghiệm 3D Ngay</button>
            <button class="lp-btn lp-btn--ghost-light lp-btn--lg" @click="openDemo('thu-vien')">Mở Thư Viện Tra Cứu</button>
          </div>
          <ul class="lp-stats">
            <li v-for="s in stats" :key="s.label">
              <strong>{{ s.value }}</strong>
              <span>{{ s.label }}</span>
            </li>
          </ul>
        </div>

        <div class="lp-hero-art">
          <div class="lp-wheel"><CosmicWheel /></div>
        </div>
      </div>
    </section>

    <!-- ============ Đồ hình 3D (điểm nhấn — xem trước CHỈ-XEM) ============ -->
    <section class="lp-model" id="model3d">
      <div class="lp-model-inner">
        <div class="lp-model-art">
          <!-- Khung "cửa sổ app" để giống ảnh chụp sản phẩm thật -->
          <div class="lp-stage">
            <div class="lp-stage-bar">
              <span class="lp-dot"></span><span class="lp-dot"></span><span class="lp-dot"></span>
              <span class="lp-stage-title">Đồ Hình Kinh Lạc 3D</span>
              <span class="lp-stage-badge">Chỉ Xem</span>
            </div>
            <div class="lp-stage-body">
              <div v-if="showFigure" class="lp-figure">
                <HeroMeridianFigure interactive show-points />
              </div>
              <div v-else class="lp-wheel lp-wheel--model"><CosmicWheel /></div>
            </div>
            <span v-if="showFigure" class="lp-stage-hint">Kéo để xoay · Bấm “Mở Đồ Hình 3D Đầy Đủ” để xem toàn bộ kinh – huyệt</span>
          </div>
        </div>
        <div class="lp-model-copy">
          <span class="lp-eyebrow lp-eyebrow--light">Điểm Nhấn</span>
          <h2 class="lp-h2 lp-h2--light">Đồ Hình Kinh Lạc 3D Sống Động</h2>
          <p class="lp-model-sub">
            Mô hình cơ thể người ba chiều với toàn bộ hệ thống đường kinh và huyệt vị — kéo xoay để quan sát, học giải phẫu kinh lạc trực quan ngay trên màn hình.
          </p>
          <ul class="lp-checks">
            <li v-for="(p, i) in model3d" :key="i">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clip-rule="evenodd" /></svg>
              <span>{{ p }}</span>
            </li>
          </ul>
          <button class="lp-btn lp-btn--primary lp-btn--lg" @click="openDemo('xem-3d')">Mở Đồ Hình 3D Đầy Đủ →</button>
          <p class="lp-free-note">Miễn phí · Không cần đăng nhập · Đầy đủ danh sách kinh – huyệt &amp; bay tới huyệt</p>
        </div>
      </div>
    </section>

    <!-- ============ Thư viện · Từ Điển (mở miễn phí — giới thiệu + lối vào /thu-vien) ============ -->
    <section class="lp-library" id="thu-vien">
      <div class="lp-section-head">
        <span class="lp-eyebrow">Thư Viện · Từ Điển</span>
        <h2 class="lp-h2">Từ Điển Đông Y — Tra Cứu Toàn Diện, Mở Miễn Phí</h2>
        <p class="lp-section-sub">
          Toàn bộ kho tri thức huyệt vị, kinh mạch, châm cứu trị bệnh và bệnh học — mở đầy đủ cho mọi người, không cần đăng nhập.
        </p>
      </div>

      <div class="lp-lib-grid">
        <article v-for="c in libraryCats" :key="c.title" class="lp-lib-card">
          <span class="lp-lib-ic">
            <svg v-if="c.icon === 'acu'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" /><path stroke-linecap="round" d="M12 3v3M12 18v3M3 12h3M18 12h3" /></svg>
            <svg v-else-if="c.icon === 'meridian'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            <svg v-else-if="c.icon === 'needle'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 20.5L3.5 13.5a5 5 0 017.07-7.07l7 7a5 5 0 01-7.07 7.07z" /><path stroke-linecap="round" stroke-linejoin="round" d="M8.5 8.5l7 7" /></svg>
            <svg v-else-if="c.icon === 'book'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2zM12 6.5v13" /></svg>
            <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
          </span>
          <div class="lp-lib-text">
            <h3 class="lp-lib-title">{{ c.title }}</h3>
            <span class="lp-lib-count">{{ c.count }}</span>
            <p class="lp-lib-desc">{{ c.desc }}</p>
          </div>
        </article>
      </div>

      <div class="lp-lib-cta">
        <button class="lp-btn lp-btn--primary lp-btn--lg" @click="openDemo('thu-vien')">Mở Thư Viện Tra Cứu →</button>
        <p class="lp-lib-note">Miễn phí · Không cần đăng nhập · Tra cứu &amp; xem huyệt trong 3D ngay</p>
      </div>
    </section>

    <!-- ============ Kết quả đo kinh lạc (xem trước) ============ -->
    <section class="lp-measure" id="measure">
      <div class="lp-section-head">
        <span class="lp-eyebrow">Đo Kinh Lạc</span>
        <h2 class="lp-h2">Kết Quả Đo Hiện Thành Biểu Đồ Trực Quan</h2>
        <p class="lp-section-sub">Chỉ số 12 đường kinh được đối chiếu với ngưỡng sinh lý, tự động chỉ ra kinh cường – kinh nhược và gợi ý chẩn đoán.</p>
      </div>

      <div class="lp-measure-card">
        <div class="mc-chart">
          <div class="mc-legend">
            <span class="mc-leg"><i class="is-high"></i> Cao (Thực)</span>
            <span class="mc-leg"><i class="is-normal"></i> Cân Bằng</span>
            <span class="mc-leg"><i class="is-low"></i> Thấp (Hư)</span>
            <span class="mc-leg mc-leg--band"><i></i> Ngưỡng Sinh Lý</span>
          </div>
          <div class="mc-rows">
            <div class="mc-row" v-for="m in meridianChart" :key="m.ten">
              <span class="mc-name">{{ m.ten }}</span>
              <span class="mc-track">
                <span class="mc-band"></span>
                <span class="mc-fill" :class="'is-' + m.status" :style="{ width: m.value + '%' }"></span>
              </span>
              <span class="mc-val" :class="'is-' + m.status">{{ statusShort[m.status] }}</span>
            </div>
          </div>
        </div>

        <aside class="mc-readout">
          <span class="lp-eyebrow">Gợi Ý Chẩn Đoán</span>
          <div class="mc-flags">
            <span class="mc-flag is-high">Can · Đởm Cao</span>
            <span class="mc-flag is-low">Tỳ · Vị Thấp</span>
          </div>
          <dl class="mc-dx">
            <div>
              <dt>Thể Bệnh</dt>
              <dd>Can Khí Uất Kết · Tỳ Vị Hư Nhược</dd>
            </div>
            <div>
              <dt>Pháp Trị</dt>
              <dd>Sơ Can Lý Khí · Kiện Tỳ Hoà Vị</dd>
            </div>
          </dl>
          <p class="mc-note">Biểu đồ trên là minh hoạ. Bấm “Xem Kết Quả Đo Thật” để mở một bản đo thật (đã ẩn danh) — đọc được toàn bộ bảng chỉ số, Bát Cương và thể bệnh.</p>
          <button class="lp-btn lp-btn--primary mc-cta" @click="openDemo('xem-ket-qua-do')">Xem Kết Quả Đo Thật →</button>
          <button class="lp-link-btn" @click="enter">Đo Cho Bệnh Nhân Của Bạn →</button>
        </aside>
      </div>
    </section>

    <!-- ============ Tính năng ============ -->
    <section class="lp-section" id="features">
      <div class="lp-section-head">
        <span class="lp-eyebrow">Tính Năng</span>
        <h2 class="lp-h2">Tất Cả Phòng Khám Cần, Trong Một Hệ Thống</h2>
        <p class="lp-section-sub">Từ tiếp đón bệnh nhân đến chẩn đoán và kê đơn — mọi nghiệp vụ Đông Y đều được số hoá liền mạch.</p>
      </div>

      <div class="lp-feature-grid">
        <article v-for="f in features" :key="f.label" class="lp-feature">
          <span class="lp-feature-ic">
            <svg v-if="f.icon === 'patients'" width="24" height="24" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>
            <svg v-else-if="f.icon === 'calendar'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <svg v-else-if="f.icon === 'clipboard'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            <svg v-else-if="f.icon === 'book'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2zM12 6.5v13" /></svg>
            <svg v-else-if="f.icon === 'stethoscope'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13a9 9 0 0018 0v-5m-9 14a5 5 0 01-5-5V7a2 2 0 012-2h6a2 2 0 012 2v5a5 5 0 01-5 5zm0 0v-4" /></svg>
            <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M3 12h18M3 18h18M3 6v12M9 6v12M15 6v12M21 6v12" /></svg>
          </span>
          <h3 class="lp-feature-title">{{ f.label }}</h3>
          <p class="lp-feature-desc">{{ f.desc }}</p>
        </article>
      </div>
    </section>

    <!-- ============ Kho tri thức (xem trước, khoá phần còn lại) ============ -->
    <section class="lp-knowledge" id="knowledge">
      <div class="lp-section-head">
        <span class="lp-eyebrow">Kho Tri Thức</span>
        <h2 class="lp-h2">Bài Thuốc · Thể Bệnh · Pháp Trị Liên Kết Với Nhau</h2>
        <p class="lp-section-sub">Hệ thống tự suy luận: từ triệu chứng ra pháp trị, rồi gợi ý bài thuốc và thể bệnh phù hợp.</p>
      </div>

      <div class="lp-flow">
        <span class="lp-flow-step">Triệu Chứng</span>
        <span class="lp-flow-arrow">→</span>
        <span class="lp-flow-step lp-flow-step--accent">Pháp Trị</span>
        <span class="lp-flow-arrow">→</span>
        <span class="lp-flow-step">Bài Thuốc</span>
        <span class="lp-flow-plus">+</span>
        <span class="lp-flow-step">Thể Bệnh</span>
      </div>

      <div class="lp-k-grid">
        <article v-for="p in knowledge" :key="p.title" class="lp-k-panel" :class="p.tone">
          <header class="lp-k-head">
            <span class="lp-k-ic">
              <svg v-if="p.icon === 'flask'" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.816 14.769 2.156 18 4.828 18h10.343c2.673 0 4.013-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7z" clip-rule="evenodd" /></svg>
              <svg v-else-if="p.icon === 'shield'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
            <h3 class="lp-k-title">{{ p.title }}</h3>
          </header>
          <ul class="lp-k-list">
            <li v-for="it in p.items" :key="it.name">
              <span class="lp-k-name">{{ it.name }}</span>
              <span class="lp-k-sub">{{ it.sub }}</span>
            </li>
          </ul>
          <button
            v-if="p.title === 'Bài Thuốc'"
            class="lp-k-more lp-k-more--live"
            @click="openDemo('xem-bai-thuoc')"
          >
            <span>Xem Phân Tích Tính Vị Quy Kinh →</span>
          </button>
          <button v-else class="lp-k-more" @click="enter">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" /></svg>
            <span>{{ p.more }} · Đăng Nhập Để Xem</span>
          </button>
        </article>
      </div>

      <!-- Phân tích bài thuốc THẬT — nhúng ngay trên landing, xem không cần đăng nhập -->
      <div v-if="!formulaLoading && demoFormula" class="lp-bt">
        <div class="lp-bt-head">
          <div class="lp-bt-headtext">
            <span class="lp-bt-eyebrow">Trải Nghiệm Thật · Không Cần Đăng Nhập</span>
            <h3 class="lp-bt-title">Phân Tích “{{ demoFormula.ten_bai_thuoc }}” Theo Tính Vị Quy Kinh</h3>
            <p v-if="demoFormula.nguon_goc" class="lp-bt-source">Nguồn Gốc: {{ demoFormula.nguon_goc }}</p>
          </div>
          <button class="lp-btn lp-btn--primary" @click="openDemo('xem-bai-thuoc')">Mở Phân Tích Đầy Đủ →</button>
        </div>

        <BaiThuocAnalysis :bai-thuoc="demoFormula" />

        <p class="lp-bt-note">Tứ Khí · Ngũ Vị · Quy Kinh · Thăng–Giáng–Phù–Trầm và vai trò <strong>Quân · Thần · Tá · Sứ</strong> đều suy ra tự động từ thành phần bài thuốc — đây là phân tích THẬT, xem trực tiếp không cần đăng nhập.</p>
      </div>
    </section>

    <!-- ============ Dành cho ai ============ -->
    <section class="lp-audience" id="audience">
      <div class="lp-section-head">
        <span class="lp-eyebrow">Dành Cho Ai</span>
        <h2 class="lp-h2">Một Nền Tảng, Nhiều Người Dùng</h2>
        <p class="lp-section-sub">Thiết kế cho cả giảng đường lẫn lâm sàng — phục vụ người học, người dạy và người hành nghề Đông Y.</p>
      </div>
      <div class="lp-audience-grid">
        <article v-for="a in audiences" :key="a.title" class="lp-audience-card">
          <span class="lp-audience-ic">
            <svg v-if="a.icon === 'grad'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M22 10L12 5 2 10l10 5 10-5z" /><path stroke-linecap="round" stroke-linejoin="round" d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5M22 10v6" /></svg>
            <svg v-else-if="a.icon === 'stethoscope'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13a9 9 0 0018 0v-5m-9 14a5 5 0 01-5-5V7a2 2 0 012-2h6a2 2 0 012 2v5a5 5 0 01-5 5zm0 0v-4" /></svg>
            <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16M12 7v6M9 10h6" /></svg>
          </span>
          <h3 class="lp-audience-title">{{ a.title }}</h3>
          <p class="lp-audience-desc">{{ a.desc }}</p>
        </article>
      </div>
    </section>

    <!-- ============ Lời kêu gọi ============ -->
    <section class="lp-cta">
      <div class="lp-cta-inner">
        <h2 class="lp-cta-title">Sẵn Sàng Trải Nghiệm?</h2>
        <p class="lp-cta-sub">Đăng nhập để khám phá đồ hình kinh lạc 3D và toàn bộ kho tri thức Đông Y.</p>
        <button class="lp-btn lp-btn--primary lp-btn--lg" @click="enter">{{ ctaLabel }} →</button>
      </div>
    </section>

    <!-- ============ Chân trang ============ -->
    <footer class="lp-footer">
      <div class="lp-footer-inner">
        <div class="lp-brand lp-brand--footer">
          <svg width="28" height="28" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="30" stroke="rgba(255,255,255,.3)" stroke-width="2" />
            <path d="M32 12C32 12 20 22 20 32C20 38.627 25.373 44 32 44C38.627 44 44 38.627 44 32C44 22 32 12 32 12Z" fill="rgba(255,255,255,.9)" />
            <circle cx="32" cy="32" r="4" fill="var(--brown-700)" />
          </svg>
          <span class="lp-brand-text">Y Học Cổ Truyền</span>
        </div>
        <p class="lp-footer-note">Hệ thống quản lý phòng khám Đông Y · © 2026</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  min-height: 100vh;
  background: var(--bg-app);
  color: var(--text);
  overflow-x: hidden;
}

/* ---------- Nút chung ---------- */
.lp-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 40px;
  padding: 0 var(--space-5);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast);
  white-space: nowrap;
}
.lp-btn--lg {
  height: 50px;
  padding: 0 var(--space-6);
  font-size: var(--font-size-base);
  border-radius: var(--radius-lg);
}
.lp-btn--primary {
  background: linear-gradient(135deg, var(--brown-600) 0%, var(--brown-700) 100%);
  color: var(--white);
  box-shadow: 0 6px 18px rgba(var(--primary-rgb), 0.28);
}
.lp-btn--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 26px rgba(var(--primary-rgb), 0.38);
}
.lp-btn--ghost-light {
  background: rgba(255, 255, 255, 0.1);
  color: var(--white);
  border: 1px solid rgba(255, 255, 255, 0.28);
}
.lp-btn--ghost-light:hover {
  background: rgba(255, 255, 255, 0.18);
  transform: translateY(-2px);
}
.lp-link-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--brown-600);
  transition: color var(--transition-fast);
}
.lp-link-btn:hover {
  color: var(--brown-800);
}

/* ---------- Thanh điều hướng ---------- */
.lp-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(250, 246, 239, 0.82);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}
.lp-nav-inner {
  max-width: 1180px;
  margin: 0 auto;
  height: 68px;
  padding: 0 var(--space-6);
  display: flex;
  align-items: center;
  gap: var(--space-6);
}
.lp-brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
}
.lp-brand-text {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--brown-800);
  letter-spacing: -0.01em;
}
.lp-nav-links {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-left: auto;
}
.lp-nav-links button {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-muted);
  transition: color var(--transition-fast), background var(--transition-fast);
}
.lp-nav-links button:hover {
  color: var(--brown-700);
  background: var(--brown-50);
}

/* ---------- Hero ---------- */
.lp-hero {
  position: relative;
  background: linear-gradient(135deg, var(--brown-700) 0%, var(--brown-900) 100%);
  color: var(--white);
  overflow: hidden;
}
.lp-hero::before {
  content: '';
  position: absolute;
  top: -30%;
  right: -8%;
  width: 520px;
  height: 520px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0) 70%);
  pointer-events: none;
}
.lp-hero-inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--space-16) var(--space-6);
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  align-items: center;
  gap: var(--space-10);
}
.lp-hero-copy {
  position: relative;
  z-index: 1;
  min-width: 0;
}
.lp-badge {
  display: inline-block;
  font-size: var(--font-size-xs);
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--brown-100);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.16);
  padding: 6px 14px;
  border-radius: var(--radius-full);
  margin-bottom: var(--space-5);
}
.lp-title {
  font-size: clamp(2rem, 1.4rem + 2.8vw, 3.1rem);
  font-weight: 800;
  line-height: 1.12;
  letter-spacing: -0.02em;
  margin-bottom: var(--space-5);
}
.lp-title .hl {
  color: var(--brown-200);
}
.lp-hero-sub {
  font-size: var(--font-size-lg);
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.8);
  max-width: 34rem;
  margin-bottom: var(--space-8);
}
.lp-hero-sub strong {
  color: var(--brown-100);
  font-weight: 700;
}
.lp-cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-bottom: var(--space-10);
}
.lp-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}
.lp-stats li {
  display: flex;
  flex-direction: column;
  list-style: none;
}
.lp-stats strong {
  font-size: var(--font-size-2xl);
  font-weight: 800;
  color: var(--white);
  line-height: 1.1;
}
.lp-stats span {
  font-size: var(--font-size-sm);
  color: rgba(255, 255, 255, 0.7);
  margin-top: 2px;
}
.lp-hero-art {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 340px;
}
.lp-wheel {
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(260px, 30vw, 400px);
}

/* ---------- Đồ hình 3D (band tối để đường kinh phát sáng nổi lên) ---------- */
.lp-model {
  background: linear-gradient(140deg, var(--brown-800) 0%, #1a0f05 100%);
  color: var(--white);
  position: relative;
  overflow: hidden;
}
.lp-model-inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--space-16) var(--space-6);
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: var(--space-10);
}
.lp-model-art {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* Khung "cửa sổ app" */
.lp-stage {
  width: 100%;
  max-width: 460px;
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}
.lp-stage-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 10px var(--space-4);
  background: rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.lp-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.28);
}
.lp-stage-title {
  margin-left: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}
.lp-stage-badge {
  margin-left: auto;
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--brown-100);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 3px 10px;
  border-radius: var(--radius-full);
}
.lp-stage-body {
  position: relative;
  height: clamp(360px, 44vw, 480px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.lp-figure {
  position: relative;
  width: 100%;
  height: 100%;
}
.lp-wheel--model {
  opacity: 0.92;
}
.lp-stage-hint {
  display: block;
  text-align: center;
  padding: 8px var(--space-4) 12px;
  font-size: var(--font-size-xs);
  color: rgba(255, 255, 255, 0.6);
}
.lp-model-copy {
  position: relative;
  z-index: 1;
  min-width: 0;
}
.lp-model-sub {
  font-size: var(--font-size-lg);
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: var(--space-6);
}
.lp-checks {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-8);
}
.lp-checks li {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  list-style: none;
  font-size: var(--font-size-base);
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.6;
}
.lp-checks svg {
  flex-shrink: 0;
  margin-top: 3px;
  color: var(--brown-200);
}
.lp-free-note {
  margin-top: var(--space-3);
  font-size: var(--font-size-xs);
  color: rgba(255, 255, 255, 0.62);
}

/* ---------- Khối section chung ---------- */
.lp-section,
.lp-measure,
.lp-knowledge,
.lp-audience {
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--space-16) var(--space-6);
}
.lp-measure,
.lp-knowledge {
  max-width: none;
}
.lp-measure {
  background: var(--surface-2);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.lp-measure > .lp-section-head,
.lp-measure > .lp-measure-card,
.lp-knowledge > .lp-section-head,
.lp-knowledge > .lp-flow,
.lp-knowledge > .lp-k-grid {
  max-width: 1180px;
  margin-left: auto;
  margin-right: auto;
}
.lp-section-head {
  text-align: center;
  max-width: 44rem;
  margin: 0 auto var(--space-12);
}
.lp-eyebrow {
  display: inline-block;
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--brown-600);
  margin-bottom: var(--space-3);
}
.lp-eyebrow--light {
  color: var(--brown-200);
}
.lp-h2 {
  font-size: var(--font-size-3xl);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text);
  margin-bottom: var(--space-3);
}
.lp-h2--light {
  color: var(--white);
  margin-bottom: var(--space-4);
}
.lp-section-sub {
  font-size: var(--font-size-base);
  color: var(--text-muted);
  line-height: 1.7;
}

/* ---------- Kết quả đo kinh lạc ---------- */
.lp-measure-card {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: var(--space-8);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--space-8);
}
.mc-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}
.mc-leg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-xs);
  color: var(--text-muted);
}
.mc-leg i {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  display: inline-block;
}
.mc-leg i.is-high {
  background: var(--danger);
}
.mc-leg i.is-normal {
  background: var(--success);
}
.mc-leg i.is-low {
  background: var(--info);
}
.mc-leg--band i {
  background: var(--success-bg);
  border: 1px dashed var(--success-border);
}
.mc-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.mc-row {
  display: grid;
  grid-template-columns: 86px 1fr 64px;
  align-items: center;
  gap: var(--space-3);
}
.mc-name {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text);
  text-align: right;
  white-space: nowrap;
}
.mc-track {
  position: relative;
  height: 16px;
  background: var(--gray-100);
  border-radius: var(--radius-full);
  overflow: hidden;
}
/* Vùng "ngưỡng sinh lý" 45%–75% */
.mc-band {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 45%;
  width: 30%;
  background: var(--success-bg);
  border-left: 1px dashed var(--success-border);
  border-right: 1px dashed var(--success-border);
}
.mc-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  border-radius: var(--radius-full);
  animation: mc-grow 0.9s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes mc-grow {
  from {
    width: 0 !important;
  }
}
.mc-fill.is-high {
  background: linear-gradient(90deg, var(--danger), #d4674e);
}
.mc-fill.is-normal {
  background: linear-gradient(90deg, var(--brown-400), var(--brown-600));
}
.mc-fill.is-low {
  background: linear-gradient(90deg, var(--info), #4d93b0);
}
.mc-val {
  font-size: var(--font-size-xs);
  font-weight: 700;
}
.mc-val.is-high {
  color: var(--danger-fg);
}
.mc-val.is-normal {
  color: var(--text-subtle);
}
.mc-val.is-low {
  color: var(--info-fg);
}

.mc-readout {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  align-self: start;
}
.mc-flags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}
.mc-flag {
  font-size: var(--font-size-xs);
  font-weight: 700;
  padding: 4px 12px;
  border-radius: var(--radius-full);
}
.mc-flag.is-high {
  background: var(--danger-bg);
  color: var(--danger-fg);
  border: 1px solid var(--danger-border);
}
.mc-flag.is-low {
  background: var(--info-bg);
  color: var(--info-fg);
  border: 1px solid var(--info-border);
}
.mc-dx {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}
.mc-dx dt {
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-subtle);
  margin-bottom: 2px;
}
.mc-dx dd {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-brand);
}
.mc-note {
  font-size: var(--font-size-xs);
  color: var(--text-subtle);
  line-height: 1.6;
  margin-bottom: var(--space-4);
}
.mc-cta {
  width: 100%;
  justify-content: center;
  margin-bottom: var(--space-3);
}

/* ---------- Lưới tính năng ---------- */
.lp-feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-5);
}
.lp-feature {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast);
}
.lp-feature:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--border-brand);
}
.lp-feature-ic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  background: var(--brown-50);
  color: var(--brown-600);
  margin-bottom: var(--space-4);
}
.lp-feature-title {
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--text);
  margin-bottom: var(--space-2);
}
.lp-feature-desc {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  line-height: 1.6;
}

/* ---------- Kho tri thức ---------- */
.lp-knowledge {
  background: var(--surface-2);
  border-top: 1px solid var(--border);
}
.lp-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  margin-bottom: var(--space-10);
}
.lp-flow-step {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--text-brand);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  padding: 8px var(--space-4);
  border-radius: var(--radius-full);
}
.lp-flow-step--accent {
  color: var(--chip-method-fg);
  background: var(--chip-method-surface);
  border-color: var(--chip-method-border);
}
.lp-flow-arrow,
.lp-flow-plus {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--brown-400);
}
.lp-k-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-6);
}
.lp-k-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-top: 3px solid var(--k-fg, var(--brown-500));
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
}
.lp-k-panel.k-herb {
  --k-bg: var(--chip-herb-bg);
  --k-fg: var(--chip-herb-fg);
  --k-border: var(--chip-herb-border);
}
.lp-k-panel.k-pattern {
  --k-bg: var(--chip-pattern-bg);
  --k-fg: var(--chip-pattern-fg);
  --k-border: var(--chip-pattern-border);
}
.lp-k-panel.k-method {
  --k-bg: var(--chip-method-bg);
  --k-fg: var(--chip-method-fg);
  --k-border: var(--chip-method-border);
}
.lp-k-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.lp-k-ic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--k-bg);
  color: var(--k-fg);
}
.lp-k-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text);
}
.lp-k-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  flex: 1;
}
.lp-k-list li {
  display: flex;
  flex-direction: column;
  list-style: none;
  padding: var(--space-3);
  background: var(--k-bg);
  border: 1px solid var(--k-border);
  border-radius: var(--radius-md);
}
.lp-k-name {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--k-fg);
}
.lp-k-sub {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  margin-top: 1px;
}
.lp-k-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-muted);
  background: var(--surface-2);
  transition: all var(--transition-fast);
}
.lp-k-more:hover {
  color: var(--brown-700);
  border-color: var(--brown-300);
  background: var(--brown-50);
}
.lp-k-more svg {
  flex-shrink: 0;
}
/* Biến thể "xem thật" — không khoá, dùng màu thương hiệu để mời bấm. */
.lp-k-more--live {
  border-style: solid;
  border-color: var(--brown-300);
  color: var(--brown-700);
  background: var(--brown-50);
  font-weight: 700;
}
.lp-k-more--live:hover {
  color: var(--white);
  background: var(--brown-600);
  border-color: var(--brown-600);
}

/* ---------- Phân tích bài thuốc THẬT nhúng trên landing ---------- */
.lp-bt {
  margin-top: var(--space-8);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--space-6);
}
.lp-bt-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-bottom: var(--space-5);
}
.lp-bt-eyebrow {
  display: inline-block;
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--brown-600);
  margin-bottom: var(--space-2);
}
.lp-bt-title {
  font-size: var(--font-size-xl);
  font-weight: 800;
  color: var(--text-brand);
  letter-spacing: -0.01em;
}
.lp-bt-source {
  margin-top: 4px;
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}
.lp-bt-body {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: var(--space-6);
  align-items: start;
}
.lp-bt-table-wrap {
  overflow-x: auto;
}
.lp-bt-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}
.lp-bt-table th {
  background: var(--brown-50);
  color: var(--brown-700);
  font-weight: 700;
  font-size: var(--font-size-xs);
  padding: 8px 10px;
  text-align: left;
  border: 1px solid var(--border);
  white-space: nowrap;
}
.lp-bt-table td {
  padding: 8px 10px;
  border: 1px solid var(--border);
}
.bt-name {
  font-weight: 700;
  color: var(--text-brand);
  white-space: nowrap;
}
.bt-c {
  text-align: center;
  white-space: nowrap;
}
.bt-role {
  display: inline-block;
  font-size: var(--font-size-xs);
  font-weight: 700;
  padding: 2px 10px;
  border-radius: var(--radius-full);
}
.role-quan {
  background: var(--brown-700);
  color: var(--white);
}
.role-than {
  background: var(--brown-100);
  color: var(--brown-800);
  border: 1px solid var(--brown-300);
}
.role-ta {
  background: var(--surface-2);
  color: var(--text-muted);
  border: 1px solid var(--border-strong);
}
.role-su {
  background: var(--chip-method-bg, var(--brown-50));
  color: var(--chip-method-fg, var(--brown-700));
  border: 1px solid var(--chip-method-border, var(--brown-200));
}
.role-other {
  background: var(--surface-2);
  color: var(--text-muted);
}
.lp-bt-radar {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}
.lp-bt-radar-title {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--brown-700);
  margin-bottom: var(--space-3);
}
.lp-rb {
  display: grid;
  grid-template-columns: 78px 1fr 32px;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}
.lp-rb-name {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--text);
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lp-rb-track {
  position: relative;
  height: 12px;
  background: var(--gray-100);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.lp-rb-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(90deg, var(--brown-400), var(--brown-700));
  border-radius: var(--radius-full);
}
.lp-rb-val {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--text-subtle);
  text-align: right;
}
.lp-bt-note {
  margin-top: var(--space-4);
  font-size: var(--font-size-xs);
  color: var(--text-subtle);
  line-height: 1.6;
}
.lp-bt-note strong {
  color: var(--brown-700);
}
@media (max-width: 860px) {
  .lp-bt-body {
    grid-template-columns: 1fr;
  }
}

/* ---------- Dành cho ai ---------- */
.lp-audience-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-6);
}
.lp-audience-card {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-8) var(--space-6);
  text-align: center;
}
.lp-audience-ic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--brown-100), var(--brown-200));
  color: var(--brown-700);
  margin-bottom: var(--space-5);
}
.lp-audience-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text);
  margin-bottom: var(--space-2);
}
.lp-audience-desc {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  line-height: 1.7;
}

/* ---------- Lời kêu gọi ---------- */
.lp-cta {
  background: linear-gradient(135deg, var(--brown-600) 0%, var(--brown-800) 100%);
  color: var(--white);
}
.lp-cta-inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--space-16) var(--space-6);
  text-align: center;
}
.lp-cta-title {
  font-size: var(--font-size-3xl);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-bottom: var(--space-3);
}
.lp-cta-sub {
  font-size: var(--font-size-base);
  color: rgba(255, 255, 255, 0.82);
  margin-bottom: var(--space-8);
}

/* ---------- Chân trang ---------- */
.lp-footer {
  background: var(--brown-900);
  color: rgba(255, 255, 255, 0.7);
}
.lp-footer-inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.lp-brand--footer {
  cursor: default;
}
.lp-brand--footer .lp-brand-text {
  color: var(--white);
}
.lp-footer-note {
  font-size: var(--font-size-sm);
  color: rgba(255, 255, 255, 0.6);
}

/* ---------- Thư viện · Từ Điển ---------- */
.lp-library {
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--space-16) var(--space-6);
}
.lp-lib-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-5);
}
.lp-lib-card {
  display: flex;
  gap: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast);
}
.lp-lib-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--border-brand);
}
.lp-lib-ic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--brown-50);
  color: var(--brown-600);
}
.lp-lib-text {
  min-width: 0;
}
.lp-lib-title {
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--text);
  margin-bottom: var(--space-2);
}
.lp-lib-count {
  display: inline-block;
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--brown-700);
  background: var(--brown-50);
  border: 1px solid var(--brown-100);
  padding: 1px 8px;
  border-radius: var(--radius-full);
  margin-bottom: var(--space-2);
}
.lp-lib-desc {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  line-height: 1.6;
}
.lp-lib-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-10);
}
.lp-lib-note {
  font-size: var(--font-size-xs);
  color: var(--text-subtle);
}
@media (max-width: 1024px) {
  .lp-lib-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 560px) {
  .lp-lib-grid {
    grid-template-columns: 1fr;
  }
}

/* ---------- Responsive ---------- */
@media (max-width: 1024px) {
  .lp-feature-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .lp-k-grid {
    grid-template-columns: 1fr;
  }
  .lp-measure-card {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 860px) {
  .lp-hero-inner,
  .lp-model-inner {
    grid-template-columns: 1fr;
    text-align: center;
    padding: var(--space-12) var(--space-6);
  }
  .lp-hero-sub,
  .lp-model-sub {
    margin-left: auto;
    margin-right: auto;
  }
  .lp-cta-row,
  .lp-stats {
    justify-content: center;
  }
  .lp-hero-art {
    order: -1;
    min-height: 280px;
  }
  .lp-model-art {
    order: -1;
  }
  .lp-checks {
    text-align: left;
    max-width: 30rem;
    margin-left: auto;
    margin-right: auto;
  }
  .lp-audience-grid {
    grid-template-columns: 1fr;
  }
  .mc-readout {
    text-align: left;
  }
}
@media (max-width: 768px) {
  .lp-nav-links {
    display: none;
  }
  .lp-nav-inner {
    gap: var(--space-3);
  }
  .lp-brand {
    margin-right: auto;
  }
}
@media (max-width: 560px) {
  .lp-feature-grid {
    grid-template-columns: 1fr;
  }
  .lp-section,
  .lp-measure,
  .lp-knowledge,
  .lp-audience,
  .lp-cta-inner,
  .lp-hero-inner,
  .lp-model-inner {
    padding-top: var(--space-12);
    padding-bottom: var(--space-12);
  }
  .lp-stats {
    gap: var(--space-5);
  }
  .lp-measure-card {
    padding: var(--space-5);
  }
  .mc-row {
    grid-template-columns: 70px 1fr 52px;
    gap: var(--space-2);
  }
  .mc-name {
    font-size: var(--font-size-xs);
  }
}
</style>
