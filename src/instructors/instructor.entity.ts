import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Gender, InstructorType } from '../common/enums/index';
import { User } from '../users/user.entity';

@Entity('instructors')
export class Instructor {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({ type: 'enum', enum: Gender })
  gender!: Gender;

  @Column({ name: 'instructor_type', type: 'enum', enum: InstructorType })
  instructorType!: InstructorType;

  @OneToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
