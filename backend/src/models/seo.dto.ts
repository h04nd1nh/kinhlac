// DTO cho module SEO Radar (plain TS — codebase không dùng class-validator).

export interface CreateDoiThuDto {
  domain: string;
  ten?: string;
  la_cua_minh?: boolean;
  ghi_chu?: string;
}

export interface AnalyzeBatchDto {
  /** Số URL "chờ" sẽ phân tích trong 1 lần bấm (mặc định 10, trần 30). */
  limit?: number;
}

// ---- Phase 2: Lò Viết Bài --------------------------------------------------

export interface GenerateDraftDto {
  /** Sinh bài từ 1 cụm gap analysis (ưu tiên). */
  cum_id?: number;
  /** Hoặc sinh tự do từ chủ đề + từ khoá tự nhập. */
  chu_de?: string;
  tu_khoa?: string;
}

export interface UpdateBaiVietDto {
  tieu_de?: string;
  slug?: string;
  meta_description?: string;
  tu_khoa?: string;
  category?: string;
  cta?: string;
  faq?: string;
  nguon_tham_khao?: string;
  noi_dung_md?: string;
  trang_thai?: 'nhap' | 'da_duyet' | 'bo_qua' | 'da_dang';
}

// ---- Phase 3: Tự đăng theo xu hướng ----------------------------------------

export interface RunTrendsDto {
  /** Các từ khoá (chủ đề) chọn từ kết quả quét xu hướng để viết nháp (trần 5). */
  keywords: string[];
}
