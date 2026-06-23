import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VehicleStatus, VehicleType } from '../common/enums/index';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({ name: 'plate_number', type: 'varchar', length: 20, unique: true })
  plateNumber!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  model!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  color!: string | null;

  @Column({ type: 'enum', enum: VehicleType })
  type!: VehicleType;

  @Column({ type: 'enum', enum: VehicleStatus })
  status!: VehicleStatus;

  @Column({ name: 'admin_notes', type: 'varchar', length: 255, nullable: true })
  adminNotes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
