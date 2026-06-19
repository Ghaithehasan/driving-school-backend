import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RegistrationStatus, TripType } from '../common/enums/index';
import { Certificate } from '../certificates/certificate.entity';
import { Employee } from '../employees/employee.entity';
import { StudentCharge } from '../payments/student-charge.entity';

@Entity('transport_registrations')
export class TransportRegistration {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'trip_type', type: 'enum', enum: TripType })
  tripType: TripType;

  @Column({
    name: 'registration_status',
    type: 'enum',
    enum: RegistrationStatus,
  })
  registrationStatus: RegistrationStatus;

  @ManyToOne(() => Certificate, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'certificate_id' })
  certificate: Certificate;

  @OneToOne(() => StudentCharge, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_charge_id' })
  studentCharge: StudentCharge | null;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdBy: Employee | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
