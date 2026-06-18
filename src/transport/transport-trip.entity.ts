import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TripStatus, TripType } from '../common/enums/index';
import { Employee } from '../employees/employee.entity';

@Entity('transport_trips')
export class TransportTrip {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'trip_type', type: 'enum', enum: TripType })
  tripType: TripType;

  @Column({ name: 'trip_date', type: 'date' })
  tripDate: string;

  @Column({ name: 'day_number', type: 'smallint', nullable: true })
  dayNumber: number | null;

  @Column({ name: 'assembly_time', type: 'time', nullable: true })
  assemblyTime: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  destination: string | null;

  @Column({ type: 'integer', nullable: true })
  capacity: number | null;

  @Column({ type: 'enum', enum: TripStatus })
  status: TripStatus;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdBy: Employee | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
