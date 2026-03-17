<script setup lang="ts">
import type { Patient } from '~/composables/usePatients'
import type { Examination, CreateExaminationDto } from '~/composables/useExaminations'
import {
  performFullDiagnosis,
  normalizeInputForDiagnosis,
  MERIDIAN_DISPLAY_ORDER,
  type DiagnosisResult,
  type MeridianStat
} from '~/composables/useDiagnosis'

const route = useRoute()
const patientId = Number(route.params.patientId)

const { fetchOne: fetchPatient } = usePatients()
const { create: createExamination } = useExaminations()

const patient = ref<Patient | null>(null)
const isLoadingPatient = ref(true)
const isSubmitting = ref(false)
const errorMsg = ref('')
const result = ref<Examination | null>(null)
const selectedModelIndex = ref(-1)
const activeBadgeType = ref<string | null>(null)
const hoverCategoryIds = ref<string[]>([])

// Mô tả huyệt đo (giống webapp)
const MERIDIAN_DESC: Record<string, string> = {
  tieutruong: 'Thiếu trạch (ngoài ngón út)',
  tam: 'Thiếu xung (trong ngón út)',
  tamtieu: 'Quan xung (ngoài ngón nhẫn)',
  tambao: 'Trung xung (ngoài ngón giữa)',
  daitrang: 'Thương dương (ngoài ngón trỏ)',
  phe: 'Thiếu thương (ngoài ngón cái)',
  bangquang: 'Chí âm (ngoài ngón út)',
  than: 'Nội chí âm (trong ngón út)',
  dam: 'Khiếu âm (ngoài ngón thứ 4)',
  vi: 'Lệ đoài (ngoài ngón thứ 2)',
  can: 'Đại đôn (ngoài ngón cái)',
  ty: 'Ẩn bạch (trong ngón cái)',
}

/** Input cho diagnosis: từ result.inputData hoặc build từ result.flags theo channelName */
function getDiagnosisInput(exam: Examination): Record<string, number> {
  if (exam.inputData && Object.keys(exam.inputData).length > 0) {
    return exam.inputData
  }
  const out: Record<string, number> = {}
  ;(exam.flags ?? []).forEach((f) => {
    const id = f.channelName
    if (id) {
      out[id + 'trai'] = f.L
      out[id + 'phai'] = f.R
    }
  })
  return out
}

const diag = computed<DiagnosisResult | null>(() => {
  if (!result.value) return null
  const input = getDiagnosisInput(result.value)
  const normalized = normalizeInputForDiagnosis(input)
  return performFullDiagnosis(normalized)
})

const baselineCounts = computed(() => {
  const d = diag.value
  if (!d) {
    return {
      nhietTren: 0, hanTren: 0,
      nhietDuoi: 0, hanDuoi: 0,
    }
  }
  let nhietTren = 0, hanTren = 0, nhietDuoi = 0, hanDuoi = 0
  for (const [id, s] of Object.entries(d.meridianStats)) {
    const bc = s.batCuong || ''
    const isNhiet = bc.includes('Nhiệt')
    const isHan = bc.includes('Hàn')
    if (s.group === 'tren') {
      if (isNhiet) nhietTren++
      if (isHan) hanTren++
    } else {
      if (isNhiet) nhietDuoi++
      if (isHan) hanDuoi++
    }
  }
  return { nhietTren, hanTren, nhietDuoi, hanDuoi }
})

const summaryCounts = computed(() => {
  const d = diag.value
  if (!d) {
    return { cntThuc: 0, cntHu: 0, cntLy: 0, cntBieu: 0, cntNhiet: 0, cntHan: 0 }
  }
  const cntThuc = Object.values(d.meridianStats).filter(s => s.leftStatus === '+' || s.rightStatus === '+').length
  const cntHu = Object.values(d.meridianStats).filter(s => s.leftStatus === '-' || s.rightStatus === '-').length
  const cntLy = d.categories.lyNhiet.length + d.categories.lyHan.length
  const cntBieu = d.categories.bieuNhiet.length + d.categories.bieuHan.length
  const cntNhiet = d.categories.lyNhiet.length + d.categories.bieuNhiet.length
  const cntHan = d.categories.lyHan.length + d.categories.bieuHan.length
  return { cntThuc, cntHu, cntLy, cntBieu, cntNhiet, cntHan }
})

const showBcCol = computed(() => !!activeBadgeType.value && !['am', 'duong'].includes(activeBadgeType.value))
const showCompCol = computed(() => selectedModelIndex.value >= 0)

const handRows = computed(() => {
  if (!diag.value) return []
  return MERIDIAN_DISPLAY_ORDER.filter(m => m.group === 'tren').map(m => ({
    id: m.id,
    name: m.n,
    desc: MERIDIAN_DESC[m.id] || '',
    group: m.group,
    stat: diag.value!.meridianStats[m.id]
  })).filter(r => r.stat)
})

const footRows = computed(() => {
  if (!diag.value) return []
  return MERIDIAN_DISPLAY_ORDER.filter(m => m.group === 'duoi').map(m => ({
    id: m.id,
    name: m.n,
    desc: MERIDIAN_DESC[m.id] || '',
    group: m.group,
    stat: diag.value!.meridianStats[m.id]
  })).filter(r => r.stat)
})

const nameToId: Record<string, string> = {
  ...Object.fromEntries(MERIDIAN_DISPLAY_ORDER.map(m => [m.n, m.id])),
  Đởm: 'dam' // diagnosis trả về Đởm, display dùng Đảm
}

function getIds(names: string[]): string[] {
  return names.map(n => nameToId[n]).filter(Boolean)
}

function rowMatchesBadge(stat: MeridianStat, group: string, type: string): boolean {
  switch (type) {
    case 'duong': return group === 'tren'
    case 'am': return group === 'duoi'
    case 'bieu': return (stat.batCuong || '').includes('Biểu')
    case 'ly': return (stat.batCuong || '').includes('Lý')
    case 'han': return (stat.batCuong || '').includes('Hàn')
    case 'nhiet': return (stat.batCuong || '').includes('Nhiệt')
    case 'hu': return stat.leftStatus === '-' || stat.rightStatus === '-'
    case 'thuc': return stat.leftStatus === '+' || stat.rightStatus === '+'
    default: return false
  }
}

function getRowHighlightClass(meridianId: string, stat: MeridianStat, group: string): string {
  if (hoverCategoryIds.value.length > 0) {
    return hoverCategoryIds.value.includes(meridianId) ? 'row-highlight' : 'row-dimmed'
  }
  if (activeBadgeType.value) {
    return rowMatchesBadge(stat, group, activeBadgeType.value) ? 'row-highlight' : 'row-dimmed'
  }
  return ''
}

function getRowHighlightStyle(meridianId: string, stat: MeridianStat, group: string): Record<string, string> {
  if (hoverCategoryIds.value.length > 0) {
    if (hoverCategoryIds.value.includes(meridianId)) return { background: '#A62B2B22', boxShadow: 'inset 4px 0 0 0 #A62B2B' }
    return {}
  }
  if (!activeBadgeType.value || !rowMatchesBadge(stat, group, activeBadgeType.value)) return {}
  const bc = stat.batCuong || ''
  if (bc.includes('Nhiệt')) return { background: '#8B1A1A18', boxShadow: 'inset 4px 0 0 0 #8B1A1A' }
  if (bc.includes('Hàn')) return { background: '#1A527618', boxShadow: 'inset 4px 0 0 0 #1A5276' }
  if (bc.includes('Lý')) return { background: '#FDF0E8', boxShadow: 'inset 4px 0 0 0 #8B7355' }
  if (bc) return { background: '#F0EBE018', boxShadow: 'inset 4px 0 0 0 #C4B598' }
  if (group === 'tren' || group === 'duoi') return { background: '#F5F0E8', boxShadow: 'inset 4px 0 0 0 #C4B598' }
  return {}
}

function getBatCuongRowColor(batCuong: string): string {
  if (batCuong.includes('Nhiệt')) return '#8B1A1A'
  if (batCuong.includes('Hàn')) return '#1A5276'
  return '#5B4A3A'
}

function toggleBadge(type: string) {
  if (activeBadgeType.value === type) {
    activeBadgeType.value = null
  } else {
    activeBadgeType.value = type
  }
}

function onCategoryEnter(ids: string[]) {
  hoverCategoryIds.value = ids
}

function onCategoryLeave() {
  hoverCategoryIds.value = []
}

const loadPatient = async () => {
  isLoadingPatient.value = true
  try {
    patient.value = await fetchPatient(patientId)
  }
  catch {
    patient.value = null
  }
  finally {
    isLoadingPatient.value = false
  }
}

await loadPatient()

useSeoMeta({
  title: computed(() => patient.value ? `Khám bệnh - ${patient.value.fullName} | Hệ thống Y tế` : 'Khám bệnh | Hệ thống Y tế'),
  description: 'Khám và phân tích kinh lạc bệnh nhân'
})

const CHANNEL_GROUPS = [
  {
    title: 'Kinh tay (Chi trên)',
    channels: [
      { key: 'tieutruong', label: 'Tiểu trường' },
      { key: 'tam', label: 'Tâm' },
      { key: 'tamtieu', label: 'Tam tiêu' },
      { key: 'tambao', label: 'Tâm bào' },
      { key: 'daitrang', label: 'Đại tràng' },
      { key: 'phe', label: 'Phế' }
    ]
  },
  {
    title: 'Kinh chân (Chi dưới)',
    channels: [
      { key: 'bangquang', label: 'Bàng quang' },
      { key: 'than', label: 'Thận' },
      { key: 'dam', label: 'Đảm' },
      { key: 'vi', label: 'Vị' },
      { key: 'can', label: 'Can' },
      { key: 'ty', label: 'Tỳ' }
    ]
  }
]

const CHANNEL_LABEL_MAP: Record<string, string> = {
  tieutruong: 'Tiểu trường',
  tam: 'Tâm',
  tamtieu: 'Tam tiêu',
  tambao: 'Tâm bào',
  daitrang: 'Đại tràng',
  phe: 'Phế',
  bangquang: 'Bàng quang',
  than: 'Thận',
  dam: 'Đảm',
  vi: 'Vị',
  can: 'Can',
  ty: 'Tỳ'
}

const form = reactive<Record<string, number | string>>({
  tieutruongtrai: 0, tieutruongphai: 0,
  tamtrai: 0, tamphai: 0,
  tamtieutrai: 0, tamtieuphai: 0,
  tambaotrai: 0, tambaophai: 0,
  daitrangtrai: 0, daitrangphai: 0,
  phetrai: 0, phephai: 0,
  bangquangtrai: 0, bangquangphai: 0,
  thantrai: 0, thanphai: 0,
  damtrai: 0, damphai: 0,
  vitrai: 0, viphai: 0,
  cantrai: 0, canphai: 0,
  tytrai: 0, typhai: 0,
  notes: ''
})

const handleSubmit = async () => {
  errorMsg.value = ''
  isSubmitting.value = true
  result.value = null

  try {
    const dto: CreateExaminationDto = {
      patientId,
      notes: (form.notes as string) || undefined,
      tieutruongtrai: Number(form.tieutruongtrai),
      tieutruongphai: Number(form.tieutruongphai),
      tamtrai: Number(form.tamtrai),
      tamphai: Number(form.tamphai),
      tamtieutrai: Number(form.tamtieutrai),
      tamtieuphai: Number(form.tamtieuphai),
      tambaotrai: Number(form.tambaotrai),
      tambaophai: Number(form.tambaophai),
      daitrangtrai: Number(form.daitrangtrai),
      daitrangphai: Number(form.daitrangphai),
      phetrai: Number(form.phetrai),
      phephai: Number(form.phephai),
      bangquangtrai: Number(form.bangquangtrai),
      bangquangphai: Number(form.bangquangphai),
      thantrai: Number(form.thantrai),
      thanphai: Number(form.thanphai),
      damtrai: Number(form.damtrai),
      damphai: Number(form.damphai),
      vitrai: Number(form.vitrai),
      viphai: Number(form.viphai),
      cantrai: Number(form.cantrai),
      canphai: Number(form.canphai),
      tytrai: Number(form.tytrai),
      typhai: Number(form.typhai),
    }
    result.value = await createExamination(dto)
  }
  catch {
    errorMsg.value = 'Có lỗi xảy ra khi phân tích. Vui lòng thử lại.'
  }
  finally {
    isSubmitting.value = false
  }
}

const flagLabel = (val: number): string => {
  if (val > 0) return 'Thịnh'
  if (val < 0) return 'Hư'
  return 'BT'
}

const flagClass = (val: number): string => {
  if (val > 0) return 'flag--high'
  if (val < 0) return 'flag--low'
  return 'flag--normal'
}

const statusClass = (val: string): string => {
  if (val.includes('hư') || val.includes('Hư')) return 'status--warn'
  if (val.includes('thịnh') || val.includes('Thịnh')) return 'status--warn'
  return 'status--ok'
}
</script>

<template>
  <div class="examine-page">
    <!-- Loading -->
    <div v-if="isLoadingPatient" class="loading-state">
      <UIcon name="i-lucide-loader-2" class="loading-icon animate-spin" />
      <span>Đang tải dữ liệu...</span>
    </div>

    <!-- Not found -->
    <div v-else-if="!patient" class="empty-state">
      <UIcon name="i-lucide-user-x" class="empty-icon" />
      <span>Không tìm thấy bệnh nhân</span>
      <NuxtLink to="/patients" class="back-link">Quay lại danh sách</NuxtLink>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <NuxtLink :to="`/patients/${patient.id}`" class="back-btn">
            <UIcon name="i-lucide-arrow-left" />
          </NuxtLink>
          <div class="header-info">
            <div class="patient-avatar">{{ patient.fullName.charAt(0) }}</div>
            <div>
              <h1 class="page-title">Khám bệnh</h1>
              <p class="page-subtitle">{{ patient.fullName }} · {{ patient.gender }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Input Form -->
      <div v-if="!result" class="form-section">
        <div v-for="(group, gIdx) in CHANNEL_GROUPS" :key="group.title" class="input-table-card">
          <div class="input-table-header">
            <div class="input-table-header-left">
              <UIcon name="i-lucide-activity" class="input-table-icon" />
              <h2 class="input-table-title">{{ group.title }}</h2>
            </div>
            <span class="input-table-hint">{{ gIdx === 0 ? '6 kinh' : '6 kinh' }}</span>
          </div>
          <table class="input-table">
            <thead>
              <tr>
                <th class="col-stt">#</th>
                <th class="col-name">Kinh</th>
                <th class="col-val">Trái</th>
                <th class="col-val">Phải</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(ch, idx) in group.channels" :key="ch.key">
                <td class="cell-stt">{{ gIdx * 6 + idx + 1 }}</td>
                <td class="cell-channel">{{ ch.label }}</td>
                <td class="cell-input">
                  <input
                    v-model.number="form[`${ch.key}trai`]"
                    class="ch-input"
                    type="number"
                    min="0"
                    step="1"
                    @focus="($event.target as HTMLInputElement).select()"
                  >
                </td>
                <td class="cell-input">
                  <input
                    v-model.number="form[`${ch.key}phai`]"
                    class="ch-input"
                    type="number"
                    min="0"
                    step="1"
                    @focus="($event.target as HTMLInputElement).select()"
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Notes -->
        <div class="notes-card">
          <label class="form-label">
            <UIcon name="i-lucide-notebook-pen" class="notes-icon" />
            Ghi chú
          </label>
          <textarea
            v-model="form.notes"
            class="form-textarea"
            rows="2"
            placeholder="Ghi chú thêm cho ca khám này..."
          />
        </div>

        <!-- Error -->
        <Transition name="fade">
          <div v-if="errorMsg" class="error-msg">
            <UIcon name="i-lucide-alert-circle" class="error-icon" />
            {{ errorMsg }}
          </div>
        </Transition>

        <!-- Submit -->
        <div class="submit-bar">
          <NuxtLink :to="`/patients/${patient.id}`" class="btn-cancel">Hủy</NuxtLink>
          <button class="btn-submit" :disabled="isSubmitting" @click="handleSubmit">
            <span v-if="isSubmitting" class="btn-loading">
              <UIcon name="i-lucide-loader-2" class="animate-spin" /> Đang phân tích...
            </span>
            <span v-else class="btn-loading">
              <UIcon name="i-lucide-scan-search" class="btn-icon" />
              Phân tích & Lưu kết quả
            </span>
          </button>
        </div>
      </div>

      <!-- Results – layout giống webapp: 2 cột, I + II + III -->
      <div v-else class="results-section analysis-layout">
        <!-- Report header -->
        <div class="report-header">
          <h2 class="report-title">KẾT QUẢ ĐO KINH LẠC</h2>
          <p class="report-subtitle">Hệ thống chẩn đoán kỹ thuật số</p>
        </div>

        <!-- Patient info box -->
        <div class="patient-info-box">
          <div><strong>Họ và Tên:</strong> {{ patient.fullName }}</div>
          <div><strong>Năm sinh:</strong> {{ patient.dateOfBirth ? new Date(patient.dateOfBirth).getFullYear() : 'N/A' }}</div>
          <div><strong>Giới tính:</strong> {{ patient.gender }}</div>
          <div><strong>Huyết áp:</strong> N/A</div>
          <div><strong>BMI:</strong> N/A</div>
          <div><strong>Ngày đo:</strong> {{ new Date(result.createdAt).toLocaleDateString('vi-VN') }}</div>
        </div>

        <div class="analysis-grid">
          <!-- Cột trái: I. SỐ LIỆU ĐO KINH LẠC -->
          <div class="analysis-left">
            <div class="section-card report-card">
              <div class="section-title section-title-i">I. SỐ LIỆU ĐO KINH LẠC</div>

              <!-- HỆ SỐ CHUẨN CHI TRÊN / CHI DƯỚI (giống webapp: 3 cột số + cột màu + nhãn) -->
              <div v-if="diag" class="stats-summary">
                <div class="baseline-box">
                  <div class="baseline-head">HỆ SỐ CHUẨN CHI TRÊN TAY (THỦ)</div>
                  <div class="baseline-rowwrap">
                    <div class="baseline-numcol">
                      <span class="baseline-other">{{ diag.baselines.max_tren.toFixed(2) }}</span>
                      <span class="baseline-up">{{ diag.baselines.up_tren.toFixed(2) }}</span>
                      <span class="baseline-avg">{{ diag.baselines.avg_tren.toFixed(2) }}</span>
                      <span class="baseline-low">{{ diag.baselines.low_tren.toFixed(2) }}</span>
                      <span class="baseline-other">{{ diag.baselines.min_tren.toFixed(2) }}</span>
                    </div>
                    <div class="zone-bar-col">
                      <div class="zone-nhiet" />
                      <div class="zone-binh">
                        <div class="zone-midline" />
                      </div>
                      <div class="zone-han" />
                    </div>
                    <div class="baseline-labelcol">
                      <div class="zone-label-nhiet">NHIỆT ({{ baselineCounts.nhietTren }})</div>
                      <div class="zone-label-binh">Bình thường<br>(sinh lý)</div>
                      <div class="zone-label-han">HÀN ({{ baselineCounts.hanTren }})</div>
                    </div>
                  </div>
                </div>

                <div class="baseline-box">
                  <div class="baseline-head">HỆ SỐ CHUẨN CHI DƯỚI CHÂN (TÚC)</div>
                  <div class="baseline-rowwrap">
                    <div class="baseline-numcol">
                      <span class="baseline-other">{{ diag.baselines.max_duoi.toFixed(2) }}</span>
                      <span class="baseline-up">{{ diag.baselines.up_duoi.toFixed(2) }}</span>
                      <span class="baseline-avg">{{ diag.baselines.avg_duoi.toFixed(2) }}</span>
                      <span class="baseline-low">{{ diag.baselines.low_duoi.toFixed(2) }}</span>
                      <span class="baseline-other">{{ diag.baselines.min_duoi.toFixed(2) }}</span>
                    </div>
                    <div class="zone-bar-col">
                      <div class="zone-nhiet" />
                      <div class="zone-binh">
                        <div class="zone-midline" />
                      </div>
                      <div class="zone-han" />
                    </div>
                    <div class="baseline-labelcol">
                      <div class="zone-label-nhiet">NHIỆT ({{ baselineCounts.nhietDuoi }})</div>
                      <div class="zone-label-binh">Bình thường<br>(sinh lý)</div>
                      <div class="zone-label-han">HÀN ({{ baselineCounts.hanDuoi }})</div>
                    </div>
                  </div>
                </div>
              </div>

              <h4 class="table-subtitle">CHI TRÊN (TAY)</h4>
              <table class="classic-table">
                <thead>
                  <tr>
                    <th rowspan="2" class="col-kinh">Kinh Mạch / Huyệt Đo</th>
                    <th colspan="2" class="col-left">Trái (L)</th>
                    <th rowspan="2">Trị L</th>
                    <th rowspan="2" class="col-tb">Trung Bình</th>
                    <th rowspan="2">Chênh</th>
                    <th rowspan="2">Trị R</th>
                    <th colspan="2" class="col-right">Phải (R)</th>
                    <th rowspan="2">Lệch (L - R)</th>
                    <th rowspan="2" class="bc-col" :style="showBcCol ? {} : { display: 'none' }">Bát Cương &amp; Chẩn đoán</th>
                    <th rowspan="2" class="comp-col" :style="showCompCol ? {} : { display: 'none' }">Biện chứng<br>Luận trị</th>
                  </tr>
                  <tr class="sub-header">
                    <th class="plus">(+)</th>
                    <th class="minus">(-)</th>
                    <th class="plus">(+)</th>
                    <th class="minus">(-)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in handRows"
                    :key="row.id"
                    :class="getRowHighlightClass(row.id, row.stat, row.group)"
                    :style="getRowHighlightStyle(row.id, row.stat, row.group)"
                    :data-meridian-id="row.id"
                    :data-group="row.group"
                    :data-bat-cuong="row.stat.batCuong"
                    :data-is-hu="(row.stat.leftStatus === '-' || row.stat.rightStatus === '-') ? '1' : '0'"
                    :data-is-thuc="(row.stat.leftStatus === '+' || row.stat.rightStatus === '+') ? '1' : '0'"
                  >
                    <td class="cell-kinh">
                      <div class="kinh-name">{{ row.name }}</div>
                      <div class="kinh-desc">{{ row.desc }}</div>
                    </td>
                    <td class="cell-plus">{{ row.stat.leftStatus === '+' ? row.stat.leftValue.toFixed(1) : '—' }}</td>
                    <td class="cell-minus">{{ row.stat.leftStatus === '-' ? row.stat.leftValue.toFixed(1) : '—' }}</td>
                    <td>{{ row.stat.leftValue ? row.stat.leftValue.toFixed(1) : '—' }}</td>
                    <td class="cell-tb">{{ row.stat.avg.toFixed(2) }}</td>
                    <td class="cell-diff">{{ row.stat.diff !== 0 ? row.stat.diff.toFixed(2) : '' }}</td>
                    <td>{{ row.stat.rightValue ? row.stat.rightValue.toFixed(1) : '—' }}</td>
                    <td class="cell-plus">{{ row.stat.rightStatus === '+' ? row.stat.rightValue.toFixed(1) : '—' }}</td>
                    <td class="cell-minus">{{ row.stat.rightStatus === '-' ? row.stat.rightValue.toFixed(1) : '—' }}</td>
                    <td>{{ row.stat.absDelta.toFixed(2) }}</td>
                    <td class="bc-col bc-cell" :style="showBcCol ? {} : { display: 'none' }">
                      {{ row.stat.batCuong || '—' }}
                    </td>
                    <td class="comp-col comp-cell" :style="showCompCol ? {} : { display: 'none' }">
                      <span v-if="showCompCol">✓</span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <h4 class="table-subtitle">CHI DƯỚI (CHÂN)</h4>
              <table class="classic-table">
                <thead>
                  <tr>
                    <th rowspan="2" class="col-kinh">Kinh Mạch / Huyệt Đo</th>
                    <th colspan="2" class="col-left">Trái (L)</th>
                    <th rowspan="2">Trị L</th>
                    <th rowspan="2" class="col-tb">Trung Bình</th>
                    <th rowspan="2">Chênh</th>
                    <th rowspan="2">Trị R</th>
                    <th colspan="2" class="col-right">Phải (R)</th>
                    <th rowspan="2">Lệch (L - R)</th>
                    <th rowspan="2" class="bc-col" :style="showBcCol ? {} : { display: 'none' }">Bát Cương &amp; Chẩn đoán</th>
                    <th rowspan="2" class="comp-col" :style="showCompCol ? {} : { display: 'none' }">Biện chứng<br>Luận trị</th>
                  </tr>
                  <tr class="sub-header">
                    <th class="plus">(+)</th>
                    <th class="minus">(-)</th>
                    <th class="plus">(+)</th>
                    <th class="minus">(-)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in footRows"
                    :key="row.id"
                    :class="getRowHighlightClass(row.id, row.stat, row.group)"
                    :style="getRowHighlightStyle(row.id, row.stat, row.group)"
                    :data-meridian-id="row.id"
                    :data-group="row.group"
                    :data-bat-cuong="row.stat.batCuong"
                    :data-is-hu="(row.stat.leftStatus === '-' || row.stat.rightStatus === '-') ? '1' : '0'"
                    :data-is-thuc="(row.stat.leftStatus === '+' || row.stat.rightStatus === '+') ? '1' : '0'"
                  >
                    <td class="cell-kinh">
                      <div class="kinh-name">{{ row.name }}</div>
                      <div class="kinh-desc">{{ row.desc }}</div>
                    </td>
                    <td class="cell-plus">{{ row.stat.leftStatus === '+' ? row.stat.leftValue.toFixed(1) : '—' }}</td>
                    <td class="cell-minus">{{ row.stat.leftStatus === '-' ? row.stat.leftValue.toFixed(1) : '—' }}</td>
                    <td>{{ row.stat.leftValue ? row.stat.leftValue.toFixed(1) : '—' }}</td>
                    <td class="cell-tb">{{ row.stat.avg.toFixed(2) }}</td>
                    <td class="cell-diff">{{ row.stat.diff !== 0 ? row.stat.diff.toFixed(2) : '' }}</td>
                    <td>{{ row.stat.rightValue ? row.stat.rightValue.toFixed(1) : '—' }}</td>
                    <td class="cell-plus">{{ row.stat.rightStatus === '+' ? row.stat.rightValue.toFixed(1) : '—' }}</td>
                    <td class="cell-minus">{{ row.stat.rightStatus === '-' ? row.stat.rightValue.toFixed(1) : '—' }}</td>
                    <td>{{ row.stat.absDelta.toFixed(2) }}</td>
                    <td class="bc-col bc-cell" :style="showBcCol ? {} : { display: 'none' }">
                      {{ row.stat.batCuong || '—' }}
                    </td>
                    <td class="comp-col comp-cell" :style="showCompCol ? {} : { display: 'none' }">
                      <span v-if="showCompCol">✓</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Cột phải: II + III (sticky) -->
          <div class="analysis-right">
            <!-- II. KẾT LUẬN BÁT CƯƠNG & CHẨN ĐOÁN (logic giống webapp) -->
            <div class="section-card conclusion-card">
              <div class="section-title section-title-ii">II. KẾT LUẬN BÁT CƯƠNG & CHẨN ĐOÁN</div>

              <template v-if="diag">
                <!-- 8 badge Bát Cương - ấn vào highlight bảng -->
                <div class="bat-cuong-grid">
                  <div class="grid-caption">Âm · Dương</div>
                  <div class="grid-caption">Biểu · Lý</div>
                  <div class="grid-caption">Hàn · Nhiệt</div>
                  <div class="grid-caption">Hư · Thực</div>
                  <button
                    type="button"
                    class="bat-cuong-badge"
                    :class="[
                      { 'badge-active': activeBadgeType === 'am' },
                      { 'badge-result badge-result-am': diag.batCuongTong.amDuong === 'ÂM THỊNH' }
                    ]"
                    :style="activeBadgeType === 'am' ? { borderColor: '#2C4A6E', boxShadow: '0 0 12px #2C4A6E55', background: '#2C4A6E12', color: '#2C4A6E' } : {}"
                    @click="toggleBadge('am')"
                  >
                    <span class="badge-name">ÂM</span>
                    <span class="badge-sub">Avg: {{ diag.baselines.avg_duoi.toFixed(2) }}</span>
                  </button>
                  <button
                    type="button"
                    class="bat-cuong-badge"
                    :class="[
                      { 'badge-active': activeBadgeType === 'bieu' },
                      { 'badge-result badge-result-bieu': diag.batCuongTong.bieuLy === 'BIỂU' }
                    ]"
                    :style="activeBadgeType === 'bieu' ? { borderColor: '#A0632C', boxShadow: '0 0 12px #A0632C55', background: '#A0632C12', color: '#A0632C' } : {}"
                    @click="toggleBadge('bieu')"
                  >
                    <span class="badge-name">BIỂU</span>
                    <span class="badge-sub">{{ diag.categories.bieuNhiet.length + diag.categories.bieuHan.length }} kinh</span>
                  </button>
                  <button
                    type="button"
                    class="bat-cuong-badge"
                    :class="[
                      { 'badge-active': activeBadgeType === 'han' },
                      { 'badge-result badge-result-han': diag.batCuongTong.hanNhiet === 'HÀN' }
                    ]"
                    :style="activeBadgeType === 'han' ? { borderColor: '#1A5276', boxShadow: '0 0 12px #1A527655', background: '#1A527612', color: '#1A5276' } : {}"
                    @click="toggleBadge('han')"
                  >
                    <span class="badge-name">HÀN</span>
                    <span class="badge-sub">{{ diag.categories.lyHan.length + diag.categories.bieuHan.length }} kinh</span>
                  </button>
                  <button
                    type="button"
                    class="bat-cuong-badge"
                    :class="[
                      { 'badge-active': activeBadgeType === 'hu' },
                      { 'badge-result badge-result-hu': diag.batCuongTong.huThuc === 'HƯ' }
                    ]"
                    :style="activeBadgeType === 'hu' ? { borderColor: '#2D5A27', boxShadow: '0 0 12px #2D5A2755', background: '#2D5A2712', color: '#2D5A27' } : {}"
                    @click="toggleBadge('hu')"
                  >
                    <span class="badge-name">HƯ</span>
                    <span class="badge-sub">{{ Object.values(diag.meridianStats).filter(s => s.leftStatus === '-' || s.rightStatus === '-').length }} kinh</span>
                  </button>
                  <button
                    type="button"
                    class="bat-cuong-badge"
                    :class="[
                      { 'badge-active': activeBadgeType === 'duong' },
                      { 'badge-result badge-result-duong': diag.batCuongTong.amDuong === 'DƯƠNG THỊNH' }
                    ]"
                    :style="activeBadgeType === 'duong' ? { borderColor: '#8B1A1A', boxShadow: '0 0 12px #8B1A1A55', background: '#8B1A1A12', color: '#8B1A1A' } : {}"
                    @click="toggleBadge('duong')"
                  >
                    <span class="badge-name">DƯƠNG</span>
                    <span class="badge-sub">Avg: {{ diag.baselines.avg_tren.toFixed(2) }}</span>
                  </button>
                  <button
                    type="button"
                    class="bat-cuong-badge"
                    :class="[
                      { 'badge-active': activeBadgeType === 'ly' },
                      { 'badge-result badge-result-ly': diag.batCuongTong.bieuLy === 'LÝ' }
                    ]"
                    :style="activeBadgeType === 'ly' ? { borderColor: '#7A1B3D', boxShadow: '0 0 12px #7A1B3D55', background: '#7A1B3D12', color: '#7A1B3D' } : {}"
                    @click="toggleBadge('ly')"
                  >
                    <span class="badge-name">LÝ</span>
                    <span class="badge-sub">{{ diag.categories.lyNhiet.length + diag.categories.lyHan.length }} kinh</span>
                  </button>
                  <button
                    type="button"
                    class="bat-cuong-badge"
                    :class="[
                      { 'badge-active': activeBadgeType === 'nhiet' },
                      { 'badge-result badge-result-nhiet': diag.batCuongTong.hanNhiet === 'NHIỆT' }
                    ]"
                    :style="activeBadgeType === 'nhiet' ? { borderColor: '#A62B2B', boxShadow: '0 0 12px #A62B2B55', background: '#A62B2B12', color: '#A62B2B' } : {}"
                    @click="toggleBadge('nhiet')"
                  >
                    <span class="badge-name">NHIỆT</span>
                    <span class="badge-sub">{{ diag.categories.lyNhiet.length + diag.categories.bieuNhiet.length }} kinh</span>
                  </button>
                  <button
                    type="button"
                    class="bat-cuong-badge"
                    :class="[
                      { 'badge-active': activeBadgeType === 'thuc' },
                      { 'badge-result badge-result-thuc': diag.batCuongTong.huThuc === 'THỰC' }
                    ]"
                    :style="activeBadgeType === 'thuc' ? { borderColor: '#8B4513', boxShadow: '0 0 12px #8B451355', background: '#8B451312', color: '#8B4513' } : {}"
                    @click="toggleBadge('thuc')"
                  >
                    <span class="badge-name">THỰC</span>
                    <span class="badge-sub">{{ Object.values(diag.meridianStats).filter(s => s.leftStatus === '+' || s.rightStatus === '+').length }} kinh</span>
                  </button>
                </div>

                <!-- Kết luận (box) giống webapp -->
                <div class="conclusion-box">
                  <span class="conclusion-box-label">Kết luận:</span>
                  <!-- Giống webapp: Bát cương tổng 4 trục -->
                  <span
                    class="conclusion-box-val"
                    :class="diag.batCuongTong.amDuong === 'DƯƠNG THỊNH' ? 'val-duong' : (diag.batCuongTong.amDuong === 'ÂM THỊNH' ? 'val-am' : '')"
                  >{{ diag.batCuongTong.amDuong }}</span>
                  <span class="conclusion-box-sep">•</span>
                  <span
                    class="conclusion-box-val"
                    :class="diag.batCuongTong.bieuLy === 'LÝ' ? 'val-ly' : 'val-bieu'"
                  >{{ diag.batCuongTong.bieuLy }}</span>
                  <span class="conclusion-box-sep">•</span>
                  <span
                    class="conclusion-box-val"
                    :class="diag.batCuongTong.hanNhiet === 'NHIỆT' ? 'val-nhiet' : 'val-han'"
                  >{{ diag.batCuongTong.hanNhiet }}</span>
                  <span class="conclusion-box-sep">•</span>
                  <span
                    class="conclusion-box-val"
                    :class="diag.batCuongTong.huThuc === 'THỰC' ? 'val-thuc' : 'val-hu'"
                  >{{ diag.batCuongTong.huThuc }}</span>
                </div>

                <div class="khi-huyet-box">
                  <span class="conclusion-box-label">KHÍ / HUYẾT:</span>
                  <!-- Giống webapp: ghép Âm/Dương + Khí + Huyết -->
                  <span class="khi-huyet-val">{{ diag.khihuyetConclusion || '—' }}</span>
                </div>

                <!-- Hàng nhóm kinh - hover highlight bảng -->
                <div
                  v-if="diag.categories.lyNhiet.length > 0"
                  class="cat-row"
                  @mouseenter="onCategoryEnter(getIds(diag.categories.lyNhiet))"
                  @mouseleave="onCategoryLeave()"
                >
                  <span class="cat-tag cat-lynhiet">Lý Nhiệt</span>
                  <span class="cat-names">{{ diag.categories.lyNhiet.join(', ') }}</span>
                </div>
                <div
                  v-if="diag.categories.bieuNhiet.length > 0"
                  class="cat-row"
                  @mouseenter="onCategoryEnter(getIds(diag.categories.bieuNhiet))"
                  @mouseleave="onCategoryLeave()"
                >
                  <span class="cat-tag cat-bieunhiet">Biểu Nhiệt</span>
                  <span class="cat-names">{{ diag.categories.bieuNhiet.join(', ') }}</span>
                </div>
                <div
                  v-if="diag.categories.lyHan.length > 0"
                  class="cat-row"
                  @mouseenter="onCategoryEnter(getIds(diag.categories.lyHan))"
                  @mouseleave="onCategoryLeave()"
                >
                  <span class="cat-tag cat-lyhan">Lý Hàn</span>
                  <span class="cat-names">{{ diag.categories.lyHan.join(', ') }}</span>
                </div>
                <div
                  v-if="diag.categories.bieuHan.length > 0"
                  class="cat-row"
                  @mouseenter="onCategoryEnter(getIds(diag.categories.bieuHan))"
                  @mouseleave="onCategoryLeave()"
                >
                  <span class="cat-tag cat-bieuhan">Biểu Hàn</span>
                  <span class="cat-names">{{ diag.categories.bieuHan.join(', ') }}</span>
                </div>
                <div v-if="!diag.categories.lyNhiet.length && !diag.categories.bieuNhiet.length && !diag.categories.lyHan.length && !diag.categories.bieuHan.length" class="cat-empty">
                  Không phát hiện bất thường đáng kể.
                </div>

                <!-- Conclusion detail giống webapp: hiện nội dung theo badge đang chọn -->
                <div class="conclusion-detail">
                  <span class="conc-part" :class="diag.batCuongTong.amDuong === 'DƯƠNG THỊNH' ? 'val-duong' : 'val-am'">[{{ diag.batCuongTong.amDuong }}]</span>
                  <span class="conc-sep-dash"> — </span>
                  <span class="conc-part" :class="diag.batCuongTong.bieuLy === 'LÝ' ? 'val-ly' : 'val-bieu'">[{{ diag.batCuongTong.bieuLy }}]</span>
                  <span class="conc-sep-dash"> — </span>
                  <span class="conc-part" :class="diag.batCuongTong.hanNhiet === 'NHIỆT' ? 'val-nhiet' : 'val-han'">[{{ diag.batCuongTong.hanNhiet }}]</span>
                  <span class="conc-sep-dash"> — </span>
                  <span class="conc-part" :class="diag.batCuongTong.huThuc === 'THỰC' ? 'val-thuc' : 'val-hu'">[{{ diag.batCuongTong.huThuc }}]</span>
                  <br>
                  <span v-show="activeBadgeType === 'hu' || activeBadgeType === 'thuc'" class="conc-extra">
                    Ghi nhận {{ summaryCounts.cntThuc }} kinh Thực (+), {{ summaryCounts.cntHu }} kinh Hư (-).
                  </span>
                  <span v-show="activeBadgeType === 'am' || activeBadgeType === 'duong'" class="conc-extra">
                    <span v-if="diag.baselines.avg_tren > diag.baselines.avg_duoi + 1"> Thượng nhiệt Hạ hàn.</span>
                    <span v-else-if="diag.baselines.avg_duoi > diag.baselines.avg_tren + 1"> Thượng hàn Hạ nhiệt.</span>
                  </span>
                  <span v-show="activeBadgeType === 'ly' || activeBadgeType === 'nhiet' || activeBadgeType === 'thuc'" class="conc-extra" v-if="diag.categories.lyNhiet.length">
                    Lý Nhiệt: {{ diag.categories.lyNhiet.join(', ') }}.
                  </span>
                  <span v-show="activeBadgeType === 'ly' || activeBadgeType === 'han' || activeBadgeType === 'hu'" class="conc-extra" v-if="diag.categories.lyHan.length">
                    Lý Hàn: {{ diag.categories.lyHan.join(', ') }}.
                  </span>
                  <span v-show="activeBadgeType === 'bieu' || activeBadgeType === 'nhiet' || activeBadgeType === 'thuc'" class="conc-extra" v-if="diag.categories.bieuNhiet.length">
                    Biểu Nhiệt: {{ diag.categories.bieuNhiet.join(', ') }}.
                  </span>
                  <span v-show="activeBadgeType === 'bieu' || activeBadgeType === 'han' || activeBadgeType === 'hu'" class="conc-extra" v-if="diag.categories.bieuHan.length">
                    Biểu Hàn: {{ diag.categories.bieuHan.join(', ') }}.
                  </span>

                  <div v-show="activeBadgeType === 'han' || activeBadgeType === 'nhiet'" class="conc-compare-han-nhiet">
                    <div>
                      Hàn / Nhiệt: <strong>{{ summaryCounts.cntNhiet }}</strong> kinh nằm vùng <span class="val-nhiet">Nhiệt (1/3 trên)</span>,
                      <strong>{{ summaryCounts.cntHan }}</strong> kinh nằm vùng <span class="val-han">Hàn (1/3 dưới)</span>.
                    </div>
                    <div>
                      ⇒ {{ summaryCounts.cntNhiet }} {{ summaryCounts.cntNhiet >= summaryCounts.cntHan ? '≥' : '<' }} {{ summaryCounts.cntHan }} → Kết luận:
                      <strong>{{ diag.batCuongTong.hanNhiet }}</strong>.
                    </div>
                  </div>
                </div>
                <p class="conclusion-hint">⊙ Ấn vào từng mục để xem kinh mạch tương ứng trong bảng</p>
              </template>
              <template v-else>
                <div class="conclusion-content">
                  <div class="conclusion-line">
                    <span class="conclusion-label">Kết luận:</span>
                    <span class="conclusion-value">{{ result.amDuong }}</span>
                  </div>
                  <div class="conclusion-line khi-huyet">
                    <span class="conclusion-label">KHÍ HUYẾT:</span>
                    <span class="conclusion-value">{{ result.khi }} - {{ result.huyet }}</span>
                  </div>
                </div>
              </template>
            </div>

            <!-- III. GỢI Ý MÔ HÌNH BỆNH LÝ & PHÁP TRỊ -->
            <div class="section-card model-card">
              <div class="section-title section-title-iii">III. GỢI Ý MÔ HÌNH BỆNH LÝ & PHÁP TRỊ</div>
              <div class="suggested-models-list">
                <div
                  v-for="(syn, idx) in result.syndromes"
                  :key="idx"
                  class="model-item"
                  :class="{ 'model-item--active': selectedModelIndex === idx }"
                  @click="selectedModelIndex = selectedModelIndex === idx ? -1 : idx"
                >
                  <div class="model-item-title">{{ syn.tieuket || `Mô hình #${idx + 1}` }}</div>
                  <div class="model-progress">
                    <div
                      class="model-progress-bar"
                      :style="{ width: `${Math.round(((syn.rate ?? 1) as number) * 100)}%` }"
                    />
                  </div>
                  <span class="model-pct">{{ Math.round(((syn.rate ?? 1) as number) * 100) }}%</span>
                </div>
              </div>
              <div class="model-detail-box">
                <template v-if="selectedModelIndex >= 0 && result.syndromes[selectedModelIndex]">
                  <div class="model-detail-name">{{ result.syndromes[selectedModelIndex].tieuket }}</div>
                  <div v-if="result.syndromes[selectedModelIndex].trieuchung" class="model-detail-row">
                    <strong>Triệu chứng:</strong> {{ result.syndromes[selectedModelIndex].trieuchung }}
                  </div>
                  <div v-if="result.syndromes[selectedModelIndex].benhly" class="model-detail-row">
                    <strong>Bệnh lý:</strong> {{ result.syndromes[selectedModelIndex].benhly }}
                  </div>
                  <div v-if="result.syndromes[selectedModelIndex].phuyet_chamcuu" class="model-detail-row">
                    <strong>Phụ huyệt châm cứu:</strong> {{ result.syndromes[selectedModelIndex].phuyet_chamcuu }}
                  </div>
                  <div v-if="result.syndromes[selectedModelIndex].giainghia_phuyet" class="model-detail-row">
                    <strong>Giải nghĩa phụ huyệt:</strong> {{ result.syndromes[selectedModelIndex].giainghia_phuyet }}
                  </div>
                </template>
                <div v-else class="model-detail-placeholder">Di chuột vào mô hình để xem chi tiết...</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Notes & Actions -->
        <div v-if="result.notes" class="result-notes">
          <span class="notes-label">Ghi chú:</span> {{ result.notes }}
        </div>
        <div class="result-actions">
          <button class="btn-new" @click="result = null; selectedModelIndex = -1; activeBadgeType = null; hoverCategoryIds = []">
            <UIcon name="i-lucide-plus" class="btn-icon" />
            Khám mới
          </button>
          <NuxtLink :to="`/patients/${patient.id}`" class="btn-back">
            <UIcon name="i-lucide-arrow-left" class="btn-icon" />
            Quay lại hồ sơ
          </NuxtLink>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.examine-page {
  width: 100%;
  /* Tăng bề rộng khả dụng giống webapp */
  padding: 18px 20px;
  box-sizing: border-box;
}

/* ─── Loading / Empty ─── */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: #64748b;
  font-size: 0.9rem;
}

.loading-icon { width: 24px; height: 24px; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 80px;
  color: #94a3b8;
  font-size: 0.9rem;
}

.empty-icon { width: 48px; height: 48px; opacity: 0.5; }

.back-link {
  color: var(--kl-secondary, #8B1A1A);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.875rem;
}

.back-link:hover { text-decoration: underline; }

/* ─── Header ─── */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 28px;
  gap: 16px;
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1.5px solid #e2e8f0;
  color: #64748b;
  text-decoration: none;
  transition: all 0.18s;
  flex-shrink: 0;
}

.back-btn:hover {
  border-color: var(--kl-secondary, #8B1A1A);
  color: var(--kl-secondary, #8B1A1A);
  background: var(--kl-bg-light, #FBF8F1);
}

.header-info {
  display: flex;
  align-items: center;
  gap: 14px;
}

.patient-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--kl-primary, #5B3A1A), var(--kl-secondary, #8B1A1A));
  color: #fff;
  font-size: 1.2rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a2332;
  margin: 0 0 4px;
  letter-spacing: -0.02em;
}

.page-subtitle {
  font-size: 0.85rem;
  color: #64748b;
  margin: 0;
}

/* ─── Input table cards ─── */
.form-section {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  align-items: start;
}

.input-table-card {
  background: var(--kl-bg-white, #FFFDF7);
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--kl-border, #D4C5A0);
  overflow: hidden;
}

.input-table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: var(--kl-bg-light, #FBF8F1);
  border-bottom: 1px solid var(--kl-border, #D4C5A0);
}

.input-table-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.input-table-icon {
  width: 20px;
  height: 20px;
  color: var(--kl-secondary, #8B1A1A);
}

.input-table-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1a2332;
  margin: 0;
}

.input-table-hint {
  font-size: 0.72rem;
  color: #94a3b8;
  font-weight: 500;
}

.input-table {
  width: 100%;
  border-collapse: collapse;
}

.input-table th {
  padding: 10px 16px;
  font-size: 0.72rem;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-align: center;
  border-bottom: 1px solid #f1f5f9;
}

.col-stt { width: 40px; text-align: center !important; }
.col-name { text-align: left !important; }
.col-val { width: 100px; }

.input-table td {
  padding: 0;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.input-table tr:last-child td { border-bottom: none; }

.input-table tr:hover { background: var(--kl-bg-light, #FBF8F1); }

.cell-stt {
  text-align: center;
  font-size: 0.78rem;
  font-weight: 600;
  color: #94a3b8;
  padding: 10px 0 !important;
}

.cell-channel {
  padding: 10px 16px !important;
  font-size: 0.875rem;
  font-weight: 500;
  color: #1a2332;
}

.cell-input {
  padding: 6px 8px !important;
}

.ch-input {
  width: 100%;
  padding: 8px 6px;
  border: 1.5px solid transparent;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #1a2332;
  background: transparent;
  outline: none;
  text-align: center;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  -moz-appearance: textfield;
}

.ch-input::-webkit-inner-spin-button,
.ch-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.ch-input:hover {
  background: #f1f5f9;
}

.ch-input:focus {
  border-color: var(--kl-secondary, #8B1A1A);
  background: #fff;
  box-shadow: 0 0 0 2px rgba(139, 26, 26, 0.15);
}

/* ─── Notes ─── */
.notes-card {
  grid-column: 1 / -1;
}

.form-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.notes-icon {
  width: 15px;
  height: 15px;
  color: #94a3b8;
}

.form-textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  font-size: 0.875rem;
  color: #1a2332;
  background: #ffffff;
  outline: none;
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-textarea:focus {
  border-color: var(--kl-secondary, #8B1A1A);
  box-shadow: 0 0 0 3px rgba(139, 26, 26, 0.1);
}

/* ─── Error ─── */
.error-msg {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  color: #dc2626;
  font-size: 0.85rem;
}

.error-icon { width: 16px; height: 16px; flex-shrink: 0; }

/* ─── Submit ─── */
.submit-bar {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 4px;
}

.btn-cancel {
  display: flex;
  align-items: center;
  padding: 11px 22px;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
  background: transparent;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.18s;
}

.btn-cancel:hover {
  border-color: #cbd5e1;
  background: #f1f5f9;
}

.btn-submit {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  background: linear-gradient(135deg, var(--kl-primary, #5B3A1A), var(--kl-secondary, #8B1A1A));
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(139, 26, 26, 0.25);
  transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s;
}

.btn-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(139, 26, 26, 0.35);
}

.btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }
.btn-icon { width: 18px; height: 18px; }
.btn-loading { display: flex; align-items: center; gap: 8px; }

/* ─── Results – layout phân tích giống webapp (nâu/cream) ─── */
.results-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.report-header {
  text-align: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--kl-border, #D4C5A0);
}

.report-title {
  margin: 0;
  color: var(--kl-secondary, #8B1A1A);
  text-transform: uppercase;
  font-size: 1.25rem;
  letter-spacing: 2px;
}

.report-subtitle {
  margin: 6px 0 0;
  color: var(--kl-accent, #8B7355);
  font-size: 0.8rem;
}

.patient-info-box {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 12px 16px;
  background: var(--kl-bg-light, #FBF8F1);
  border: 1px solid var(--kl-border, #D4C5A0);
  border-radius: 6px;
  font-size: 0.85rem;
  color: var(--kl-text-dark, #2D2D2D);
}

.analysis-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 2rem;
  align-items: start;
}

.analysis-left {
  min-width: 0;
}

.analysis-right {
  position: sticky;
  top: 80px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.section-card {
  background: var(--kl-bg-white, #FFFDF7);
  border: 1px solid var(--kl-border, #D4C5A0);
  border-radius: 6px;
  padding: 16px 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.report-card {
  border-top: 3px solid var(--kl-secondary, #8B1A1A);
}

.section-title {
  font-weight: 700;
  font-size: 0.95rem;
  border-bottom: 2px solid;
  margin-bottom: 12px;
  padding-bottom: 6px;
  letter-spacing: 1px;
}

.section-title-i,
.section-title-ii {
  color: var(--kl-secondary, #8B1A1A);
  border-color: var(--kl-secondary, #8B1A1A);
}

.section-title-iii {
  color: var(--kl-primary, #5B3A1A);
  border-color: var(--kl-primary, #5B3A1A);
}

.table-subtitle {
  margin: 16px 0 8px;
  color: var(--kl-primary, #5B3A1A);
  border-left: 4px solid var(--kl-accent, #8B7355);
  padding-left: 8px;
  font-size: 0.9rem;
  letter-spacing: 0.5px;
}

.table-subtitle:first-of-type { margin-top: 0; }

.stats-summary {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.baseline-box {
  flex: 1;
  min-width: 260px;
  transition: box-shadow 0.3s, opacity 0.3s;
}

.baseline-head {
  font-size: 0.7rem;
  font-weight: 700;
  margin-bottom: 5px;
  color: #5B3A1A;
  font-family: 'Times New Roman', serif;
}

.baseline-rowwrap {
  display: flex;
  gap: 4px;
  align-items: stretch;
  height: 126px;
  font-family: 'Times New Roman', serif;
}

.baseline-numcol {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: right;
  font-size: 0.68rem;
  min-width: 38px;
  padding: 1px 0;
}

.baseline-other { color: #A09580; transition: all 0.3s; }
.baseline-up { color: #8B1A1A; font-weight: 700; transition: all 0.3s; }
.baseline-avg { color: #5B3A1A; font-weight: 700; transition: all 0.3s; }
.baseline-low { color: #1A5276; font-weight: 700; transition: all 0.3s; }

.zone-bar-col {
  width: 16px;
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #C4B598;
  transition: all 0.3s;
}

.zone-nhiet {
  flex: 1;
  background: linear-gradient(180deg, #8B1A1A55, #8B1A1A22);
  transition: all 0.3s;
}

.zone-binh {
  flex: 1;
  background: #F5EDD8;
  border-top: 2px solid #8B1A1A;
  border-bottom: 2px solid #1A5276;
  position: relative;
  transition: all 0.3s;
}

.zone-midline {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  border-top: 1px dashed #8B7355;
}

.zone-han {
  flex: 1;
  background: linear-gradient(180deg, #1A527622, #1A527655);
  transition: all 0.3s;
}

.baseline-labelcol {
  display: flex;
  flex-direction: column;
  font-size: 0.62rem;
  min-width: 70px;
}

.zone-label-nhiet {
  flex: 1;
  display: flex;
  align-items: center;
  color: #8B1A1A;
  font-weight: 700;
  transition: all 0.3s;
}

.zone-label-binh {
  flex: 1;
  display: flex;
  align-items: center;
  color: #5B4A3A;
  font-size: 0.56rem;
  line-height: 1.3;
  transition: all 0.3s;
}

.zone-label-han {
  flex: 1;
  display: flex;
  align-items: center;
  color: #1A5276;
  font-weight: 700;
  transition: all 0.3s;
}

/* Highlight/dim bảng khi ấn badge hoặc hover category */
.row-highlight { transition: background 0.2s, box-shadow 0.2s, opacity 0.2s; }
.row-dimmed {
  opacity: 0.5;
  transition: opacity 0.2s;
}

.classic-table .cell-diff { font-weight: 600; }

/* Bảng kinh lạc kiểu Đông Y */
.classic-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 0.7rem;
  margin-bottom: 8px;
}

.classic-table th,
.classic-table td {
  border: 1px solid #C4B598;
  padding: 3px 4px;
  text-align: center;
  white-space: nowrap;
  overflow: visible;
}

/* 2 cột cuối: cho phép wrap (giống webapp khi hẹp) */
.classic-table th.bc-col,
.classic-table td.bc-col,
.classic-table th.comp-col,
.classic-table td.comp-col {
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.classic-table th.bc-col,
.classic-table td.bc-col {
  font-size: 0.68rem;
}

.classic-table thead th {
  background: var(--kl-table-header, #F0E8D8);
  color: var(--kl-primary, #5B3A1A);
  font-weight: 700;
}

.classic-table .col-kinh { text-align: left; width: 160px; }
.classic-table th.col-kinh { white-space: normal; }
.classic-table td.cell-kinh { white-space: normal; line-height: 1.15; }

/* Cột "Kinh Mạch / Huyệt Đo" giống webapp (2 dòng) */
.kinh-name {
  font-weight: 700;
  font-size: 0.8rem;
  color: #2D2D2D;
}

.kinh-desc {
  font-size: 0.6rem;
  color: #A09580;
  margin-top: 2px;
}
.classic-table .col-tb { background: #F5EDD8; }
.classic-table .col-left { color: var(--kl-secondary, #8B1A1A); }
.classic-table .col-right { color: var(--kl-status-minus, #1A5276); }
.classic-table .sub-header { background: #F5F0E8; font-size: 0.7rem; }
.classic-table .plus { color: var(--kl-secondary, #8B1A1A); }
.classic-table .minus { color: var(--kl-status-minus, #1A5276); }
.classic-table .cell-kinh { text-align: left; font-weight: 500; color: #1a1a1a; }
.classic-table .cell-tb { background: #FBF8F1; color: #1a1a1a; }
/* Chỉ số trong bảng: màu rõ, dễ đọc */
.classic-table tbody td { color: #1a1a1a; font-weight: 500; }
.classic-table tbody .cell-plus { color: #8B1A1A; font-weight: 700; }
.classic-table tbody .cell-minus { color: #1A5276; font-weight: 700; }
.classic-table tbody .cell-diff { color: #2D2D2D; }
.classic-table tbody tr:hover { background: #F5F0E8; }

.bc-col {
  background: #FBF8F1;
  width: 100px;
}

.comp-col {
  background: #F0E8D8;
  width: 80px;
}

.bc-cell {
  font-size: 0.7rem;
  font-weight: 700;
  color: #5B3A1A;
  text-align: center;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.15;
}

.comp-cell {
  font-size: 0.8rem;
  text-align: center;
  color: #5B4A3A;
}

/* II. Kết luận */
.conclusion-card {
  border: 1px solid #E8DCC8;
}

.conclusion-content {
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--kl-text-dark, #2D2D2D);
}

.conclusion-line {
  margin-bottom: 8px;
}

.conclusion-line.khi-huyet {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--kl-border, #D4C5A0);
}

.conclusion-label {
  font-weight: 700;
  color: var(--kl-primary, #5B3A1A);
  margin-right: 6px;
}

.conclusion-value { font-weight: 600; }
.val-duong { color: #8B1A1A; }
.val-am { color: #2C4A6E; }
.val-ly { color: #7A1B3D; }
.val-bieu { color: #A0632C; }
.val-nhiet { color: #A62B2B; }
.val-han { color: #1A5276; }
.val-thuc { color: #8B4513; }
.val-hu { color: #2D5A27; }

.conclusion-main { flex-wrap: wrap; gap: 4px 8px; }
.conc-sep { color: var(--kl-border, #D4C5A0); margin: 0 2px; }

/* Box kết luận giống webapp */
.conclusion-box,
.khi-huyet-box {
  padding: 8px 10px;
  border-radius: 4px;
  border: 1px solid #D4C5A0;
  text-align: center;
  font-family: 'Times New Roman', serif;
  margin-bottom: 10px;
}

.conclusion-box {
  background: #FBF8F1;
}

.khi-huyet-box {
  background: #F5F0E8;
  padding: 6px 10px;
}

.conclusion-box-label {
  font-size: 0.65rem;
  color: #A09580;
  margin-right: 4px;
}

.conclusion-box-val {
  font-weight: 700;
  font-size: 0.85rem;
  color: #5B4A3A;
}

.conclusion-box-sep {
  color: #D4C5A0;
  margin: 0 5px;
}

.khi-huyet-val {
  font-weight: 700;
  font-size: 0.82rem;
  color: #5B4A3A;
}

.conclusion-detail {
  font-size: 0.76rem;
  color: #5B4A3A;
  line-height: 1.7;
  border-top: 1px solid #D4C5A0;
  padding-top: 8px;
  font-family: 'Times New Roman', serif;
  margin-top: 6px;
}

.conc-part {
  font-weight: 700;
  transition: opacity 0.2s;
}

.conc-sep-dash {
  color: #D4C5A0;
  transition: opacity 0.2s;
}

.conc-extra {
  display: inline;
  transition: opacity 0.2s;
}

.conc-compare-han-nhiet {
  margin-top: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  background: #FBF8F1;
  border: 1px dashed #D4C5A0;
  font-size: 0.7rem;
}

.bat-cuong-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px 6px;
  margin-bottom: 10px;
}

.grid-caption {
  font-size: 0.48rem;
  color: #A09580;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  grid-column: span 1;
}

.bat-cuong-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 4px;
  background: #F5F0E8;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  text-align: center;
}

.bat-cuong-badge:hover { background: #F0E8D8; }
.bat-cuong-badge.badge-active { font-weight: 700; }

.badge-name { font-size: 0.8rem; line-height: 1.2; color: #A09580; }
.bat-cuong-badge.badge-active .badge-name { color: inherit; font-weight: 700; }
.bat-cuong-badge.badge-active .badge-sub { color: inherit; opacity: 0.9; }
.badge-sub { font-size: 0.52rem; color: #A09580; margin-top: 2px; }

/* Highlight badge theo kết quả chẩn đoán (Âm/Dương/Biểu/Lý/Hàn/Nhiệt/Hư/Thực) */
.bat-cuong-badge.badge-result-am {
  background: #2C4A6E12;
  border-color: #2C4A6E;
  box-shadow: 0 0 0 1px #2C4A6E;
}
.bat-cuong-badge.badge-result-am .badge-name { color: #2C4A6E; font-weight: 700; }
.bat-cuong-badge.badge-result-am .badge-sub { color: #2C4A6E; opacity: 0.9; }

.bat-cuong-badge.badge-result-duong {
  background: #8B1A1A12;
  border-color: #8B1A1A;
  box-shadow: 0 0 0 1px #8B1A1A;
}
.bat-cuong-badge.badge-result-duong .badge-name { color: #8B1A1A; font-weight: 700; }
.bat-cuong-badge.badge-result-duong .badge-sub { color: #8B1A1A; opacity: 0.9; }

.bat-cuong-badge.badge-result-bieu {
  background: #A0632C12;
  border-color: #A0632C;
  box-shadow: 0 0 0 1px #A0632C;
}
.bat-cuong-badge.badge-result-bieu .badge-name { color: #A0632C; font-weight: 700; }
.bat-cuong-badge.badge-result-bieu .badge-sub { color: #A0632C; opacity: 0.9; }

.bat-cuong-badge.badge-result-ly {
  background: #7A1B3D12;
  border-color: #7A1B3D;
  box-shadow: 0 0 0 1px #7A1B3D;
}
.bat-cuong-badge.badge-result-ly .badge-name { color: #7A1B3D; font-weight: 700; }
.bat-cuong-badge.badge-result-ly .badge-sub { color: #7A1B3D; opacity: 0.9; }

.bat-cuong-badge.badge-result-han {
  background: #1A527612;
  border-color: #1A5276;
  box-shadow: 0 0 0 1px #1A5276;
}
.bat-cuong-badge.badge-result-han .badge-name { color: #1A5276; font-weight: 700; }
.bat-cuong-badge.badge-result-han .badge-sub { color: #1A5276; opacity: 0.9; }

.bat-cuong-badge.badge-result-nhiet {
  background: #A62B2B12;
  border-color: #A62B2B;
  box-shadow: 0 0 0 1px #A62B2B;
}
.bat-cuong-badge.badge-result-nhiet .badge-name { color: #A62B2B; font-weight: 700; }
.bat-cuong-badge.badge-result-nhiet .badge-sub { color: #A62B2B; opacity: 0.9; }

.bat-cuong-badge.badge-result-hu {
  background: #2D5A2712;
  border-color: #2D5A27;
  box-shadow: 0 0 0 1px #2D5A27;
}
.bat-cuong-badge.badge-result-hu .badge-name { color: #2D5A27; font-weight: 700; }
.bat-cuong-badge.badge-result-hu .badge-sub { color: #2D5A27; opacity: 0.9; }

.bat-cuong-badge.badge-result-thuc {
  background: #8B451312;
  border-color: #8B4513;
  box-shadow: 0 0 0 1px #8B4513;
}
.bat-cuong-badge.badge-result-thuc .badge-name { color: #8B4513; font-weight: 700; }
.bat-cuong-badge.badge-result-thuc .badge-sub { color: #8B4513; opacity: 0.9; }

.cat-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 5px;
  margin-bottom: 3px;
  cursor: default;
  transition: background 0.15s;
}

.cat-row:hover { background: #F5F0E8; }

.cat-tag {
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
  padding: 1px 6px;
  border-radius: 3px;
}

.cat-lynhiet { color: #8B1A1A; background: #8B1A1A18; }
.cat-bieunhiet { color: #7A4A1A; background: #A0632C18; }
.cat-lyhan { color: #1A3A5C; background: #1A527618; }
.cat-bieuhan { color: #1A3A5C; background: #2C4A6E18; }

.cat-names { font-size: 0.78rem; color: #444; line-height: 1.5; }

/* Danh sách kinh: cho phép wrap như webapp */
.cat-names {
  white-space: normal;
}
.cat-empty { color: #A09580; font-size: 0.82rem; padding: 4px; font-style: italic; }
.conclusion-hint { font-size: 0.65rem; color: #C4B598; font-style: italic; margin-top: 6px; }

/* III. Gợi ý mô hình */
.model-card {
  border: 1px solid #E8DCC8;
}

.suggested-models-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
  max-height: 280px;
  overflow-y: auto;
}

.model-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--kl-border, #D4C5A0);
  border-radius: 4px;
  background: var(--kl-bg-white, #FFFDF7);
  cursor: pointer;
  transition: all 0.18s;
}

.model-item:hover,
.model-item--active {
  background: #F5F0E8;
  border-color: var(--kl-secondary, #8B1A1A);
  box-shadow: 0 2px 8px rgba(139, 26, 26, 0.15);
}

.model-item-title {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 0.82rem;
  color: var(--kl-primary, #5B3A1A);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.model-progress {
  height: 4px;
  background: #E8DCC8;
  border-radius: 2px;
  min-width: 60px;
  overflow: hidden;
}

.model-progress-bar {
  height: 100%;
  background: var(--kl-secondary, #8B1A1A);
  border-radius: 2px;
  transition: width 0.3s;
}

.model-pct {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--kl-secondary, #8B1A1A);
  white-space: nowrap;
}

.model-detail-box {
  padding: 12px;
  border: 1px solid var(--kl-border, #D4C5A0);
  border-radius: 6px;
  background: var(--kl-bg-light, #FBF8F1);
  min-height: 80px;
  font-size: 0.82rem;
  line-height: 1.5;
}

.model-detail-name {
  font-weight: 700;
  color: var(--kl-secondary, #8B1A1A);
  font-size: 0.9rem;
  margin-bottom: 8px;
}

.model-detail-row {
  margin-bottom: 6px;
  color: var(--kl-text-dark, #2D2D2D);
}

.model-detail-placeholder {
  color: #A09580;
  text-align: center;
  padding: 16px 10px;
}

.result-notes {
  padding: 12px 16px;
  background: var(--kl-bg-light, #FBF8F1);
  border-radius: 10px;
  font-size: 0.85rem;
  color: var(--kl-text-dark, #2D2D2D);
  border: 1px solid var(--kl-border, #D4C5A0);
}

.notes-label { font-weight: 600; color: var(--kl-text-muted, #5B4A3A); }

.result-actions {
  display: flex;
  gap: 12px;
}

.btn-new {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, var(--kl-primary, #5B3A1A), var(--kl-secondary, #8B1A1A));
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(139, 26, 26, 0.25);
  transition: transform 0.15s, box-shadow 0.2s;
}

.btn-new:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(139, 26, 26, 0.35);
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: 1.5px solid var(--kl-border, #D4C5A0);
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--kl-text-muted, #5B4A3A);
  text-decoration: none;
  background: var(--kl-bg-white, #FFFDF7);
  transition: all 0.18s;
}

.btn-back:hover {
  border-color: var(--kl-secondary, #8B1A1A);
  color: var(--kl-secondary, #8B1A1A);
  background: var(--kl-bg-light, #FBF8F1);
}

/* ─── Transitions ─── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 900px) {
  .form-section { grid-template-columns: 1fr; }
  .analysis-grid { grid-template-columns: 1fr; }
  .analysis-right { position: static; }
  .patient-info-box { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 600px) {
  .patient-info-box { grid-template-columns: 1fr; }
}
</style>
