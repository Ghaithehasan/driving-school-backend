import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { Instructor } from './instructor.entity';

@Entity('instructor_schedule_publications')
@Unique(['instructor', 'scheduleDate'])
export class InstructorSchedulePublication {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @ManyToOne(() => Instructor, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instructor_id' })
  instructor: Instructor;

  @Column({ name: 'schedule_date', type: 'date' })
  scheduleDate: string;

  @Column({ name: 'published_at', type: 'timestamptz' })
  publishedAt: Date;

  @Column({
    name: 'first_published_booking_start_at',
    type: 'timestamptz',
    nullable: true,
  })
  firstPublishedBookingStartAt: Date | null;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_employee_id' })
  createdByEmployee: Employee | null;
}
