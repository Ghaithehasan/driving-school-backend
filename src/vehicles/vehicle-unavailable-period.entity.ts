import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VehicleUnavailableReasonType } from '../common/enums/index';
import { Vehicle } from './vehicle.entity';

@Entity('vehicle_unavailable_periods')
export class VehicleUnavailablePeriod {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt!: Date;

  @Column({ name: 'end_at', type: 'timestamptz', nullable: true })
  endAt!: Date | null;

  @Column({
    name: 'reason_type',
    type: 'enum',
    enum: VehicleUnavailableReasonType,
  })
  reasonType!: VehicleUnavailableReasonType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes!: string | null;

  @ManyToOne(() => Vehicle, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle!: Vehicle;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
