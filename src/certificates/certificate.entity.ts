import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  CertificateCategory,
  CertificateRequestStatus,
} from '../common/enums/index';
import { Student } from '../students/student.entity';

@Entity('certificates')
export class Certificate {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({ type: 'enum', enum: CertificateCategory })
  category!: CertificateCategory;

  @Column({
    name: 'request_status',
    type: 'enum',
    enum: CertificateRequestStatus,
  })
  requestStatus!: CertificateRequestStatus;

  @Column({ name: 'personal_photo_url', type: 'varchar', length: 500 })
  personalPhotoUrl!: string;

  @Column({ name: 'transport_requested', type: 'boolean' })
  transportRequested!: boolean;

  @Column({ name: 'requested_at', type: 'timestamptz' })
  requestedAt!: Date;

  @ManyToOne(() => Student, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id' })
  student!: Student;
}
