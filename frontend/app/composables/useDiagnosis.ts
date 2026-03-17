/**
 * Logic chẩn đoán Bát Cương - port từ webapp diagnosis.js (Kinh Lạc Gia Minh)
 * Dùng khi có inputData từ backend để tính meridianStats, baselines, categories, batCuongTong.
 */

export interface MeridianStat {
  name: string
  group: 'tren' | 'duoi'
  leftValue: number
  rightValue: number
  avg: number
  absDelta: number
  diff: number
  baseline: number
  upLimit: number
  lowLimit: number
  leftStatus: string
  rightStatus: string
  batCuong: string
}

export interface DiagnosisResult {
  meridianStats: Record<string, MeridianStat>
  categories: { lyNhiet: string[]; lyHan: string[]; bieuNhiet: string[]; bieuHan: string[] }
  batCuongTong: { amDuong: string; bieuLy: string; hanNhiet: string; huThuc: string }
  khihuyetConclusion: string
  conclusion: string
  baselines: {
    max_tren: number
    min_tren: number
    range_tren: number
    avg_tren: number
    step_tren: number
    up_tren: number
    low_tren: number
    max_duoi: number
    min_duoi: number
    range_duoi: number
    avg_duoi: number
    step_duoi: number
    up_duoi: number
    low_duoi: number
  }
}

/** Record từ backend: key có thể là phetrai/phephai hoặc pheTrai/phePhai */
function getVal(data: Record<string, unknown>, id: string, side: 'Trai' | 'Phai'): number {
  const v1 = data[id + side.charAt(0).toLowerCase() + side.slice(1).toLowerCase()] // phetrai, phephai
  const v2 = data[id + side] // pheTrai, phePhai
  const v = v1 ?? v2
  return typeof v === 'number' ? v : parseFloat(String(v)) || 0
}

function round2(v: number) {
  return Math.round(v * 100) / 100
}

function calcBaseline(values: number[]) {
  if (!values || values.length === 0) {
    return { max: 37, min: 35, range: 2, avg: 36, step: 2 / 6, up: 36 + 2 / 6, low: 36 - 2 / 6 }
  }
  const max = Math.max(...values, 37)
  const min = Math.min(...values, 35)
  const range = round2(max - min)
  const avg = round2((max + min) / 2)
  const step = round2(range / 6)
  const up = round2(avg + step)
  const low = round2(avg - step)
  return { max, min, range, avg, step, up, low }
}

function getStatus(val: number, up: number, low: number): string {
  if (val === null || val === undefined || val === 0) return ''
  if (val > up) return '+'
  if (val < low) return '-'
  return ''
}

function getBatCuong(leftStatus: string, rightStatus: string): string {
  if (leftStatus === '+' && rightStatus === '+') return 'Lý Nhiệt'
  if (leftStatus === '-' && rightStatus === '-') return 'Lý Hàn'
  if (leftStatus === '+' || rightStatus === '+') return 'Biểu Nhiệt'
  if (leftStatus === '-' || rightStatus === '-') return 'Biểu Hàn'
  return ''
}

const MERIDIAN_DEFS = [
  { id: 'phe', name: 'Phế', group: 'tren' as const },
  { id: 'daitrang', name: 'Đại Trường', group: 'tren' as const },
  { id: 'tam', name: 'Tâm', group: 'tren' as const },
  { id: 'tieutruong', name: 'Tiểu Trường', group: 'tren' as const },
  { id: 'tambao', name: 'Tâm Bào', group: 'tren' as const },
  { id: 'tamtieu', name: 'Tam Tiêu', group: 'tren' as const },
  { id: 'vi', name: 'Vị', group: 'duoi' as const },
  { id: 'ty', name: 'Tỳ', group: 'duoi' as const },
  { id: 'bangquang', name: 'Bàng Quang', group: 'duoi' as const },
  { id: 'than', name: 'Thận', group: 'duoi' as const },
  { id: 'dam', name: 'Đởm', group: 'duoi' as const },
  { id: 'can', name: 'Can', group: 'duoi' as const },
]

/** Thứ tự hiển thị bảng (giống webapp): Chi trên = tieutruong..phe, Chi dưới = bangquang..ty */
export const MERIDIAN_DISPLAY_ORDER = [
  { id: 'tieutruong', n: 'Tiểu Trường', group: 'tren' as const },
  { id: 'tam', n: 'Tâm', group: 'tren' as const },
  { id: 'tamtieu', n: 'Tam Tiêu', group: 'tren' as const },
  { id: 'tambao', n: 'Tâm Bào', group: 'tren' as const },
  { id: 'daitrang', n: 'Đại Trường', group: 'tren' as const },
  { id: 'phe', n: 'Phế', group: 'tren' as const },
  { id: 'bangquang', n: 'Bàng Quang', group: 'duoi' as const },
  { id: 'than', n: 'Thận', group: 'duoi' as const },
  { id: 'dam', n: 'Đảm', group: 'duoi' as const },
  { id: 'vi', n: 'Vị', group: 'duoi' as const },
  { id: 'can', n: 'Can', group: 'duoi' as const },
  { id: 'ty', n: 'Tỳ', group: 'duoi' as const },
]

export function performFullDiagnosis(inputData: Record<string, unknown>): DiagnosisResult | null {
  const data = inputData as Record<string, number>
  const trenValues = [
    getVal(data, 'phe', 'Trai'), getVal(data, 'phe', 'Phai'),
    getVal(data, 'daitrang', 'Trai'), getVal(data, 'daitrang', 'Phai'),
    getVal(data, 'tam', 'Trai'), getVal(data, 'tam', 'Phai'),
    getVal(data, 'tieutruong', 'Trai'), getVal(data, 'tieutruong', 'Phai'),
    getVal(data, 'tambao', 'Trai'), getVal(data, 'tambao', 'Phai'),
    getVal(data, 'tamtieu', 'Trai'), getVal(data, 'tamtieu', 'Phai'),
  ].filter(v => v > 0)

  const duoiValues = [
    getVal(data, 'vi', 'Trai'), getVal(data, 'vi', 'Phai'),
    getVal(data, 'ty', 'Trai'), getVal(data, 'ty', 'Phai'),
    getVal(data, 'bangquang', 'Trai'), getVal(data, 'bangquang', 'Phai'),
    getVal(data, 'than', 'Trai'), getVal(data, 'than', 'Phai'),
    getVal(data, 'dam', 'Trai'), getVal(data, 'dam', 'Phai'),
    getVal(data, 'can', 'Trai'), getVal(data, 'can', 'Phai'),
  ].filter(v => v > 0)

  const bTren = calcBaseline(trenValues)
  const bDuoi = calcBaseline(duoiValues)

  const meridianStats: Record<string, MeridianStat> = {}
  const categories = { lyNhiet: [] as string[], lyHan: [] as string[], bieuNhiet: [] as string[], bieuHan: [] as string[] }

  MERIDIAN_DEFS.forEach(m => {
    const b = m.group === 'tren' ? bTren : bDuoi
    const L = getVal(data, m.id, 'Trai')
    const R = getVal(data, m.id, 'Phai')
    const avg = round2((L + R) / 2)
    const leftSt = getStatus(L, b.up, b.low)
    const rightSt = getStatus(R, b.up, b.low)
    const bat = getBatCuong(leftSt, rightSt)
    let diff = 0
    if (leftSt === '+') diff = round2(L - b.up)
    else if (leftSt === '-') diff = round2(L - b.low)
    else if (rightSt === '+') diff = round2(R - b.up)
    else if (rightSt === '-') diff = round2(R - b.low)

    meridianStats[m.id] = {
      name: m.name,
      group: m.group,
      leftValue: L,
      rightValue: R,
      avg,
      absDelta: round2(Math.abs(L - R)),
      diff,
      baseline: b.avg,
      upLimit: b.up,
      lowLimit: b.low,
      leftStatus: leftSt,
      rightStatus: rightSt,
      batCuong: bat,
    }
    if (bat === 'Lý Nhiệt') categories.lyNhiet.push(m.name)
    else if (bat === 'Lý Hàn') categories.lyHan.push(m.name)
    else if (bat === 'Biểu Nhiệt') categories.bieuNhiet.push(m.name)
    else if (bat === 'Biểu Hàn') categories.bieuHan.push(m.name)
  })

  const totalThuc = Object.values(meridianStats).filter(s => s.leftStatus === '+' || s.rightStatus === '+').length
  const totalHu = Object.values(meridianStats).filter(s => s.leftStatus === '-' || s.rightStatus === '-').length

  const amDuong = bTren.avg > bDuoi.avg + 1 ? 'DƯƠNG THỊNH' : bDuoi.avg > bTren.avg + 1 ? 'ÂM THỊNH' : 'CÂN BẰNG'
  const totalLy = categories.lyNhiet.length + categories.lyHan.length
  const bieuLy = totalLy >= 4 ? 'LÝ' : 'BIỂU'
  const totalNhiet = categories.lyNhiet.length + categories.bieuNhiet.length
  const totalHan2 = categories.lyHan.length + categories.bieuHan.length
  const hanNhiet = totalNhiet >= totalHan2 ? 'NHIỆT' : 'HÀN'
  const huThuc = totalThuc >= totalHu ? 'THỰC' : 'HƯ'

  let thucTren = 0, huTren = 0, thucDuoi = 0, huDuoi = 0
  MERIDIAN_DEFS.forEach(m => {
    const s = meridianStats[m.id]
    if (!s) return
    const thuc = s.leftStatus === '+' || s.rightStatus === '+'
    const hu = s.leftStatus === '-' || s.rightStatus === '-'
    if (m.group === 'tren') {
      if (thuc) thucTren++
      if (hu) huTren++
    } else {
      if (thuc) thucDuoi++
      if (hu) huDuoi++
    }
  })
  const amDuongPart = amDuong === 'DƯƠNG THỊNH' ? 'Âm hư' : amDuong === 'ÂM THỊNH' ? 'Dương hư' : ''
  const khiPart = thucTren > huTren ? 'Khí thịnh' : thucTren < huTren ? 'Khí hư' : ''
  const huyetPart = thucDuoi > huDuoi ? 'Huyết thịnh' : thucDuoi < huDuoi ? 'Huyết hư' : ''
  const khihuyetConclusion = [amDuongPart, khiPart, huyetPart].filter(Boolean).join(' - ')

  return {
    meridianStats,
    categories,
    batCuongTong: { amDuong, bieuLy, hanNhiet, huThuc },
    khihuyetConclusion,
    conclusion: '',
    baselines: {
      max_tren: bTren.max, min_tren: bTren.min, range_tren: bTren.range,
      avg_tren: bTren.avg, step_tren: bTren.step, up_tren: bTren.up, low_tren: bTren.low,
      max_duoi: bDuoi.max, min_duoi: bDuoi.min, range_duoi: bDuoi.range,
      avg_duoi: bDuoi.avg, step_duoi: bDuoi.step, up_duoi: bDuoi.up, low_duoi: bDuoi.low,
    },
  }
}

/** Chuẩn hóa inputData từ backend (key lowercase) sang dạng Trai/Phai cho diagnosis */
export function normalizeInputForDiagnosis(inputData: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  const ids = ['phe', 'daitrang', 'tam', 'tieutruong', 'tambao', 'tamtieu', 'vi', 'ty', 'bangquang', 'than', 'dam', 'can']
  ids.forEach(id => {
    out[id + 'Trai'] = inputData[id + 'trai'] ?? inputData[id + 'Trai'] ?? 0
    out[id + 'Phai'] = inputData[id + 'phai'] ?? inputData[id + 'Phai'] ?? 0
  })
  return out
}
