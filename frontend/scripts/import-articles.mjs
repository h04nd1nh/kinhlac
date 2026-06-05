// import-articles.mjs — Nhập kết quả workflow viết bài (JSON) thành các file content/blog/<slug>.md.
//
// Dùng: node scripts/import-articles.mjs "<đường-dẫn-file-json>"
// File JSON có dạng { articles:[...] } hoặc { result:{ articles:[...] } }.
// Giải mã thực thể HTML (&gt; &amp; …) vì workflow trả về dạng đã encode.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const src = process.argv[2]
if (!src) {
  console.error('Cần đường dẫn file JSON kết quả. Vd: node scripts/import-articles.mjs result.json')
  process.exit(1)
}
const raw = JSON.parse(readFileSync(src, 'utf8'))
const articles = raw.articles || (raw.result && raw.result.articles) || []
if (!articles.length) {
  console.error('Không tìm thấy mảng articles trong file.')
  process.exit(1)
}

const decode = (s) =>
  String(s ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')

// CTA mục tiêu theo slug (workflow không trả field này).
const CTA = {
  'do-nhiet-do-kinh-lac-la-gi': '/xem-ket-qua-do',
  'cach-doc-ket-qua-do-kinh-lac': '/xem-ket-qua-do',
  'phan-mem-do-kinh-lac-online': '/xem-ket-qua-do',
  '12-duong-kinh-chinh': '/xem-3d',
  'huyet-hop-coc': '/thu-vien',
  'huyet-tuc-tam-ly': '/thu-vien',
  'huyet-tam-am-giao': '/thu-vien',
  'phuong-phap-le-van-suu': '/xem-ket-qua-do',
  'tinh-vi-quy-kinh-la-gi': '/xem-bai-thuoc',
  'so-hoa-phong-kham-dong-y': '/app',
}

const DATE = process.env.ARTICLE_DATE || '2026-06-05'
const AUTHOR = 'Ban Biên Tập Kinh Lạc'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../content/blog')
mkdirSync(outDir, { recursive: true })

const j = (v) => JSON.stringify(v)
let n = 0
for (const a of articles) {
  if (!a || !a.slug) continue
  const faq = Array.isArray(a.faq) ? a.faq.map((f) => ({ q: decode(f.q), a: decode(f.a) })) : []
  const fm = [
    '---',
    `title: ${j(decode(a.title))}`,
    `description: ${j(decode(a.description))}`,
    `slug: ${j(a.slug)}`,
    `date: ${j(DATE)}`,
    `author: ${j(AUTHOR)}`,
    `category: ${j(decode(a.category || ''))}`,
    `cluster: ${j(a.cluster || '')}`,
    `cta: ${j(CTA[a.slug] || '/xem-ket-qua-do')}`,
    `keywords: ${j((a.keywords || []).map(decode))}`,
    `faq: ${j(faq)}`,
    '---',
    '',
  ].join('\n')
  const body = decode(a.markdownBody || '').trim()
  writeFileSync(join(outDir, `${a.slug}.md`), fm + body + '\n', 'utf8')
  n++
  console.log(`  ✓ ${a.slug}.md`)
}
console.log(`✓ import-articles: ${n} bài → content/blog/`)
