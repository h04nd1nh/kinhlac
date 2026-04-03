// ViThuoc DTOs — nhóm dược lý qua tab Danh mục / API riêng; công dụng & chủ trị & kiêng kỵ qua bảng liên kết
export class CreateViThuocDto {
  ten_vi_thuoc: string;
  tinh?: string;
  vi?: string;
  quy_kinh?: string;
  lieu_dung?: string;
  /** Mỗi phần tử: id_cong_dung + ghi_chu (ghi chú gắn với vị thuốc này). */
  cong_dung_links?: { id_cong_dung: number; ghi_chu?: string }[];
  chu_tri_links?: { id_chu_tri: number; ghi_chu?: string }[];
  kieng_ky_links?: { id_kieng_ky: number; ghi_chu?: string }[];
  ten_goi_khac_list?: string[];
}
export class UpdateViThuocDto extends CreateViThuocDto {}

// BaiThuoc DTOs
export class CreateBaiThuocDto {
  ten_bai_thuoc: string;
  nguon_goc?: string;
  cong_dung?: string;
  cach_dung?: string;
  ghi_chu?: string;
  bien_chung?: string;
  trieu_chung?: string;
  phap_tri?: string;
  chi_tiet?: {
    id_vi_thuoc: number;
    lieu_luong?: string;
    vai_tro?: string;
    ghi_chu?: string;
    tinh_vi?: string; // Legacy
    quy_kinh?: string; // Supports multiple via comma
  }[];
}
export class UpdateBaiThuocDto extends CreateBaiThuocDto {}
