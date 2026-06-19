import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StudentPayment } from './student-payment.entity';

@Entity('shamcash_transactions')
export class ShamcashTransaction {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'transaction_id', type: 'varchar', length: 100, unique: true })
  transactionId: string;

  @Column({ name: 'sender_account', type: 'varchar', length: 50, nullable: true })
  senderAccount: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @OneToOne(() => StudentPayment, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_payment_id' })
  studentPayment: StudentPayment;
}
