# Từ Điển — Index tra ngược (Nguồn & Đặc Tính)

Biến phần Từ Điển từ "đọc dọc từng huyệt" thành **từ điển tra 2 chiều**: từ một **Nguồn (Xuất Xứ)** hay một **Đặc Tính** → ra danh sách huyệt thuộc về nó.

## Các file

| File | Vai trò | Ai sửa |
|---|---|---|
| `acupoints.js` | 1.059 huyệt (text gốc, có `sections[]`) | **KHÔNG sửa tay** |
| `dict-traits.json` | Từ vựng phân loại **Đặc Tính** (regex khớp) | **Người** |
| `dict-sources.json` | **Thư mục Nguồn** đã duyệt (gộp biến thể, điền link) | **Người** |
| `_build-dict.cjs` | Script đọc text → gom nguồn + phân loại + đảo chiều | (công cụ) |
| `dict-facets.js` | Index `window.DICT_FACETS` cho frontend | **TỰ SINH — không sửa** |

## Quy trình (chạy lại bao nhiêu lần cũng được, không hư dữ liệu gốc)

```bash
cd frontend/public/kinhmach3d/data
node _build-dict.cjs
```

Script in ra: số nguồn chuẩn, phân loại Đặc Tính, và **cặp NGHI trùng cần duyệt**.

### Duyệt nguồn (máy gợi ý — bạn quyết)

- Mở `dict-sources.json`, xem mảng `_reviewQueue`.
- Mỗi mục là 1 **cặp nghi trùng** (vd `"Giáp Ất Kinh"` vs `"Giáp Ất"`).
  - **Đúng là một nguồn** → mở bản ghi giữ lại trong `"sources"`, thêm tên nguồn kia vào `alias[]`, rồi **xoá** bản ghi nguồn kia. Chạy lại script.
  - **Hai nguồn khác nhau** (vd `"Thiên Kim Yếu Phương"` 千金要方 ≠ `"Thiên Kim Dực Phương"` 千金翼方) → **để yên**.
- Điền `tacGia`, `nienDai`, `link` (URL sách số hoá/wiki) để **đối chiếu**. `link` chính là "khu vực dẫn về đâu".
- `_seed: true` = nguồn script vừa tự tạo, nên xem lại & bổ sung link.

> Chạy lại script **giữ nguyên** `ten`/`alias`/`link`/`tacGia` bạn đã sửa; chỉ làm mới `count` và `huyetIds`.

### Sửa phân loại Đặc Tính

Mở `dict-traits.json`, thêm/bớt loại hoặc chỉnh `any` (danh sách regex). Chạy lại script.

## Cấu trúc `window.DICT_FACETS`

```js
{
  count:  { huyet, sources, traits },
  huyet:  { "<id>": { ten, code } },              // tra tên/mã huyệt theo id
  sources:{ "<id>": { ten, alias, tacGia, nienDai, link, parent, chapter, thien, count, huyetIds } },
  traits: { "<id>": { ten, nhom, moTa, count, huyetIds } }
}
```

## Bước sau (làm UI)

Khi dựng giao diện, nạp thêm file index bằng cách thêm `'data/dict-facets.js'` vào mảng
`DATA_SCRIPTS` trong `frontend/src/lib/acuMap3d.ts`. Sau đó trong `TuDienView.vue`:
biến "Xuất Xứ"/"Đặc Tính" thành link → mở Trang Nguồn / mục Tra Theo Đặc Tính
(dùng `huyetIds` để liệt kê huyệt, `huyet[id].ten` để hiển thị).
