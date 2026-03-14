<script setup lang="ts">
interface Flag {
  channelIndex: number
  channelName: string
  L: number
  R: number
  Avg: number
  c8: number
  c10: number
  c11: number
  c12: number
}

const props = defineProps<{
  flags: Flag[]
}>()

const LABELS: Record<string, string> = {
  tieutruong: 'T.Trường', tam: 'Tâm', tamtieu: 'T.Tiêu',
  tambao: 'T.Bào', daitrang: 'Đ.Tràng', phe: 'Phế',
  bangquang: 'B.Quang', than: 'Thận', dam: 'Đảm',
  vi: 'Vị', can: 'Can', ty: 'Tỳ',
}

const COLORS = [
  '#ef4444', '#be123c', '#ea580c', '#d97706', '#65a30d', '#16a34a',
  '#0891b2', '#2563eb', '#7c3aed', '#c026d3', '#db2777', '#e11d48',
]

const round2 = (n: number) => Math.round(n * 100) / 100

const calcBounds = (indices: number[]) => {
  const vals = indices.flatMap(i => [props.flags[i].L, props.flags[i].R])
  const max = Math.max(...vals)
  const min = Math.min(...vals)
  const mid = round2((max + min) / 2)
  const ds = round2((max - min) / 6)
  return { midPoint: mid, upperLimit: mid + ds, lowerLimit: mid - ds, dungSai: ds }
}

const handBounds = computed(() => calcBounds([0, 1, 2, 3, 4, 5]))
const footBounds = computed(() => calcBounds([6, 7, 8, 9, 10, 11]))

const maxVal = computed(() => {
  const all = props.flags.flatMap(f => [f.L, f.R])
  const m = Math.max(...all, 1)
  return Math.ceil(m / 5) * 5
})

const yTicks = computed(() => {
  const step = Math.max(1, Math.ceil(maxVal.value / 5))
  const ticks: number[] = []
  for (let i = step; i <= maxVal.value; i += step) ticks.push(i)
  return ticks
})

const barPct = (v: number) => `${(v / maxVal.value) * 100}%`
const linePct = (v: number) => Math.min(100, Math.max(0, (v / maxVal.value) * 100))

const boundsForIndex = (i: number) => i < 6 ? handBounds.value : footBounds.value

const refLines = computed(() => {
  const lines: Array<{ label: string; value: number; group: 'hand' | 'foot'; color: string; dash?: boolean }> = []
  const addGroup = (b: ReturnType<typeof calcBounds>, group: 'hand' | 'foot') => {
    if (b.dungSai === 0) return
    lines.push({ label: 'GH Trên', value: b.upperLimit, group, color: '#ef4444' })
    lines.push({ label: 'TB', value: b.midPoint, group, color: '#f59e0b', dash: true })
    lines.push({ label: 'GH Dưới', value: b.lowerLimit, group, color: '#3b82f6' })
  }
  addGroup(handBounds.value, 'hand')
  addGroup(footBounds.value, 'foot')
  return lines
})

const hoveredIdx = ref<number | null>(null)
</script>

<template>
  <div class="mc-wrapper">
    <div class="mc-title">
      <UIcon name="i-lucide-bar-chart-3" class="mc-title-icon" />
      Biểu đồ số đo kinh lạc
    </div>

    <div class="mc-chart">
      <!-- ═══ TOP HALF: Trái ═══ -->
      <div class="mc-half mc-half--top">
        <span class="mc-side-label mc-side-label--top">Trái</span>

        <!-- Y-axis ticks -->
        <div class="mc-y-axis">
          <span v-for="t in yTicks" :key="'tl'+t" class="mc-y-tick" :style="{ bottom: barPct(t) }">{{ t }}</span>
        </div>

        <!-- Bars area -->
        <div class="mc-bars-area">
          <!-- Reference lines -->
          <template v-for="line in refLines" :key="'tref'+line.label+line.group">
            <div
              class="mc-ref-line"
              :class="{ 'mc-ref-line--dash': line.dash }"
              :style="{
                bottom: barPct(line.value),
                left: line.group === 'hand' ? '0%' : '50%',
                width: '50%',
                borderColor: line.color,
              }"
            >
              <span class="mc-ref-tag" :style="{ color: line.color }">{{ line.value }}</span>
            </div>
          </template>

          <!-- Group separator -->
          <div class="mc-group-sep" />

          <!-- Bars -->
          <div
            v-for="(flag, i) in flags"
            :key="'tb'+i"
            class="mc-bar-col"
            @mouseenter="hoveredIdx = i"
            @mouseleave="hoveredIdx = null"
          >
            <div class="mc-bar mc-bar--top" :style="{ height: barPct(flag.L), backgroundColor: COLORS[i] }">
              <span v-if="flag.L > 0" class="mc-bar-val">{{ flag.L }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ CENTER: Channel Labels ═══ -->
      <div class="mc-labels">
        <div
          v-for="(flag, i) in flags"
          :key="'lbl'+i"
          class="mc-label"
          :class="{ 'mc-label--active': hoveredIdx === i }"
          :style="{ color: COLORS[i] }"
        >
          {{ LABELS[flag.channelName] || flag.channelName }}
        </div>
      </div>

      <!-- ═══ BOTTOM HALF: Phải ═══ -->
      <div class="mc-half mc-half--bottom">
        <span class="mc-side-label mc-side-label--bottom">Phải</span>

        <!-- Y-axis ticks -->
        <div class="mc-y-axis mc-y-axis--bottom">
          <span v-for="t in yTicks" :key="'bl'+t" class="mc-y-tick" :style="{ top: barPct(t) }">{{ t }}</span>
        </div>

        <!-- Bars area -->
        <div class="mc-bars-area">
          <!-- Reference lines -->
          <template v-for="line in refLines" :key="'bref'+line.label+line.group">
            <div
              class="mc-ref-line mc-ref-line--bottom"
              :class="{ 'mc-ref-line--dash': line.dash }"
              :style="{
                top: barPct(line.value),
                left: line.group === 'hand' ? '0%' : '50%',
                width: '50%',
                borderColor: line.color,
              }"
            />
          </template>

          <!-- Group separator -->
          <div class="mc-group-sep" />

          <!-- Bars -->
          <div
            v-for="(flag, i) in flags"
            :key="'bb'+i"
            class="mc-bar-col mc-bar-col--bottom"
            @mouseenter="hoveredIdx = i"
            @mouseleave="hoveredIdx = null"
          >
            <div class="mc-bar mc-bar--bottom" :style="{ height: barPct(flag.R), backgroundColor: COLORS[i] }">
              <span v-if="flag.R > 0" class="mc-bar-val mc-bar-val--bottom">{{ flag.R }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ TOOLTIP ═══ -->
    <Transition name="fade">
      <div v-if="hoveredIdx !== null" class="mc-tooltip">
        <div class="mc-tt-title" :style="{ color: COLORS[hoveredIdx] }">
          {{ LABELS[flags[hoveredIdx].channelName] }}
        </div>
        <div class="mc-tt-row">
          <span>Trái:</span> <strong>{{ flags[hoveredIdx].L }}</strong>
        </div>
        <div class="mc-tt-row">
          <span>Phải:</span> <strong>{{ flags[hoveredIdx].R }}</strong>
        </div>
        <div class="mc-tt-row">
          <span>TB:</span> <strong>{{ flags[hoveredIdx].Avg }}</strong>
        </div>
        <div class="mc-tt-divider" />
        <div class="mc-tt-row">
          <span>GH Trên:</span> <strong>{{ boundsForIndex(hoveredIdx).upperLimit }}</strong>
        </div>
        <div class="mc-tt-row">
          <span>Trung bình:</span> <strong>{{ boundsForIndex(hoveredIdx).midPoint }}</strong>
        </div>
        <div class="mc-tt-row">
          <span>GH Dưới:</span> <strong>{{ boundsForIndex(hoveredIdx).lowerLimit }}</strong>
        </div>
      </div>
    </Transition>

    <!-- ═══ LEGEND ═══ -->
    <div class="mc-legend">
      <div class="mc-legend-item">
        <span class="mc-legend-line mc-legend-line--upper" />
        <span>Giới hạn trên</span>
      </div>
      <div class="mc-legend-item">
        <span class="mc-legend-line mc-legend-line--mid" />
        <span>Trung bình</span>
      </div>
      <div class="mc-legend-item">
        <span class="mc-legend-line mc-legend-line--lower" />
        <span>Giới hạn dưới</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mc-wrapper {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(226, 232, 240, 0.8);
  padding: 24px;
  position: relative;
}

.mc-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.95rem;
  font-weight: 700;
  color: #1a2332;
  margin-bottom: 20px;
}

.mc-title-icon { width: 20px; height: 20px; color: #1e88e5; }

/* ─── Chart layout ─── */
.mc-chart {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.mc-half {
  position: relative;
  height: 180px;
}

.mc-side-label {
  position: absolute;
  right: -2px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
  writing-mode: vertical-rl;
  z-index: 2;
}

.mc-side-label--top { top: 50%; transform: translateY(-50%); }
.mc-side-label--bottom { top: 50%; transform: translateY(-50%); }

/* ─── Y-axis ─── */
.mc-y-axis {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 36px;
  z-index: 2;
}

.mc-y-tick {
  position: absolute;
  right: 4px;
  font-size: 0.65rem;
  font-weight: 600;
  color: #94a3b8;
  transform: translateY(50%);
  line-height: 1;
}

.mc-y-axis--bottom .mc-y-tick {
  transform: translateY(-50%);
}

/* ─── Bars area ─── */
.mc-bars-area {
  position: absolute;
  left: 40px;
  right: 24px;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  border-bottom: 2px solid #e2e8f0;
}

.mc-half--bottom .mc-bars-area {
  align-items: flex-start;
  border-bottom: none;
  border-top: 2px solid #e2e8f0;
}

/* ─── Group separator ─── */
.mc-group-sep {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #e2e8f0;
  z-index: 1;
}

/* ─── Bar columns ─── */
.mc-bar-col {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 100%;
  cursor: pointer;
  position: relative;
  z-index: 2;
}

.mc-bar-col--bottom {
  align-items: flex-start;
}

.mc-bar {
  width: 80%;
  max-width: 48px;
  border-radius: 6px 6px 0 0;
  position: relative;
  transition: opacity 0.15s, filter 0.15s;
  min-height: 2px;
}

.mc-bar--bottom {
  border-radius: 0 0 6px 6px;
}

.mc-bar-col:hover .mc-bar {
  filter: brightness(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.mc-bar-val {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.65rem;
  font-weight: 700;
  color: #374151;
  white-space: nowrap;
}

.mc-bar-val--bottom {
  top: auto;
  bottom: -18px;
}

/* ─── Reference lines ─── */
.mc-ref-line {
  position: absolute;
  height: 0;
  border-bottom: 1.5px solid;
  z-index: 1;
  pointer-events: none;
}

.mc-ref-line--bottom {
  border-bottom: none;
  border-top: 1.5px solid;
}

.mc-ref-line--dash {
  border-bottom-style: dashed;
}

.mc-ref-line--bottom.mc-ref-line--dash {
  border-top-style: dashed;
}

.mc-ref-tag {
  position: absolute;
  right: 2px;
  top: -14px;
  font-size: 0.6rem;
  font-weight: 700;
  white-space: nowrap;
}

/* ─── Center labels ─── */
.mc-labels {
  display: flex;
  gap: 3px;
  padding: 0 24px 0 40px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
}

.mc-label {
  flex: 1;
  text-align: center;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 6px 0;
  transition: background 0.15s, transform 0.15s;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mc-label--active {
  background: rgba(0, 0, 0, 0.04);
  transform: scale(1.05);
}

/* ─── Tooltip ─── */
.mc-tooltip {
  position: absolute;
  top: 60px;
  right: 24px;
  background: #1a2332;
  color: #e2e8f0;
  border-radius: 12px;
  padding: 14px 18px;
  font-size: 0.78rem;
  z-index: 10;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  min-width: 160px;
}

.mc-tt-title {
  font-weight: 700;
  font-size: 0.85rem;
  margin-bottom: 8px;
}

.mc-tt-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 2px 0;
}

.mc-tt-row span { color: #94a3b8; }
.mc-tt-row strong { color: #fff; }

.mc-tt-divider {
  height: 1px;
  background: #334155;
  margin: 6px 0;
}

/* ─── Legend ─── */
.mc-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid #f1f5f9;
}

.mc-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.72rem;
  color: #64748b;
  font-weight: 500;
}

.mc-legend-line {
  display: inline-block;
  width: 24px;
  height: 0;
  border-bottom: 2px solid;
}

.mc-legend-line--upper { border-color: #ef4444; }
.mc-legend-line--mid { border-color: #f59e0b; border-bottom-style: dashed; }
.mc-legend-line--lower { border-color: #3b82f6; }

/* ─── Transitions ─── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 700px) {
  .mc-half { height: 140px; }
  .mc-bar-val, .mc-bar-val--bottom { font-size: 0.55rem; }
  .mc-label { font-size: 0.58rem; }
  .mc-tooltip { position: static; margin-top: 12px; }
}
</style>
