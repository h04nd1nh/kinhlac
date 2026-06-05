# Hợp đồng tích hợp Blog (cho module SEO Radar & người viết bài)

> Hệ blog tĩnh: mỗi bài là 1 file Markdown trong `content/blog/`, khi build sẽ thành 1 trang
> HTML tĩnh chuẩn SEO tại `dist/blog/<slug>/index.html` (đủ `<title>`, meta, Open Graph,
> JSON-LD Article/Breadcrumb/FAQPage). Đây là "đầu ra" mà Phase 2/3 của module SEO Radar nối vào.

## 1. Cách đưa 1 bài vào blog

**Cách khuyến nghị (cho backend / tự động):** dựng JSON rồi gọi script cầu nối — KHÔNG cần biết
chi tiết định dạng Markdown:

```bash
# Từ file JSON (1 bài, hoặc mảng, hoặc {articles:[...]}, hoặc {result:{articles:[...]}})
node scripts/publish-article.mjs --from bai.json

# Hoặc pipe qua stdin (backend NestJS spawn tiến trình):
echo '<json>' | node scripts/publish-article.mjs --stdin
```

Script sẽ ghi `content/blog/<slug>.md` đúng định dạng. Sau đó chạy `npm run build` (hoặc deploy)
để sinh HTML + cập nhật `sitemap.xml`.

**Cách thủ công:** tạo tay file `content/blog/<slug>.md` theo mẫu mục 3.

## 2. JSON 1 bài (field + alias cột DB)

| Field | Bắt buộc | Ghi chú |
|---|---|---|
| `slug` | nên có | không có thì tự sinh từ `title` (bỏ dấu). |
| `title` | ✅ | tiêu đề (sẽ thành H1 + `<title>`). |
| `description` | ✅ | meta description, ≤ 155 ký tự. |
| `body` / `markdownBody` / `body_markdown` | ✅ | thân bài Markdown, KHÔNG có H1. |
| `date` | | mặc định hôm nay (YYYY-MM-DD). |
| `author` | | mặc định "Ban Biên Tập Kinh Lạc". |
| `updated` | | ngày cập nhật (YYYY-MM-DD); mặc định = `date`. Hiện "Cập nhật …" + `dateModified` (JSON-LD). |
| `reviewer` | | người duyệt chuyên môn; mặc định "Trương Đình Trang" → `reviewedBy` (Person, JSON-LD). |
| `reviewerTitle` | | chức danh người duyệt; mặc định "Y Sỹ Y Học Cổ Truyền (đang theo học)". |
| `category`, `cluster` | | phân loại + nhóm từ khoá (A/B/C). |
| `cta` | | đường dẫn CTA cuối bài: `/xem-ket-qua-do`, `/xem-3d`, `/xem-bai-thuoc`, `/thu-vien`, `/app`. |
| `keywords` | | mảng từ khoá. |
| `faq` | | mảng `[{q,a}]` → sinh mục FAQ + JSON-LD FAQPage. |
| `sources` | | mảng nguồn tham khảo: `["Sách …"]` hoặc `[{"title","url"}]` → mục "Nguồn Tham Khảo" + `citation` (JSON-LD). **KHÔNG bịa nguồn.** |
| `index` | | **`false` = noindex + KHÔNG vào sitemap/danh sách** (bản nháp/chờ duyệt). Bỏ trống = đăng bình thường. |
| `image` | | ảnh OG riêng (mặc định `/og-default.png`). |
| `seoCumId` / `seo_cum_id` | | id cụm gợi ý (`seo_cum`) để truy vết. |
| `aiModel` / `ai_model` | | model đã viết (vd "Yescale deepseek-v3.2"). |

Script tự giải mã thực thể HTML (`&gt; &amp; …`) nếu AI trả về dạng encode.

## 3. Mẫu file `content/blog/<slug>.md`

```markdown
---
title: "Đo Nhiệt Độ Kinh Lạc Là Gì?"
description: "Mô tả ngắn ≤155 ký tự."
slug: "do-nhiet-do-kinh-lac-la-gi"
date: "2026-06-05"
author: "Ban Biên Tập Kinh Lạc"
category: "Đo Kinh Lạc"
cluster: "A"
cta: "/xem-ket-qua-do"
keywords: ["đo nhiệt độ kinh lạc","24 tỉnh huyệt"]
faq: [{"q":"Hỏi?","a":"Đáp."}]
sources: ["Lê Văn Sửu — Biện Chứng Luận Trị", {"title":"Bài báo VUSTA","url":"https://vusta.vn/..."}]
---
Thân bài Markdown ở đây (không có tiêu đề H1, dùng ## cho đề mục).
```

> Giá trị frontmatter nên là JSON hợp lệ (chuỗi trong ngoặc kép, mảng/đối tượng dạng JSON).
> Cũng chấp nhận chuỗi không ngoặc kép cho các field đơn giản.
> `updated`, `reviewer`, `reviewerTitle`, `sources` đều **tuỳ chọn** — bỏ trống thì dùng mặc định
> (người duyệt = Trương Đình Trang · Y Sỹ Y Học Cổ Truyền (đang theo học); `updated` = `date`;
> không có `sources` thì ẩn mục "Nguồn Tham Khảo").

## 4. Van an toàn YMYL (nội dung Y tế)

- **Tự gắn cho MỌI bài** (không phải khai báo): khối tác giả + **người duyệt chuyên môn** + ngày cập nhật
  (dưới tiêu đề), hộp **miễn trừ y tế** và **disclosure "có hỗ trợ AI"** (đáy bài) + JSON-LD
  `author`/`reviewedBy`/`dateModified`. → chuẩn E-E-A-T.
- Bài có **lời khuyên chẩn đoán/điều trị** chưa được duyệt → đặt `"index": false`.
  → vẫn có URL để xem/duyệt, nhưng `noindex` + không vào sitemap + không hiện ở `/blog/`.
- Khi người duyệt đồng ý → bỏ `index` (hoặc đặt `true`) rồi build lại → bài lên Google.

## 5. Build & deploy

- Local: `npm run build` (tự chạy `gen-sitemap` → `vite build` → `prerender-seo` → `build-blog`).
  Chỉ build blog: `npm run build-blog`. Chỉ sitemap: `npm run sitemap`.
- Docker/VPS: `Dockerfile` đã nối các bước này. Deploy: trên VPS `git pull` rồi
  `docker compose up -d --build frontend` (xem DEPLOYMENT.md).
- nginx phục vụ `/blog/*` sẵn (không cần sửa). Bài index:false vẫn truy cập được qua URL.

## 6. Gợi ý nối từ module SEO Radar (backend)

1. Phase 2 viết bài từ `seo_cum` bằng **Yescale** → lưu vào bảng bài viết (DB).
2. Khi đăng/duyệt: backend xuất bài thành JSON → gọi `publish-article.mjs` (hoặc tự ghi `.md`
   theo mục 3) trong bước build/deploy của frontend.
3. Bài chờ duyệt: xuất với `index:false`; duyệt xong xuất lại với `index` bỏ trống.

> File `scripts/import-articles.mjs` là ví dụ nhập lô (đã dùng cho 10 bài seed).

## 7. IndexNow — báo công cụ tìm kiếm index ngay

Sau khi **deploy** (URL đã sống), chạy để báo Bing/Yandex/**Cốc Cốc**/Seznam/Naver:

```bash
npm run indexnow                       # gửi tất cả URL công khai + blog (bỏ index:false)
node scripts/indexnow.mjs --blog       # chỉ URL blog
node scripts/indexnow.mjs https://kinhlac.online/blog/<slug>/   # chỉ 1 bài vừa đăng
node scripts/indexnow.mjs --dry        # xem trước, không gửi
```

- Khoá đã đặt sẵn ở `public/<key>.txt` (script tự dò). **Không xoá file này.**
- ⚠️ **Google KHÔNG dùng IndexNow** — Google đi qua `sitemap.xml` + Google Search Console.
  Cốc Cốc thì CÓ → hữu ích cho lượng tìm kiếm tại Việt Nam.
- Phải chạy **SAU deploy** (IndexNow xác minh `https://kinhlac.online/<key>.txt` phải truy cập được).
- Module SEO Radar (Phase 3, cron tuần) có thể gọi `node scripts/indexnow.mjs <url>` sau khi đăng bài mới.

## 8. Ảnh trong bài viết

**Cách thêm ảnh:**
- Ảnh bìa (hero + ảnh chia sẻ riêng cho bài): frontmatter `image: "/blog/assets/<slug>.jpg"`.
- Ảnh trong thân bài: Markdown `![mô tả ảnh](/blog/assets/<tên>.jpg)`.
- Để file ảnh ở `public/blog/assets/` (phục vụ tại `/blog/assets/...`). Nên `.webp`/`.jpg`, bìa ~1200×630.
- `alt` (mô tả ảnh) BẮT BUỘC có nội dung → tốt SEO + người khiếm thị.
- Nếu KHÔNG có `image`: bài vẫn đăng được (text-only), og:image dùng ảnh chung `/og-default.png`.

**Nguồn ảnh (xếp theo độ an toàn):**
1. ⭐ **Của chính mình** — render đồ hình kinh lạc 3D, biểu đồ kết quả đo, radar bài thuốc, đồ hình huyệt trong Từ Điển. Chính xác, sở hữu, độc nhất → **tốt SEO nhất** (Google ưu tiên ảnh gốc).
2. **Stock miễn phí license-an-toàn** (Unsplash, Pexels) — CHỈ cho ảnh TRANG TRÍ (thảo dược, bàn tay, phòng khám). KHÔNG dùng cho ảnh giải phẫu/vị trí huyệt.
3. **AI sinh ảnh** — CHỈ trang trí/trừu tượng. ⚠️ TUYỆT ĐỐI không dùng AI vẽ ảnh huyệt/vị trí giải phẫu (AI vẽ SAI vị trí = nguy hiểm, vi phạm YMYL).
4. ❌ **KHÔNG** cào Google Images / lưu ảnh web bừa → **vi phạm bản quyền** (rủi ro pháp lý thật).

**Kiểm duyệt ảnh — 3 cổng (cùng hàng chờ duyệt YMYL với nội dung):**
1. Bản quyền/license: ta có quyền dùng không?
2. Chính xác y khoa: ảnh huyệt/giải phẫu có đúng không?
3. Phù hợp: không phản cảm, đúng ngữ cảnh.
→ Bài (kèm ảnh) chưa duyệt để `index:false`; duyệt xong bỏ cờ.

**Quy trình "ảnh của mình" (khuyên dùng):**
1. Mở trang nguồn, bố trí đẹp: đồ hình 3D `/xem-3d`, biểu đồ đo `/xem-ket-qua-do`, radar bài thuốc `/xem-bai-thuoc`, hoặc giao diện app `/app`.
2. Chụp màn hình (Windows: `Win+Shift+S`), cắt NGANG ~1200×630.
3. Lưu vào `public/blog/assets/`, **đặt tên file = slug bài** (vd `12-duong-kinh-chinh.webp`).
4. `npm run link-images` (tự điền `image:` cho bài có ảnh khớp slug) → `npm run build-blog`.
5. (Tuỳ) nén ảnh nhẹ qua squoosh.app → `.webp`.

Gợi ý ảnh cho 10 bài: huyệt (Hợp Cốc/Túc Tam Lý/Tam Âm Giao) → `/xem-3d` hoặc `/thu-vien`; đo kinh lạc / cách đọc kết quả / Lê Văn Sửu → `/xem-ket-qua-do`; 12 đường kinh → `/xem-3d`; tính vị quy kinh → `/xem-bai-thuoc`; số hoá phòng khám → ảnh `/app`.
