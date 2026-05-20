# Refactor tab Vị Thuốc & modal sửa vị thuốc — chuyển sang filter 2 tier

**Ngày:** 2026-05-20
**Phạm vi:** `frontend/src/views/MedicinesView.vue`
**Liên quan:** Mục "Nhóm dược lý" trong modal Vị Thuốc, tab Vị Thuốc trong MedicinesView

## Bối cảnh

Hiện tại tab "Vị Thuốc" trong `MedicinesView.vue` hiển thị toàn bộ vị thuốc nhóm theo "Nhóm lớn → Nhóm nhỏ" dưới dạng các section collapse được (`duocly-sections`). Cách này cho thấy landscape đầy đủ nhưng:

- Trang dài, phải scroll nhiều khi có nhiều nhóm.
- Không có cơ chế focus vào một nhóm cụ thể.
- Khi search, kết quả vẫn bị fragment qua nhiều section.
- Pagination bị mất, mọi vị thuốc đều render cùng lúc.

Modal sửa/thêm vị thuốc (mục "Nhóm dược lý") cũng liệt kê tất cả nhóm lớn cùng lúc, mỗi nhóm hiển thị toàn bộ chip nhóm nhỏ → modal cao, scroll nhiều, chip "đã chọn" wrap xấu vì hiển thị cả "Nhóm lớn › Nhóm nhỏ".

## Mục tiêu

1. Tab Vị Thuốc: thay grouped sections bằng **filter 2 tier** (nhóm lớn → nhóm nhỏ) phía trên grid phẳng + pagination.
2. Modal sửa vị thuốc: thay layout liệt kê toàn bộ bằng **tab strip nhóm lớn** + chip nhóm nhỏ của tab active. Khi search có giá trị thì fallback layout phẳng để đỡ phải implement search xuyên tab.
3. Hai phần dùng chung **pattern 2 tier** để user học một lần.

Không trong phạm vi: thay đổi backend (file `vi-thuoc.controller.ts` và `dongy-thuoc.dto.ts` đang dở của user không liên quan refactor UX này).

## Phần 1 — Tab Vị Thuốc

### Xóa

- Template: block `duocly-sections` (lines ~2141–2213) cùng card-header text "Vị Thuốc theo nhóm dược lý".
- Script: computed `viThuocGroupedByDuocLy`, `totalFilteredViThuoc`, ref `collapsedSections`, hàm `toggleSection`, interface `DuocLyGroup`/`DuocLySection`.
- CSS class không còn dùng: `duocly-sections`, `duocly-section*`, `duocly-caret*`, `duocly-lon-*`, `duocly-nho-*`, `duocly-subgroup`, `duocly-count`.

### Thêm

**State mới:**
```ts
const vtFilterNhomLonId = ref<number | null>(null)   // null = Tất cả, -1 = Chưa phân nhóm
const vtFilterNhomNhoId = ref<number | null>(null)   // null = tất cả nhóm nhỏ của tier 1
```

**Computed mới:**

- `vtClassifiedSet` (`Set<number>`): id các vị thuốc thuộc ≥1 nhóm nhỏ (dùng để xác định "Chưa phân nhóm"). Lấy từ `vtIdToGroups` đã tồn tại.
- `vtNhomLonChips`: `Array<{ id: number | null; ten_nhom: string; count: number }>`
  - `{ id: null, ten_nhom: 'Tất cả', count: <số khớp search> }`
  - mỗi nhóm lớn có vị thuốc khớp search, count = số vị thuốc thuộc nhóm lớn đó **sau khi apply search**
  - `{ id: -1, ten_nhom: 'Chưa phân nhóm', count: <số khớp search và unclassified> }` (chỉ thêm nếu count > 0)
- `vtNhomNhoChipsForActive`: chỉ tính khi `vtFilterNhomLonId > 0`. Trả về `[{ id: null, ten_nhom: 'Tất cả nhóm nhỏ', count }, ...]` + chips cho từng nhóm nhỏ thuộc nhóm lớn active, count = số vị thuốc thuộc nhóm nhỏ đó **sau khi apply search + tier 1**.
- `filteredViThuoc`: compose (1) search → (2) tier 1 → (3) tier 2. Sort theo `ten_vi_thuoc` (vi locale).

**Sort & paging:**
- `pagedViThuoc` và `totalVTPage` giữ nguyên cấu trúc, chỉ dùng `filteredViThuoc` mới.

**Reset behavior (watch):**
- `vtFilterNhomLonId` thay đổi → `vtFilterNhomNhoId = null`, `viThuocPage = 1`.
- `vtFilterNhomNhoId` thay đổi → `viThuocPage = 1`.
- `viThuocSearch` thay đổi → `viThuocPage = 1` (đã có).

### UI structure (template)

```html
<div class="tab-content">
  <div class="toolbar">
    <div class="search-wrap">
      <input v-model="viThuocSearch" ... />
      <button v-if="viThuocSearch" ...>✕</button>
    </div>
    <span class="toolbar-count">{{ filteredViThuoc.length }} / {{ viThuocList.length }} vị thuốc</span>
  </div>

  <div class="vt-filter-tier1">
    <button
      v-for="chip in vtNhomLonChips"
      :key="`tier1-${chip.id ?? 'all'}`"
      class="chip-toggle"
      :class="{ active: vtFilterNhomLonId === chip.id }"
      @click="vtFilterNhomLonId = chip.id"
    >
      {{ chip.ten_nhom }} <span class="chip-count">{{ chip.count }}</span>
    </button>
  </div>

  <div v-if="vtFilterNhomLonId !== null && vtFilterNhomLonId > 0" class="vt-filter-tier2">
    <button
      v-for="chip in vtNhomNhoChipsForActive"
      :key="`tier2-${chip.id ?? 'all'}`"
      class="chip-toggle chip-toggle--sm"
      :class="{ active: vtFilterNhomNhoId === chip.id }"
      @click="vtFilterNhomNhoId = chip.id"
    >
      {{ chip.ten_nhom }} <span class="chip-count">{{ chip.count }}</span>
    </button>
  </div>

  <div class="data-card">
    <div class="card-header">
      <div class="card-header-left">
        <h3>Danh sách Vị Thuốc</h3>
        <span class="badge badge-success">{{ filteredViThuoc.length }} vị thuốc</span>
      </div>
      <button type="button" class="btn-primary" @click="openCreateViThuoc">+ Thêm vị thuốc</button>
    </div>

    <div v-if="!pagedViThuoc.length" class="empty-state">
      {{ filteredViThuoc.length === 0 ? 'Không khớp vị thuốc nào' : 'Chưa có dữ liệu vị thuốc' }}
    </div>

    <div v-else class="vt-grid">
      <!-- giữ nguyên markup vt-card hiện có cho pagedViThuoc -->
    </div>

    <div v-if="totalVTPage > 1" class="pagination">
      <!-- giữ nguyên pagination markup -->
    </div>
  </div>
</div>
```

### CSS mới

- `.vt-filter-tier1`, `.vt-filter-tier2`: flex row, `gap: 8px`, `overflow-x: auto`, `padding-bottom: 4px` cho scrollbar, `margin: 8px 0`.
- `.chip-toggle--sm`: variant nhỏ hơn cho tier 2 (font-size 12px, padding nhỏ hơn).
- `.chip-count`: badge inline, font nhỏ, opacity 0.7.
- `.vt-filter-tier1 .chip-toggle.active`: nền primary đậm hơn tier 2 để phân cấp visual.

## Phần 2 — Modal sửa/thêm vị thuốc (mục "Nhóm dược lý")

### Giữ nguyên

- `vtForm.nhom_nho_ids`, `toggleVtNhomNho`, `vtNhomNhoFilter`, `vtNhomNhoGrouped`, `nhomNhoFullLabel`, `nhomNhoIdsForViThuoc`.
- Logic submit: gửi `nhom_nho_ids` trong payload create/update.

### Thêm

**State mới:**
```ts
const vtNhomLonActiveTab = ref<number | null>(null)
```

Khởi tạo khi mở modal (cả create và edit): tab đầu tiên có ≥1 nhóm nhỏ — nếu `nhom_nho_ids` đã chọn có ít nhất 1 item, set sang tab của item đầu tiên (để user thấy ngay context đang sửa).

**Computed mới:**

- `vtNhomLonTabs`: `Array<{ id: number; ten_nhom: string; total: number; selected: number }>`
  - Mỗi nhóm lớn có ít nhất 1 nhóm nhỏ
  - `total` = số nhóm nhỏ trong nhóm lớn
  - `selected` = số nhóm nhỏ đã tick trong `vtForm.nhom_nho_ids` thuộc nhóm lớn này
- `vtNhomNhoChipsActiveTab`: `Array<{ id: number; ten_nhom: string }>` — nhóm nhỏ của tab active, sort theo tên.

### UI structure (template) — thay block field "Nhóm dược lý" hiện tại

```html
<div class="field field--full">
  <div class="field-head">
    <span>Nhóm dược lý</span>
    <span class="field-count">{{ vtForm.nhom_nho_ids.length }} đã chọn</span>
  </div>

  <div v-if="vtForm.nhom_nho_ids.length" class="vt-nn-selected">
    <span
      v-for="id in vtForm.nhom_nho_ids"
      :key="id"
      class="vt-nn-chip"
      :title="nhomNhoFullLabel(id)"
    >
      {{ nhomNhoShortLabel(id) }}
      <button type="button" class="vt-nn-x" @click="toggleVtNhomNho(id)">×</button>
    </span>
  </div>

  <input
    v-model="vtNhomNhoFilter"
    type="search"
    class="input input--sm"
    placeholder="Tìm nhóm lớn / nhóm nhỏ..."
  />

  <div v-if="!nhomNhoList.length" class="muted">Chưa có nhóm dược lý nào</div>

  <!-- Khi search trống → tab strip + chip body -->
  <template v-else-if="!vtNhomNhoFilter.trim()">
    <div class="vt-nn-tab-strip">
      <button
        v-for="tab in vtNhomLonTabs"
        :key="tab.id"
        type="button"
        class="vt-nn-tab"
        :class="{ active: vtNhomLonActiveTab === tab.id }"
        @click="vtNhomLonActiveTab = tab.id"
      >
        {{ tab.ten_nhom }}
        <span class="vt-nn-tab-count" :class="{ 'has-selected': tab.selected > 0 }">
          {{ tab.selected }}/{{ tab.total }}
        </span>
      </button>
    </div>
    <div class="vt-nn-tab-body">
      <button
        v-for="nn in vtNhomNhoChipsActiveTab"
        :key="nn.id"
        type="button"
        class="chip-toggle"
        :class="{ active: vtForm.nhom_nho_ids.includes(nn.id) }"
        @click="toggleVtNhomNho(nn.id)"
      >
        {{ nn.ten_nhom }}
      </button>
      <span v-if="!vtNhomNhoChipsActiveTab.length" class="muted">Tab này không có nhóm nhỏ</span>
    </div>
  </template>

  <!-- Khi search có giá trị → flat layout cũ (vtNhomNhoGrouped) -->
  <div v-else class="vt-nn-groups">
    <div v-for="g in vtNhomNhoGrouped" :key="g.nhomLon.id" class="vt-nn-group">
      <div class="vt-nn-group__head">{{ g.nhomLon.ten_nhom }}</div>
      <div class="vt-nn-group__chips">
        <button
          v-for="nn in g.items"
          :key="nn.id"
          type="button"
          class="chip-toggle"
          :class="{ active: vtForm.nhom_nho_ids.includes(nn.id) }"
          @click="toggleVtNhomNho(nn.id)"
        >
          {{ nn.ten_nhom }}
        </button>
      </div>
    </div>
    <span v-if="!vtNhomNhoGrouped.length" class="muted">Không khớp "{{ vtNhomNhoFilter }}"</span>
  </div>
</div>
```

### Helper mới

```ts
function nhomNhoShortLabel(id: number): string {
  const nn = nhomNhoList.value.find((x) => x.id === id)
  return nn?.ten_nhom ?? `#${id}`
}
```

### Khởi tạo `vtNhomLonActiveTab`

- Trong `openCreateViThuoc`: set sang `vtNhomLonTabs[0]?.id ?? null`.
- Trong `openEditViThuoc`: nếu `nhom_nho_ids` không rỗng, set sang nhóm lớn của item đầu tiên; ngược lại `vtNhomLonTabs[0]?.id ?? null`.

### CSS mới

- `.vt-nn-tab-strip`: flex row, `overflow-x: auto`, gap 4px, border-bottom mỏng, `margin-bottom: 8px`.
- `.vt-nn-tab`: padding 6px 12px, border-bottom 2px transparent. `.active` → border-bottom primary color.
- `.vt-nn-tab-count`: badge inline, font 11px, opacity 0.6. `.has-selected` → màu primary, đậm hơn.
- `.vt-nn-tab-body`: flex wrap, gap 6px, max-height 240px, overflow-y auto, padding 4px 0.

## Edge cases

- Vị thuốc thuộc nhiều nhóm nhỏ ở nhiều nhóm lớn khác nhau → xuất hiện ở mọi tier 1/2 phù hợp. Count cộng riêng cho từng filter (không dedupe cross-section vì grid phẳng chỉ render mỗi vị thuốc 1 lần).
- Khi đổi filter trong lúc search có giá trị → vẫn compose hai chiều.
- Khi `nhomNhoList` rỗng → chỉ hiện chip "Tất cả" tier 1, không hiện tier 2.
- Khi tất cả vị thuốc đều có nhóm nhỏ → không hiện chip "Chưa phân nhóm".
- Modal: nếu user đã chọn 1 nhóm nhỏ mà nhóm lớn bị filter ẩn (search) → chip selected ở trên vẫn hiện, vẫn có thể bỏ tick từ chip selected.

## Files thay đổi

- `frontend/src/views/MedicinesView.vue` — script + template + style block

## Testing manual (acceptance)

Tab Vị Thuốc:
- [ ] Mở tab, mặc định filter = "Tất cả", grid phẳng + pagination hoạt động
- [ ] Click chip nhóm lớn → grid chỉ hiển thị vị thuốc thuộc nhóm đó, tier 2 chip strip xuất hiện
- [ ] Click chip nhóm nhỏ → grid lọc xuống thêm tier 2
- [ ] Click "Tất cả nhóm nhỏ" → quay lại scope tier 1
- [ ] Click "Chưa phân nhóm" (nếu có) → chỉ vị thuốc không thuộc nhóm nhỏ nào, tier 2 ẩn
- [ ] Nhập search "cam thảo" → grid + counts của mọi chip đều cập nhật
- [ ] Đổi tier 1 reset tier 2 và pagination về trang 1
- [ ] Empty state khi không khớp

Modal sửa vị thuốc:
- [ ] Mở modal create → tab active = nhóm lớn đầu, body hiện chip nhóm nhỏ tab đó
- [ ] Mở modal edit vị thuốc đã có ≥1 nhóm → tab active là nhóm lớn của nhóm đã chọn đầu tiên
- [ ] Click tab khác → body cập nhật chip nhóm nhỏ của tab mới
- [ ] Tick chip → counter "đã chọn" tăng, badge "selected/total" trên tab tăng
- [ ] Selected chip hiển thị tên ngắn (`ten_nhom`), hover → tooltip full label
- [ ] Bỏ tick từ selected chip ở trên cũng cập nhật chip ở body
- [ ] Gõ search trong modal → tab strip ẩn, hiện flat list grouped
- [ ] Xóa search → tab strip quay lại, giữ tab active trước đó
- [ ] Submit lưu được `nhom_nho_ids` (cả create và edit) → backend đã hỗ trợ

## Out of scope

- Backend API `vi-thuoc` cho `nhom_nho_ids` (đã có sẵn từ commit trước/đang dở của user).
- Tách `MedicinesView.vue` thành component nhỏ (sẽ xử lý ở task riêng nếu cần).
- Multi-select cho filter tier 1/2 (single-select đủ cho use case hiện tại).
