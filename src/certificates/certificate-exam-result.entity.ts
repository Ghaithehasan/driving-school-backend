import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ExamResult, ExamType } from '../common/enums/index';
import { Certificate } from './certificate.entity';

@Entity('certificate_exam_results')
export class CertificateExamResult {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'exam_type', type: 'enum', enum: ExamType })
  examType: ExamType;

  @Column({ name: 'attempt_number', type: 'smallint' })
  attemptNumber: number;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({
    name: 'exam_result',
    type: 'enum',
    enum: ExamResult,
    nullable: true,
  })
  examResult: ExamResult | null;

  @Column({ name: 'result_recorded_at', type: 'timestamptz', nullable: true })
  resultRecordedAt: Date | null;

  @ManyToOne(() => Certificate, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'certificate_id' })
  certificate: Certificate;
}
