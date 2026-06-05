// Sinh public/sitemap.xml cho các trang CÔNG KHAI.
// Tự chạy trước mỗi lần build (script "prebuild" trong package.json) hoặc gọi tay: npm run sitemap
//
// Khi có blog (Phase 3): đọc thêm danh sách bài viết rồi nối vào mảng `routes`.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const DOMAIN = 'https://kinhlac.online'

// Danh sách trang công khai cần Google index. Thêm 1 dòng khi có trang mới.
const routes = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/thu-vien', priority: '0.9', changefreq: 'weekly' },
  { path: '/xem-3d', priority: '0.8', changefreq: 'monthly' },
  { path: '/xem-ket-qua-do', priority: '0.8', changefreq: 'monthly' },
  { path: '/xem-bai-thuoc', priority: '0.8', changefreq: 'monthly' },
]

// Ngày cập nhật (cho phép ghi đè qua biến môi trường để build tái lập được)
const today = process.env.SITEMAP_DATE || new Date().toISOString().slice(0, 10)

const urls = routes
  .map(
    (r) => `  <url>
    <loc>${DOMAIN}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`,
  )
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../public/sitemap.xml')
writeFileSync(out, xml, 'utf8')
console.log(`✓ sitemap.xml: ${routes.length} URL → ${out}`)
