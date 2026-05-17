# SQL thủ công

- `migrate-vi-thuoc-excel-schema.sql` — chạy trên PostgreSQL sau khi deploy code chuẩn hóa `vi_thuoc` (xóa cột YHCT cũ, thêm `nhom_lon` nếu thiếu). **Sao lưu DB trước khi chạy.**
- `create-duoc-ly-schema.sql` — tạo các bảng phân loại dược lý: `nhom_lon_duoc_ly`, `nhom_nho_duoc_ly`, `nhom_nho_vi_thuoc`, `nhom_nho_chu_tri`. Idempotent (`IF NOT EXISTS`).
