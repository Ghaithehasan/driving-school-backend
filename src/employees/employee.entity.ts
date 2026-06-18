import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @OneToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'hire_date', type: 'date', nullable: true })
  hireDate: string | null;

  @Column({
    name: 'monthly_salary',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  monthlySalary: string | null;

  @Column({ name: 'resign_date', type: 'date', nullable: true })
  resignDate: string | null;
}
