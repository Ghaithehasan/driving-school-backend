import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VehicleExpenseReason } from '../common/enums/index';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Expense } from './expense.entity';

@Entity('expenses_vehicle')
export class ExpenseVehicle {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'enum', enum: VehicleExpenseReason })
  reason: VehicleExpenseReason;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  liters: string | null;

  @ManyToOne(() => Vehicle, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @OneToOne(() => Expense, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expense_id' })
  expense: Expense;
}
