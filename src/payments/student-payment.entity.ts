import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PaymentMethod } from '../common/enums/index';
import { StudentCharge } from './student-charge.entity';

@Entity('student_payments')
export class StudentPayment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({ name: 'amount_paid', type: 'numeric', precision: 10, scale: 2 })
  amountPaid!: string;

  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod })
  paymentMethod!: PaymentMethod;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt!: Date;

  @ManyToOne(() => StudentCharge, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_charge_id' })
  studentCharge!: StudentCharge;
}
