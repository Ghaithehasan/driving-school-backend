import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Instructor } from './instructor.entity';

@Entity('vacations')
export class Vacation {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'date' })
  day: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @ManyToOne(() => Instructor, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instructor_id' })
  instructor: Instructor;
}
