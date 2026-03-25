import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaiThuoc } from './bai-thuoc.model';
import { ViThuoc } from './vi-thuoc.model';

@Entity('bai_thuoc_chi_tiet')
export class BaiThuocChiTiet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_bai_thuoc' })
  idBaiThuoc: number;

  @Column({ name: 'id_vi_thuoc' })
  idViThuoc: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lieu_luong: string; // "12g", "bán tiền"...

  @Column({ type: 'varchar', length: 100, nullable: true })
  vai_tro: string; // Quân, Thần, Tá, Sứ...

  @Column({ type: 'text', nullable: true })
  ghi_chu: string; // Tẩm rượu, sao vàng...

  // Tính/vị/quy kinh có thể khác nhau theo từng bài thuốc
  @Column({ type: 'varchar', length: 255, nullable: true })
  tinh_vi: string; // Cũ – giữ để không mất dữ liệu

  @Column({ type: 'varchar', length: 100, nullable: true })
  tinh: string; // Tính: Hàn, Nhiệt, Ôn, Lương, Bình

  @Column({ type: 'varchar', length: 100, nullable: true })
  vi: string; // Vị: Chua, Đắng, Ngọt, Cay, Mặn, Nhạt

  @Column({ type: 'varchar', length: 255, nullable: true })
  quy_kinh: string;

  @ManyToOne(() => BaiThuoc, (bt) => bt.chiTietViThuoc, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_bai_thuoc' })
  baiThuoc: BaiThuoc;

  @ManyToOne(() => ViThuoc, (vt) => vt.baiThuocDetails, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_vi_thuoc' })
  viThuoc: ViThuoc;
}
