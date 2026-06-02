/**
 * heroThree.ts — Nạp Three.js cho cảnh 3D TRANG TRÍ ở trang chủ (hình người + đường kinh phát sáng).
 *
 * Dùng lại đúng bản Three "global" có sẵn trong public/kinhmach3d/vendor (không cần `npm three`).
 * Khác hẳn engine Kinh Mạch 3D (acuMap3d.ts):
 *   - Cảnh ở đây NHẸ: chỉ cần Three lõi, KHÔNG kéo GLTFLoader / mô hình .glb / 2.6MB dữ liệu huyệt.
 *   - Tải TRỄ: chỉ gọi khi component trang chủ thật sự gắn vào DOM → không làm chậm lần tải đầu.
 *   - Scene + WebGL context RIÊNG, tự huỷ khi rời trang chủ (xem HeroMeridianFigure.vue).
 *
 * Nếu engine 3D cũng đã nạp Three (window.THREE) thì ta dùng lại luôn, không tải đôi.
 */

const BASE = `${import.meta.env.BASE_URL || '/'}kinhmach3d/`
const THREE_SRC = `${BASE}vendor/three.min.js`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ThreeNS = any

let threePromise: Promise<ThreeNS> | null = null

/** Trả về window.THREE, nạp 1 lần nếu chưa có. */
export function ensureThree(): Promise<ThreeNS> {
  const w = window as unknown as { THREE?: ThreeNS }
  if (w.THREE) return Promise.resolve(w.THREE)
  if (threePromise) return threePromise

  threePromise = new Promise<ThreeNS>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = THREE_SRC
    el.async = true
    el.onload = () => {
      const t = (window as unknown as { THREE?: ThreeNS }).THREE
      if (t) resolve(t)
      else reject(new Error('THREE không khả dụng sau khi tải three.min.js'))
    }
    el.onerror = () => reject(new Error('Không tải được three.min.js'))
    document.head.appendChild(el)
  })
  return threePromise
}

/** Trình duyệt có hỗ trợ WebGL không (để rơi về hình Thái Cực SVG khi không có). */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')))
  } catch {
    return false
  }
}
