// gen-blog-images.mjs — Sinh ảnh minh hoạ AI cho các mục ## (H2) của bài blog đã có (content/blog/*.md).
//
// Lưu ảnh vào public/blog-images/<slug>/sec-N.png rồi chèn ![..](..) ngay dưới mỗi H2 chưa có ảnh.
// Dùng Yescale (OpenAI-compatible) — đọc YESCALE_API_KEY + YESCALE_IMAGE_MODEL từ backend/.env.
//
// TỐN CREDIT AI → phải nêu rõ slug hoặc --all. Dùng:
//   node scripts/gen-blog-images.mjs huyet-hop-coc do-nhiet-do-kinh-lac      # chỉ vài bài
//   node scripts/gen-blog-images.mjs --all                                   # mọi bài
//     [--max N]   số ảnh mỗi bài (mặc định 3, trần 6)
//     [--force]   chèn cả khi mục đã có ảnh
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const blogDir = resolve(here, '../content/blog')
const imgRoot = resolve(here, '../public/blog-images')

// ---- Nạp env từ backend/.env (chỉ lấy biến cần, không in) -----------------
function loadEnv() {
  const p = resolve(here, '../../backend/.env')
  const env = { ...process.env }
  if (existsSync(p)) {
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return env
}
const env = loadEnv()
const API_KEY = env.YESCALE_API_KEY
const BASE_URL = (env.YESCALE_BASE_URL || 'https://api.yescale.vip/v1').replace(/\/$/, '')
const IMAGE_MODEL = env.YESCALE_IMAGE_MODEL || 'dall-e-3'
const IMAGE_SIZE = env.YESCALE_IMAGE_SIZE || '1024x1024'
if (!API_KEY) {
  console.error('❌ Thiếu YESCALE_API_KEY (backend/.env). Dừng.')
  process.exit(1)
}

// ---- Tham số dòng lệnh ----------------------------------------------------
const args = process.argv.slice(2)
const force = args.includes('--force')
const all = args.includes('--all')
const maxI = args.indexOf('--max')
const MAX = Math.min(Math.max(1, maxI >= 0 ? parseInt(args[maxI + 1], 10) || 3 : 3), 6)
const slugs = args.filter((a) => !a.startsWith('--') && !(maxI >= 0 && a === args[maxI + 1]))
if (!all && !slugs.length) {
  console.error('Dùng: node scripts/gen-blog-images.mjs <slug...> | --all  [--max N] [--force]')
  process.exit(1)
}

// ---- Prompt ảnh (KHỚP backend buildImagePrompt — an toàn YMYL) -------------
function buildImagePrompt(title, heading) {
  return [
    'Decorative editorial illustration for a Vietnamese Traditional Medicine (Dong Y) blog.',
    `Article: "${title}". Section: "${heading}".`,
    'Style: warm and elegant, soft natural light, earthy brown and cream palette,',
    'motifs of medicinal herbs, gentle meridian energy lines, a calm traditional clinic.',
    'No text, no watermark, no precise anatomical acupoint map. Symbolic and artistic.',
  ].join(' ')
}

async function genImage(prompt) {
  const body = { model: IMAGE_MODEL, prompt, n: 1, size: IMAGE_SIZE, response_format: 'b64_json' }
  let res = await fetch(`${BASE_URL}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    // thử lại không kèm response_format (vài model không nhận)
    delete body.response_format
    res = await fetch(`${BASE_URL}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(body),
    })
  }
  if (!res.ok) throw new Error(`Yescale ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const d = data?.data?.[0]
  if (d?.b64_json) return Buffer.from(d.b64_json, 'base64')
  if (d?.url) {
    const r = await fetch(d.url)
    if (!r.ok) throw new Error('tải ảnh url thất bại')
    return Buffer.from(await r.arrayBuffer())
  }
  throw new Error('không có b64_json/url trong kết quả')
}

// ---- Tách frontmatter (giữ NGUYÊN khối ---), chỉ sửa body -----------------
function splitFm(raw) {
  const m = raw.match(/^(---\s*\n[\s\S]*?\n---\s*\n?)([\s\S]*)$/)
  if (!m) return null
  return { fmBlock: m[1], body: m[2] }
}
function fmField(block, key) {
  const m = block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
  if (!m) return ''
  try {
    const v = JSON.parse(m[1].trim())
    return Array.isArray(v) ? v.join(' ') : String(v)
  } catch {
    return m[1].trim().replace(/^["']|["']$/g, '')
  }
}

async function processFile(file) {
  const p = join(blogDir, file)
  const raw = readFileSync(p, 'utf8')
  const parts = splitFm(raw)
  if (!parts) {
    console.log('  bỏ qua (không frontmatter):', file)
    return 0
  }
  const slug = (fmField(parts.fmBlock, 'slug') || file.replace(/\.md$/, '')).trim()
  const title = fmField(parts.fmBlock, 'title') || slug
  const lines = parts.body.split('\n')
  const out = []
  let added = 0
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i])
    const h = lines[i].match(/^##\s+(.+?)\s*$/) // chỉ H2
    if (!h || added >= MAX) continue
    if (!force && /^!\[/.test((lines[i + 1] || '').trim())) continue
    const heading = h[1].replace(/[*_`#]/g, '').trim()
    try {
      const buf = await genImage(buildImagePrompt(title, heading))
      const dir = join(imgRoot, slug)
      mkdirSync(dir, { recursive: true })
      const fname = `sec-${added + 1}.png`
      writeFileSync(join(dir, fname), buf)
      out.push('', `![${heading}](/blog-images/${slug}/${fname})`)
      added++
      console.log(`  ✓ ${slug} · "${heading}" → ${fname}`)
    } catch (e) {
      console.error(`  ✗ ${slug} · "${heading}": ${e.message}`)
    }
  }
  if (added) writeFileSync(p, parts.fmBlock + out.join('\n'), 'utf8')
  return added
}

const files = (all ? readdirSync(blogDir).filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md') : slugs.map((s) => `${s}.md`))
console.log(`Model ảnh: ${IMAGE_MODEL} · size ${IMAGE_SIZE} · tối đa ${MAX} ảnh/bài\n`)
let total = 0
for (const f of files) {
  if (!existsSync(join(blogDir, f))) {
    console.log('  bỏ qua (không thấy file):', f)
    continue
  }
  total += await processFile(f)
}
console.log(`\n✓ gen-blog-images: đã chèn ${total} ảnh. Chạy 'npm run build-blog' (hoặc deploy) để lên web.`)
