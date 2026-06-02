<script setup lang="ts">
/**
 * HeroMeridianFigure — "Đồ hình kinh lạc phát sáng" 3D NHẸ cho tâm vòng tròn trang chủ.
 *
 * Một thân người cách điệu (mờ ảo như cơ thể ánh sáng) + các đường kinh chính phát sáng chạy dọc
 * theo tay/chân/thân, mỗi đường có một "đốm khí" trôi dọc (hiệu ứng kinh khí vận hành). Cả khối
 * tự xoay chậm. KHÔNG dùng mô hình giải phẫu nặng — chỉ Three.js lõi (tải trễ qua heroThree.ts),
 * nên trang chủ vẫn nhẹ. Cảnh tự huỷ (giải phóng WebGL) khi rời trang.
 *
 * Toạ độ quy ước: x = trái/phải, y = dưới→trên, z = sau(−)/trước(+). Thân cao ~2 đơn vị, tâm ở gốc.
 */
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { ensureThree, hasWebGL } from '@/lib/heroThree'

const emit = defineEmits<{ ready: [] }>()

const host = ref<HTMLDivElement | null>(null)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

let raf = 0
let renderer: Any = null
let scene: Any = null
let camera: Any = null
let figure: Any = null // Group cha (xoay)
let flows: { curve: Any; dot: Any; speed: number; phase: number }[] = []
const disposables: Any[] = [] // geometry + material để dọn khi unmount
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let bootIo: IntersectionObserver | null = null
let booted = false
let alive = true
let visible = true
let inView = true
let reduceMotion = false
let startMs = 0 // mốc thời gian (đặt ở frame đầu, tránh new Date() lúc khởi tạo)

// ── Bảng màu đường kinh (sáng, nổi trên nền nâu tối ở tâm medallion) ──
const C_CV = 0xffd98a // Mạch Nhâm — vàng kim ấm (giữa thân trước)
const C_GV = 0x86c5f2 // Mạch Đốc — lam trời (giữa lưng, vòng qua đầu)
const C_ARM_YIN = 0xff7283 // 3 kinh Âm ở tay (mặt trong) — hồng đỏ
const C_ARM_YANG = 0xffb072 // 3 kinh Dương ở tay (mặt ngoài) — cam
const C_LEG_YANG = 0xffe07a // 3 kinh Dương ở chân (trước/ngoài) — vàng
const C_LEG_YIN = 0x9fe089 // 3 kinh Âm ở chân (trong) — lục

type P = [number, number, number]

/** Lật toạ độ sang bên phải cơ thể (đổi dấu x) để vẽ đối xứng. */
function mirror(pts: P[]): P[] {
  return pts.map(([x, y, z]) => [-x, y, z] as P)
}

/** Ống phát sáng đi qua các điểm (đường kinh). Trả về mesh + đường cong (để cho đốm khí trôi). */
function glowTube(THREE: Any, pts: P[], radius: number, color: number) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])))
  const geo = new THREE.TubeGeometry(curve, 80, radius, 6, false)
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  disposables.push(geo, mat)
  return { mesh: new THREE.Mesh(geo, mat), curve }
}

/** "Đốm khí" sáng trôi dọc một đường kinh. */
function makeDot(THREE: Any, radius: number, color: number) {
  const geo = new THREE.SphereGeometry(radius * 2.6, 10, 10)
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  disposables.push(geo, mat)
  return new THREE.Mesh(geo, mat)
}

/** Khối thân người mờ ảo (đầu, cổ, thân, 2 tay, 2 chân, bàn tay/chân). */
function buildBody(THREE: Any): Any {
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xf3e3c4,
    emissive: 0x6b4a25,
    emissiveIntensity: 0.5,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  disposables.push(bodyMat)

  const addMesh = (geo: Any) => {
    disposables.push(geo)
    g.add(new THREE.Mesh(geo, bodyMat))
  }

  // Đầu + cổ
  const head = new THREE.SphereGeometry(0.15, 24, 24)
  head.translate(0, 0.8, 0)
  addMesh(head)
  const neck = new THREE.CylinderGeometry(0.05, 0.06, 0.1, 16)
  neck.translate(0, 0.62, 0)
  addMesh(neck)

  // Thân: tiện tròn (LatheGeometry) theo mặt cắt (bán kính, cao)
  const profile: P[] = [
    [0.02, 0.62, 0],
    [0.115, 0.55, 0],
    [0.135, 0.42, 0],
    [0.115, 0.22, 0],
    [0.1, 0.05, 0],
    [0.135, -0.05, 0],
    [0.11, -0.12, 0],
    [0.02, -0.16, 0],
  ]
  const lathe = new THREE.LatheGeometry(
    profile.map((p) => new THREE.Vector2(p[0], p[1])),
    28,
  )
  addMesh(lathe)

  // Chi (tay/chân): ống bám theo đường cong, bán kính cố định
  const limb = (pts: P[], r: number) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])))
    addMesh(new THREE.TubeGeometry(curve, 40, r, 10, false))
  }
  const armL: P[] = [
    [-0.155, 0.55, 0],
    [-0.27, 0.33, 0.0],
    [-0.3, 0.18, 0.02],
    [-0.34, -0.02, 0.04],
    [-0.36, -0.16, 0.05],
  ]
  const legL: P[] = [
    [-0.085, -0.1, 0],
    [-0.115, -0.4, 0.02],
    [-0.12, -0.52, 0.03],
    [-0.11, -0.78, 0.03],
    [-0.105, -0.97, 0.04],
  ]
  limb(armL, 0.048)
  limb(mirror(armL), 0.048)
  limb(legL, 0.06)
  limb(mirror(legL), 0.06)

  // Bàn tay / bàn chân
  const blob = (x: number, y: number, z: number, r: number) => {
    const s = new THREE.SphereGeometry(r, 12, 12)
    s.translate(x, y, z)
    addMesh(s)
  }
  blob(-0.37, -0.2, 0.05, 0.05)
  blob(0.37, -0.2, 0.05, 0.05)
  blob(-0.105, -0.99, 0.1, 0.05)
  blob(0.105, -0.99, 0.1, 0.05)

  return g
}

/** Toàn bộ đường kinh phát sáng + đốm khí trôi. */
function buildMeridians(THREE: Any): Any {
  const g = new THREE.Group()
  const TR = 0.013 // bán kính ống đường kinh

  // Mỗi kênh: điểm + màu. Tay/chân định nghĩa bên TRÁI rồi soi gương sang phải.
  const armYin: P[] = [
    [-0.1, 0.5, 0.12],
    [-0.18, 0.5, 0.08],
    [-0.27, 0.34, 0.05],
    [-0.31, 0.18, 0.06],
    [-0.345, -0.02, 0.07],
    [-0.37, -0.18, 0.06],
  ]
  const armYang: P[] = [
    [-0.05, 0.6, -0.02],
    [-0.16, 0.56, -0.04],
    [-0.27, 0.34, -0.05],
    [-0.31, 0.18, -0.04],
    [-0.35, -0.02, -0.02],
    [-0.37, -0.18, 0.0],
  ]
  const legYang: P[] = [
    [-0.1, -0.06, 0.13],
    [-0.12, -0.3, 0.12],
    [-0.13, -0.52, 0.11],
    [-0.115, -0.78, 0.1],
    [-0.11, -0.96, 0.13],
  ]
  const legYin: P[] = [
    [-0.05, -0.12, 0.08],
    [-0.085, -0.34, 0.07],
    [-0.1, -0.52, 0.06],
    [-0.1, -0.78, 0.06],
    [-0.1, -0.95, 0.07],
  ]
  // Mạch giữa (không soi gương)
  const ren: P[] = [
    [0, -0.12, 0.13],
    [0, 0.05, 0.15],
    [0, 0.25, 0.155],
    [0, 0.42, 0.15],
    [0, 0.55, 0.11],
    [0, 0.63, 0.07],
  ]
  const du: P[] = [
    [0, -0.12, -0.12],
    [0, 0.1, -0.15],
    [0, 0.35, -0.155],
    [0, 0.55, -0.13],
    [0, 0.7, -0.08],
    [0, 0.82, 0.0],
    [0, 0.9, 0.09],
  ]

  const channels: { pts: P[]; color: number }[] = [
    { pts: ren, color: C_CV },
    { pts: du, color: C_GV },
    { pts: armYin, color: C_ARM_YIN },
    { pts: mirror(armYin), color: C_ARM_YIN },
    { pts: armYang, color: C_ARM_YANG },
    { pts: mirror(armYang), color: C_ARM_YANG },
    { pts: legYang, color: C_LEG_YANG },
    { pts: mirror(legYang), color: C_LEG_YANG },
    { pts: legYin, color: C_LEG_YIN },
    { pts: mirror(legYin), color: C_LEG_YIN },
  ]

  channels.forEach((ch, i) => {
    const { mesh, curve } = glowTube(THREE, ch.pts, TR, ch.color)
    g.add(mesh)
    const dot = makeDot(THREE, TR, 0xffffff)
    dot.material.color.set(ch.color)
    g.add(dot)
    flows.push({ curve, dot, speed: 0.1 + (i % 3) * 0.022, phase: (i * 0.137) % 1 })
  })

  return g
}

function init(THREE: Any) {
  const el = host.value
  if (!el) return
  const w = Math.max(1, el.clientWidth)
  const h = Math.max(1, el.clientHeight)

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 50)
  camera.position.set(0, 0.04, 3.9)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(w, h)
  renderer.setClearColor(0x000000, 0)
  if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding
  el.appendChild(renderer.domElement)
  renderer.domElement.style.display = 'block'

  // Ánh sáng dịu để thân có khối (đường kinh dùng MeshBasic nên không phụ thuộc đèn → vẫn rực).
  scene.add(new THREE.AmbientLight(0xffffff, 0.7))
  const key = new THREE.PointLight(0xffe9c4, 1.1)
  key.position.set(1.4, 1.6, 2.2)
  scene.add(key)

  figure = new THREE.Group()
  figure.add(buildBody(THREE))
  figure.add(buildMeridians(THREE))
  figure.scale.setScalar(0.95)
  figure.rotation.x = -0.12 // nghiêng nhẹ để thấy chiều sâu
  scene.add(figure)

  // Theo dõi kích thước khung (overlay co theo vòng tròn).
  ro = new ResizeObserver(onResize)
  ro.observe(el)
  // Tạm dừng khi cuộn khỏi tầm nhìn (tiết kiệm GPU); cuộn lại thì chạy tiếp.
  io = new IntersectionObserver((ents) => {
    inView = ents[0]?.isIntersecting ?? true
    if (inView && visible && alive && !raf) raf = requestAnimationFrame(loop)
  })
  io.observe(el)
  document.addEventListener('visibilitychange', onVisibility)

  reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  emit('ready')
  raf = requestAnimationFrame(loop)
}

function onResize() {
  const el = host.value
  if (!el || !renderer || !camera) return
  const w = Math.max(1, el.clientWidth)
  const h = Math.max(1, el.clientHeight)
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

function onVisibility() {
  visible = !document.hidden
  if (visible && inView && alive && !raf) raf = requestAnimationFrame(loop)
}

function loop(ms: number) {
  raf = 0
  if (!alive) return
  if (!startMs) startMs = ms
  const t = (ms - startMs) / 1000

  if (!reduceMotion) {
    figure.rotation.y = t * 0.28 // xoay chậm, thiền định
    for (const f of flows) {
      const u = (t * f.speed + f.phase) % 1
      f.dot.position.copy(f.curve.getPointAt(u))
      // nhấp nháy nhẹ độ sáng đốm khí
      f.dot.material.opacity = 0.55 + 0.4 * Math.sin((u + f.phase) * Math.PI * 2)
    }
  }

  renderer.render(scene, camera)
  if (reduceMotion) return // tĩnh: vẽ 1 khung là đủ, không lặp
  // Chỉ chạy vòng lặp khi đang hiển thị + trong tầm nhìn.
  if (visible && inView) raf = requestAnimationFrame(loop)
}

async function boot() {
  if (booted || !alive) return
  booted = true
  try {
    const THREE = await ensureThree()
    if (!alive) return
    init(THREE)
  } catch {
    // Tải/Khởi tạo lỗi → im lặng, vòng tròn vẫn hiển thị Thái Cực như cũ.
  }
}

onMounted(() => {
  if (!hasWebGL()) return // không có WebGL → giữ hình Thái Cực SVG làm nền (không emit ready)
  const el = host.value
  if (!el) return
  // Chỉ tải Three.js + dựng cảnh khi vòng tròn THỰC SỰ hiện ra (bỏ qua khi ẩn trên mobile,
  // hoãn cho tới khi cuộn tới) → trang chủ nhẹ, không tốn 600KB cho phần không nhìn thấy.
  bootIo = new IntersectionObserver((ents) => {
    if (ents.some((e) => e.isIntersecting)) {
      bootIo?.disconnect()
      bootIo = null
      boot()
    }
  })
  bootIo.observe(el)
})

onBeforeUnmount(() => {
  alive = false
  if (raf) cancelAnimationFrame(raf)
  document.removeEventListener('visibilitychange', onVisibility)
  bootIo?.disconnect()
  ro?.disconnect()
  io?.disconnect()
  for (const d of disposables) d.dispose?.()
  disposables.length = 0
  flows = []
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss?.()
    renderer.domElement?.remove()
    renderer = null
  }
  scene = null
  camera = null
  figure = null
})
</script>

<template>
  <div ref="host" class="hero-figure" aria-hidden="true"></div>
</template>

<style scoped>
.hero-figure {
  width: 100%;
  height: 100%;
  /* Toả sáng nhẹ ra ngoài để hình người "phát quang" hoà vào tâm medallion */
  filter: drop-shadow(0 0 10px rgba(255, 224, 170, 0.25));
}
.hero-figure :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
}
</style>
