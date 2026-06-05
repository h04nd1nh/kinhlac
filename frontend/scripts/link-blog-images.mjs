// link-blog-images.mjs — Tự gắn ảnh bìa vào bài: nếu có file public/blog/assets/<slug>.(webp|jpg|png)
// thì điền frontmatter `image` cho content/blog/<slug>.md. CHỈ gắn khi file ảnh CÓ thật → không bao giờ ảnh vỡ.
//
// Cách dùng:
//   1. Chụp/xuất ảnh từ app (đồ hình 3D /xem-3d, biểu đồ /xem-ket-qua-do, radar /xem-bai-thuoc, Từ Điển…).
//   2. Lưu vào public/blog/assets/ ĐẶT TÊN ĐÚNG BẰNG SLUG bài, vd: 12-duong-kinh-chinh.webp
//   3. Chạy:  npm run link-images        (thêm --force để ghi đè bài đã có image)
//   4. Build lại:  npm run build-blog
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { readArticles, writeArticle } from './blog-lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const assetsDir = process.env.BLOG_ASSETS_DIR
  ? resolve(process.env.BLOG_ASSETS_DIR)
  : resolve(here, '../public/blog/assets')
const force = process.argv.includes('--force')
const EXTS = ['webp', 'jpg', 'jpeg', 'png']

let n = 0
for (const a of readArticles()) {
  if (a.image && !force) continue
  const ext = EXTS.find((e) => existsSync(join(assetsDir, `${a.slug}.${e}`)))
  if (!ext) continue
  writeArticle({ ...a, image: `/blog/assets/${a.slug}.${ext}`, body: a.bodyMarkdown })
  n++
  console.log(`  ✓ ${a.slug} → /blog/assets/${a.slug}.${ext}`)
}
console.log(
  n
    ? `✓ link-blog-images: gắn ảnh bìa cho ${n} bài. Nhớ chạy: npm run build-blog`
    : '… chưa thấy ảnh nào khớp slug trong public/blog/assets/ (đặt tên file = slug bài).',
)
