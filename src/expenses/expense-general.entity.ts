import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GeneralExpenseType } from '../common/enums/index';
import { Expense } from './expense.entity';

@Entity('expenses_general')
export class ExpenseGeneral {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'enum', enum: GeneralExpenseType })
  type: GeneralExpenseType;

  @OneToOne(() => Expense, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expense_id' })
  expense: Expense;
}
