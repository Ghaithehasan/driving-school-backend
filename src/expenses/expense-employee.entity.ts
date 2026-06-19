import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmployeeExpenseType } from '../common/enums/index';
import { Employee } from '../employees/employee.entity';
import { Expense } from './expense.entity';

@Entity('expenses_employee')
export class ExpenseEmployee {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'enum', enum: EmployeeExpenseType })
  type: EmployeeExpenseType;

  @Column({ type: 'date' })
  month: string;

  @ManyToOne(() => Employee, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @OneToOne(() => Expense, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expense_id' })
  expense: Expense;
}
