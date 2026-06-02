/**
 * heroThree.ts — Nạp Three.js (+ GLTFLoader, meshopt, dữ liệu toạ độ huyệt) cho cảnh 3D
 * TRANG TRÍ ở trang chủ: hình người THẬT (body-layers.glb) phát sáng + đường kinh chạy dọc.
 *
 * Dùng lại đúng các file "global" có sẵn trong public/kinhmach3d (không cần `npm three`).
 * Khác engine Kinh Mạch 3D (acuMap3d.ts): cảnh ở đây là RIÊNG, read-only, không toolbar/drawer,
 * KHÔNG kéo 2.6MB dữ liệu chi tiết huyệt — chỉ cần toạ độ (acu-coords3d.js, ~30KB) để rải đường kinh.
 * Tải TRỄ (chỉ khi banner thật sự hiện) → trang chủ vẫn nhẹ.
 */

const BASE = `${import.meta.env.BASE_URL || '/'}kinhmach3d/`
const THREE_SRC = `${BASE}vendor/three.min.js`
const GLTF_SRC = `${BASE}vendor/GLTFLoader.js`
const MESHOPT_SRC = `${BASE}vendor/meshopt_decoder.js`
const COORDS_SRC = `${BASE}data/acu-coords3d.js`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ThreeNS = any

const scriptPromises = new Map<string, Promise<void>>()

/** Nạp 1 script đúng 1 lần (dedupe theo URL); giữ thứ tự thực thi nhờ async=false. */
function loadScriptOnce(src: string): Promise<void> {
  const existing = scriptPromises.get(src)
  if (existing) return existing
  const p = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.async = false
    el.onload = () => resolve()
    el.onerror = () => reject(new Error(`Không tải được script: ${src}`))
    document.head.appendChild(el)
  })
  scriptPromises.set(src, p)
  return p
}

let threePromise: Promise<ThreeNS> | null = null

/** Trả về window.THREE, nạp 1 lần nếu chưa có (engine 3D có thể đã nạp sẵn → dùng lại). */
export function ensureThree(): Promise<ThreeNS> {
  const w = window as unknown as { THREE?: ThreeNS }
  if (w.THREE) return Promise.resolve(w.THREE)
  if (threePromise) return threePromise
  threePromise = loadScriptOnce(THREE_SRC).then(() => {
    const t = (window as unknown as { THREE?: ThreeNS }).THREE
    if (!t) throw new Error('THREE không khả dụng sau khi tải three.min.js')
    return t
  })
  return threePromise
}

/** Tải SẴN file .glb (song song với tải script) để khi GLTFLoader cần thì đã có trong cache. */
function preloadModel(): void {
  if (document.getElementById('hero-glb-preload')) return
  const link = document.createElement('link')
  link.id = 'hero-glb-preload'
  link.rel = 'preload'
  link.as = 'fetch' // GLTFLoader tải bằng XHR same-origin → KHÔNG đặt crossOrigin (khớp request, tránh tải 2 lần)
  link.href = `${BASE}models/body-layers.glb`
  document.head.appendChild(link)
}

/**
 * Nạp đủ để dựng hình người thật: THREE → GLTFLoader (gắn vào THREE) + meshopt + toạ độ huyệt.
 * GLTFLoader cần THREE có trước; meshopt & toạ độ độc lập nên tải song song. Model .glb preload ngay.
 */
export async function ensureModelDeps(): Promise<ThreeNS> {
  preloadModel() // bắt đầu tải model NGAY, chồng lên lúc tải đám script bên dưới
  const THREE = await ensureThree()
  await Promise.all([loadScriptOnce(GLTF_SRC), loadScriptOnce(MESHOPT_SRC), loadScriptOnce(COORDS_SRC)])
  return THREE
}

/** Trình duyệt có hỗ trợ WebGL không (để rơi-về hình SVG khi không có). */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')))
  } catch {
    return false
  }
}
