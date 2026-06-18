import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { InstructorPriceType } from '../common/enums/index';

@Entity('instructor_price')
@Unique(['type', 'effectiveFrom'])
export class InstructorPrice {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'enum', enum: InstructorPriceType })
  type: InstructorPriceType;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  price: string;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;
}
