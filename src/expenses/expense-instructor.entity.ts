import { Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from '../booking/booking.entity';
import { Expense } from './expense.entity';

@Entity('expenses_instructor')
export class ExpenseInstructor {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @OneToOne(() => Booking, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @OneToOne(() => Expense, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expense_id' })
  expense: Expense;
}
