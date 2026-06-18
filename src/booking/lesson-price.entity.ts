import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Gender, TrainingTypeFull } from '../common/enums/index';

@Entity('lesson_price')
@Unique(['instructorGender', 'trainingType', 'effectiveFrom'])
export class LessonPrice {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'instructor_gender', type: 'enum', enum: Gender })
  instructorGender: Gender;

  @Column({ name: 'training_type', type: 'enum', enum: TrainingTypeFull })
  trainingType: TrainingTypeFull;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  price: string;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
