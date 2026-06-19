import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AttendanceStatus } from '../common/enums/index';
import { TransportRegistration } from './transport-registration.entity';
import { TransportTrip } from './transport-trip.entity';

@Entity('transport_attendance')
@Unique(['transportRegistration', 'transportTrip'])
export class TransportAttendance {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'attendance_status', type: 'enum', enum: AttendanceStatus })
  attendanceStatus: AttendanceStatus;

  @Column({ name: 'attended_at', type: 'timestamptz', nullable: true })
  attendedAt: Date | null;

  @ManyToOne(() => TransportRegistration, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transport_registration_id' })
  transportRegistration: TransportRegistration;

  @ManyToOne(() => TransportTrip, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'transport_trip_id' })
  transportTrip: TransportTrip;
}
