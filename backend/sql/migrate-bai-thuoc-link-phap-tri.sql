-- Liên kết nhiều-nhiều: bai_thuoc ↔ phap_tri theo nội dung chứng trạng.
-- Giả định: bai_thuoc.chung_trang là chuỗi có thể tách thành nhiều đoạn
-- (phẩy / chấm phẩy / dấu toàn bộ / dấu + ASCII hoặc toàn bộ ＋), có trim khoảng trắng,
-- mỗi đoạn trim khớp với phap_tri.chung_trang (so khớp chính xác sau TRIM).
--
-- Khác với cột phap_tri.id_bai_thuoc: đó là "một dòng luận trị đang gắn một bài thuốc cụ thể";
-- bảng này là "một bài thuốc tham chiếu tới các dòng trong danh mục pháp trị".
--
-- PostgreSQL. Sao lưu DB trước khi chạy.

BEGIN;

CREATE TABLE IF NOT EXISTS bai_thuoc_phap_tri (
  id_bai_thuoc INTEGER NOT NULL REFERENCES bai_thuoc(id) ON DELETE CASCADE,
  id_phap_tri INTEGER NOT NULL REFERENCES phap_tri(id) ON DELETE CASCADE,
  -- Đoạn text trong bai_thuoc.chung_trang đã dùng để khớp (tiện kiểm tra / hiển thị)
  doan_chung_trang TEXT,
  thu_tu SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (id_bai_thuoc, id_phap_tri)
);

CREATE INDEX IF NOT EXISTS idx_bai_thuoc_phap_tri_bt ON bai_thuoc_phap_tri(id_bai_thuoc);
CREATE INDEX IF NOT EXISTS idx_bai_thuoc_phap_tri_pt ON bai_thuoc_phap_tri(id_phap_tri);

-- Tách chung_trang thành token theo , ， ; ； + ＋; chuẩn hóa khoảng trắng đầu/cuối.
-- Nếu một token khớp nhiều dòng phap_tri (trùng chung_trang), lấy id nhỏ nhất.
WITH tokens AS (
  SELECT
    bt.id AS id_bai_thuoc,
    trim(both FROM t.part) AS token,
    (t.ord)::SMALLINT AS thu_tu
  FROM bai_thuoc bt
  CROSS JOIN LATERAL regexp_split_to_table(
    COALESCE(bt.chung_trang, ''),
    '\s*[,，;；+＋]+\s*'
  ) WITH ORDINALITY AS t(part, ord)
  WHERE trim(both FROM t.part) <> ''
),
matched AS (
  SELECT DISTINCT ON (tok.id_bai_thuoc, tok.token)
    tok.id_bai_thuoc,
    pt.id AS id_phap_tri,
    tok.token AS doan_chung_trang,
    tok.thu_tu
  FROM tokens tok
  INNER JOIN phap_tri pt
    ON trim(both FROM COALESCE(pt.chung_trang, '')) = tok.token
  ORDER BY tok.id_bai_thuoc, tok.token, pt.id
)
INSERT INTO bai_thuoc_phap_tri (id_bai_thuoc, id_phap_tri, doan_chung_trang, thu_tu)
SELECT id_bai_thuoc, id_phap_tri, doan_chung_trang, thu_tu
FROM matched
ON CONFLICT (id_bai_thuoc, id_phap_tri) DO UPDATE SET
  doan_chung_trang = EXCLUDED.doan_chung_trang,
  thu_tu = EXCLUDED.thu_tu;

COMMIT;

-- Sau khi có bảng + backend đọc quan hệ:
-- - Có thể giữ nguyên bai_thuoc.chung_trang làm “nguồn tự do” / tìm kiếm.
-- - Hoặc đồng bộ một chiều từ liên kết (ứng dụng hoặc job riêng).
