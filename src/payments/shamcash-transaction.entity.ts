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
  id!: number;

  @Column({
    name: 'transaction_id',
    type: 'varchar',
    length: 100,
    unique: true,
  })
  transactionId!: string;

  @Column({
    name: 'sender_account',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  senderAccount!: string | null;

  @Column({
    name: 'receiver_account',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  receiverAccount!: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount!: string;

  @Column({ name: 'occurred_at', type: 'timestamptz', nullable: true })
  occurredAt!: Date | null;

  @Column({ name: 'verified_at', type: 'timestamptz' })
  verifiedAt!: Date;

  @Column({ name: 'raw_payload', type: 'jsonb', nullable: true })
  rawPayload!: Record<string, unknown> | null;

  @OneToOne(() => StudentPayment, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_payment_id' })
  studentPayment!: StudentPayment;
}
