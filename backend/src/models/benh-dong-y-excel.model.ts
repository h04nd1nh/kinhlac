import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { PhapTri } from './phap-tri.model';
import { TrieuChung } from './trieu-chung.model';
import { BaiThuoc } from './bai-thuoc.model';

@Entity('benh_dong_y_excel')
export class BenhDongYExcel {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 120, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 20, name: 'output_cell' })
  outputCell: string;

  @Column({ type: 'text', name: 'excel_formula' })
  excelFormula: string;

  @Column({ type: 'text', name: 'logic_expression' })
  logicExpression: string;

  @Column({ type: 'text', name: 'sql_case_text' })
  sqlCaseText: string;

  @Column({ type: 'text', name: 'sql_case_boolean' })
  sqlCaseBoolean: string;

  @Column({ type: 'int', name: 'id_phap_tri', nullable: true })
  idPhapTri: number | null;

  @ManyToOne(() => PhapTri, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'id_phap_tri' })
  phapTri: PhapTri | null;

  @ManyToMany(() => TrieuChung)
  @JoinTable({
    name: 'benh_dong_y_excel_trieu_chung',
    joinColumn: { name: 'id_benh_dong_y_excel', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'id_trieu_chung', referencedColumnName: 'id' },
  })
  trieuChungList: TrieuChung[];

  @ManyToMany(() => BaiThuoc)
  @JoinTable({
    name: 'benh_dong_y_excel_bai_thuoc',
    joinColumn: { name: 'id_benh_dong_y_excel', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'id_bai_thuoc', referencedColumnName: 'id' },
  })
  baiThuocList: BaiThuoc[];
}
