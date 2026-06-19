import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StudentStatus } from '../common/enums/index';
import { User } from '../users/user.entity';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'student_status', type: 'enum', enum: StudentStatus })
  studentStatus: StudentStatus;

  @OneToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
