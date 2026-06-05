// add-covers.mjs — Gắn ảnh bìa (frontmatter `image`) cho các bài content/blog/*.md còn thiếu.
//
// Ảnh bìa = 1 trong 12 sơ đồ đường kinh (ảnh sở hữu của web, không rủi ro bản quyền),
// phân bố theo slug để các bài khác ảnh nhau. CÙNG công thức với backend (pickCoverImage)
// để nhất quán với bài đăng từ module SEO.
//
// Dùng:  node scripts/add-covers.mjs          (bỏ qua bài đã có image)
//        node scripts/add-covers.mjs --force  (ghi đè image cũ)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dir = resolve(here, '../content/blog')

const COVERS = Array.from(
  { length: 12 },
  (_, i) => `/kinhmach3d/images/meridians/kinh-${String(i + 1).padStart(2, '0')}-sodo.jpg`,
)
function pickCover(slug) {
  const s = slug || 'bai-viet'
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return COVERS[h % COVERS.length]
}

const force = process.argv.includes('--force')
let n = 0
for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
  const p = join(dir, f)
  let raw = readFileSync(p, 'utf8')
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!m) {
    console.log('  bỏ qua (không có frontmatter):', f)
    continue
  }
  let fm = m[1]
  if (/^image:/m.test(fm) && !force) {
    console.log('  đã có image, bỏ qua:', f)
    continue
  }
  const slug = (fm.match(/^slug:\s*"?([^"\n]+)"?/m)?.[1] || f.replace(/\.md$/, '')).trim()
  const img = pickCover(slug)

  // gỡ image cũ (nếu --force) rồi chèn lại — đặt ngay sau dòng slug cho gọn.
  fm = fm
    .split('\n')
    .filter((line) => !/^image:/.test(line.trim()))
    .join('\n')
  if (/^slug:.*$/m.test(fm)) fm = fm.replace(/^(slug:.*)$/m, (s) => `${s}\nimage: "${img}"`)
  else fm = `${fm}\nimage: "${img}"`

  raw = raw.replace(m[0], () => `---\n${fm}\n---`)
  writeFileSync(p, raw, 'utf8')
  console.log(`  ✓ ${f} → ${img}`)
  n++
}
console.log(`✓ add-covers: gắn ảnh bìa cho ${n} bài (tổng ${readdirSync(dir).filter((x) => x.endsWith('.md')).length} bài).`)
