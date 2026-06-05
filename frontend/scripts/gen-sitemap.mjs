// Sinh public/sitemap.xml từ NGUỒN CHUNG src/seo/route-seo.json + các bài blog trong content/blog.
// Tự chạy trước mỗi lần build (script "prebuild") hoặc gọi tay: npm run sitemap
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readArticles } from './blog-lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const seo = JSON.parse(readFileSync(resolve(here, '../src/seo/route-seo.json'), 'utf8'))
const DOMAIN = seo.domain
const today = process.env.SITEMAP_DATE || new Date().toISOString().slice(0, 10)

// 1) Trang công khai của app
const routes = seo.pages.map((p) => ({
  path: p.path,
  priority: p.priority || '0.8',
  changefreq: p.changefreq || 'monthly',
  lastmod: today,
}))

// 2) Blog (trang index + từng bài). Bỏ bài index:false (bản nháp/chờ duyệt) khỏi sitemap.
const posts = readArticles().filter((p) => p.index !== false)
if (posts.length) {
  routes.push({ path: '/blog/', priority: '0.7', changefreq: 'weekly', lastmod: posts[0].date || today })
  for (const p of posts) {
    routes.push({ path: `/blog/${p.slug}/`, priority: '0.7', changefreq: 'monthly', lastmod: p.date || today })
  }
}

const urls = routes
  .map(
    (r) => `  <url>
    <loc>${DOMAIN}${r.path}</loc>
    <lastmod>${r.lastmod}</lastmod>
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

const out = resolve(here, '../public/sitemap.xml')
writeFileSync(out, xml, 'utf8')
console.log(`✓ sitemap.xml: ${routes.length} URL (${posts.length} bài blog) → ${out}`)
