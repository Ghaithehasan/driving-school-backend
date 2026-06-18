import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  BookingStatus,
  PaymentStatus,
  TrainingType,
  VehicleSource,
} from '../common/enums/index';
import { Instructor } from '../instructors/instructor.entity';
import { Student } from '../students/student.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

@Entity('booking')
export class Booking {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'vehicle_source', type: 'enum', enum: VehicleSource })
  vehicleSource: VehicleSource;

  @Column({ name: 'booking_status', type: 'enum', enum: BookingStatus })
  bookingStatus: BookingStatus;

  @Column({ name: 'payment_status', type: 'enum', enum: PaymentStatus })
  paymentStatus: PaymentStatus;

  @Column({ name: 'training_type', type: 'enum', enum: TrainingType })
  trainingType: TrainingType;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt: Date;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @ManyToOne(() => Student, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @ManyToOne(() => Instructor, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'instructor_id' })
  instructor: Instructor;

  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle | null;

  @OneToOne(() => Booking, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'replaced_booking_id' })
  replacedBooking: Booking | null;
}
