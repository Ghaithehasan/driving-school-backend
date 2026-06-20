import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChargeReason, ChargeStatus } from '../common/enums/index';
import { Booking } from '../booking/booking.entity';
import { Certificate } from '../certificates/certificate.entity';
import { CertificateExamResult } from '../certificates/certificate-exam-result.entity';
import { Student } from '../students/student.entity';

@Entity('student_charges')
export class StudentCharge {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'charge_reason', type: 'enum', enum: ChargeReason })
  chargeReason: ChargeReason;

  @Column({ name: 'amount_due', type: 'numeric', precision: 10, scale: 2 })
  amountDue: string;

  @Column({ name: 'charge_status', type: 'enum', enum: ChargeStatus })
  chargeStatus: ChargeStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'due_at', type: 'date', nullable: true })
  dueAt: string | null;

  @ManyToOne(() => Student, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @ManyToOne(() => Booking, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking | null;

  @ManyToOne(() => Certificate, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'certificate_id' })
  certificate: Certificate | null;

  @ManyToOne(() => CertificateExamResult, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'certificate_exam_result_id' })
  certificateExamResult: CertificateExamResult | null;
}
