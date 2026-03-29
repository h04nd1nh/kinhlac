import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('bien_chung')
export class BienChung {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  ten_bien_chung: string;
}
