import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('phap_tri')
export class PhapTri {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  ten_phap_tri: string;
}
